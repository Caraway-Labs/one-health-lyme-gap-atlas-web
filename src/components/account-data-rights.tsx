"use client";

import { QueryClientContext } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useCallback, useContext, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { endLocalAtlasSession } from "@/features/ux-reset/profile/end-local-session";
import { followWorkspaceHref } from "@/features/ux-reset/workspace-navigation";
import {
  runWorkspaceSignOut,
  workspaceSignOutSuppressesExpiryRedirect,
} from "@/features/ux-reset/workspace-sign-out";
import {
  confirmPrivacyRequest,
  createPrivacyRequest,
  downloadPrivacyExport,
} from "@/generated/atlas";
import { AtlasApiError } from "@/lib/api-mutator";
import {
  accessTokenIssuedAtMs,
  beginPrivacyReauthResume,
  claimPrivacyReauthChallenge,
  clearPrivacyReauthChallenge,
  endPrivacyReauthResume,
  previousIssuedAtForReauth,
  PRIVACY_REAUTH_CONTINUE_NOTICE,
  privacyReauthResumeDisposition,
  privacyReauthSubjectId,
  readPrivacyReauthChallenge,
  savePrivacyReauthChallenge,
  type PrivacyReauthChallenge,
  type PrivacySessionSnapshot,
} from "@/lib/auth/privacy-reauth";
import { signInHrefForReturnPath } from "@/lib/auth/sign-in-href";
import { createClient } from "@/lib/supabase/client";

type PrivacyAction = PrivacyReauthChallenge["action"];

const PRIVACY_REQUEST_FAILURE =
  "We could not complete that privacy request. Please try again later.";

const confirmationCopy: Record<
  PrivacyAction,
  { title: string; body: string; confirm: string }
> = {
  export: {
    title: "Export my data?",
    body: "Atlas will prepare a JSON file of your account profile. Saved views, saved investigations, and an artifact library are not stored, so they are not in the export. Unlinked Amplitude sessions and browser-only chat history are omitted. Feedback export includes only this account's category, route, received time, message, and whether a contact email existed, not other people's reports. Completion is targeted within 30 days. Public Atlas datasets are unaffected. The download is available for a limited time after completion. If Atlas cannot complete the request, this page will show a support status and a request reference.",
    confirm: "Export my data",
  },
  deletion: {
    title: "Remove all data?",
    body: "This permanently deletes your Atlas account and profile. It cannot be undone. Feedback contact fields and account linkage for this account are removed; submitted feedback text is retained. Saved views, saved investigations, and an artifact library are not stored. Unlinked Amplitude sessions expire after 90 days and cannot be looked up by account. Browser chat history stays on this device until you clear it. Public Atlas datasets and methodology are unaffected. Completion is targeted within 30 days. If Atlas cannot complete the request, this page will show a support status and a request reference.",
    confirm: "Remove all data",
  },
};

function privacyRequestHeaders(accessToken: string): {
  headers: { Authorization: string };
} {
  return { headers: { Authorization: `Bearer ${accessToken}` } };
}

function downloadJson(payload: unknown) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "atlas-user-data-export.json";
  link.click();
  URL.revokeObjectURL(url);
}

export function AccountDataRights({
  returnPath = "/account",
}: {
  returnPath?: string;
}) {
  const router = useRouter();
  const queryClient = useContext(QueryClientContext) ?? null;
  const [pending, setPending] = useState<PrivacyAction | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const operationGenerationRef = useRef(0);

  const readSessionStamp =
    useCallback(async (): Promise<PrivacySessionSnapshot> => {
      try {
        const { data, error } = await createClient().auth.getSession();
        if (error || !data.session) {
          return {
            accessToken: null,
            issuedAtMs: null,
            present: false,
            userId: null,
          };
        }
        const accessToken = data.session.access_token;
        const boundToken =
          typeof accessToken === "string" && accessToken.length > 0
            ? accessToken
            : null;
        return {
          accessToken: boundToken,
          issuedAtMs: boundToken ? accessTokenIssuedAtMs(boundToken) : null,
          present: true,
          userId: privacyReauthSubjectId(data.session.user?.id),
        };
      } catch {
        return {
          accessToken: null,
          issuedAtMs: null,
          present: false,
          userId: null,
        };
      }
    }, []);

  const accessTokenForSubject = useCallback(
    async (subjectId: string): Promise<string | null> => {
      const stamp = await readSessionStamp();
      if (stamp.userId !== subjectId) return null;
      return stamp.accessToken;
    },
    [readSessionStamp]
  );

  const executeRequest = useCallback(
    async (action: PrivacyAction, subjectId: string) => {
      operationGenerationRef.current += 1;
      const generation = operationGenerationRef.current;
      const operationCurrent = () =>
        operationGenerationRef.current === generation;
      // `undefined` means this mount or a newer operation ended while the read was in flight.
      const liveSubject = async (): Promise<string | null | undefined> => {
        const stamp = await readSessionStamp();
        if (!operationCurrent()) return undefined;
        return stamp.userId;
      };
      const sameAccount = async () => (await liveSubject()) === subjectId;

      const createToken = await accessTokenForSubject(subjectId);
      if (!createToken || !operationCurrent()) return;
      setBusy(true);
      setNotice(null);
      try {
        const created = await createPrivacyRequest(
          { action },
          privacyRequestHeaders(createToken)
        );
        if (!operationCurrent()) return;
        if (created.status !== 200) {
          throw new Error("Privacy request was not accepted.");
        }
        const confirmToken = await accessTokenForSubject(subjectId);
        if (!confirmToken || !operationCurrent()) return;
        const confirmed = await confirmPrivacyRequest(
          created.data.request_id,
          { nonce: created.data.confirmation_nonce },
          privacyRequestHeaders(confirmToken)
        );
        if (!(await sameAccount())) return;
        if (confirmed.status !== 200) {
          throw new Error("Privacy request confirmation failed.");
        }
        if (confirmed.data.state === "needs_support") {
          setNotice(
            `This request needs support. Public Atlas exploration remains available. Reference: ${created.data.request_id}.`
          );
          return;
        }
        if (action === "export") {
          const downloadToken = await accessTokenForSubject(subjectId);
          if (!downloadToken || !operationCurrent()) return;
          const file = await downloadPrivacyExport(
            created.data.request_id,
            privacyRequestHeaders(downloadToken)
          );
          if (!(await sameAccount())) return;
          if (file.status !== 200) {
            throw new Error("Export download failed.");
          }
          downloadJson(file.data);
          setNotice("Your data export downloaded.");
          return;
        }
        const result = await runWorkspaceSignOut(queryClient);
        const userId = await liveSubject();
        const replacementAccount =
          userId !== null && userId !== undefined && userId !== subjectId;
        if (userId === undefined || replacementAccount) return;
        if (result === null) return;
        if (!result.ok) {
          if (userId === subjectId) setNotice(result.notice);
          return;
        }
        followWorkspaceHref("/");
      } catch (error) {
        if (!(await sameAccount())) return;
        if (error instanceof AtlasApiError && error.status === 401) {
          if (!workspaceSignOutSuppressesExpiryRedirect()) {
            router.push(signInHrefForReturnPath(returnPath));
          }
          return;
        }
        const reference =
          error instanceof AtlasApiError && error.requestId
            ? ` Reference: ${error.requestId}.`
            : "";
        setNotice(`${PRIVACY_REQUEST_FAILURE}${reference}`);
      } finally {
        if (operationCurrent()) {
          setBusy(false);
          setPending(null);
        }
      }
    },
    [accessTokenForSubject, queryClient, readSessionStamp, returnPath, router]
  );

  const requireFreshSignIn = useCallback(
    async (action: PrivacyAction) => {
      setBusy(true);
      setNotice(null);
      const nowMs = Date.now();
      let challenge: PrivacyReauthChallenge | null = null;
      try {
        const stamp = await readSessionStamp();
        if (stamp.userId === null) {
          if (stamp.present) {
            setNotice(PRIVACY_REQUEST_FAILURE);
            return;
          }
          setNotice(PRIVACY_REAUTH_CONTINUE_NOTICE);
          router.push(signInHrefForReturnPath(returnPath));
          return;
        }
        challenge = {
          action,
          challengedAtMs: nowMs,
          nonce: crypto.randomUUID(),
          previousIssuedAtMs: previousIssuedAtForReauth(stamp, nowMs),
          subjectId: stamp.userId,
        };
        savePrivacyReauthChallenge(challenge);
        const signedOut = await endLocalAtlasSession(queryClient);
        if (!signedOut.ok) {
          clearPrivacyReauthChallenge();
          setNotice(signedOut.notice);
          return;
        }
        setNotice(PRIVACY_REAUTH_CONTINUE_NOTICE);
        router.push(signInHrefForReturnPath(returnPath));
      } catch {
        if (challenge) clearPrivacyReauthChallenge();
        setNotice(PRIVACY_REQUEST_FAILURE);
      } finally {
        setBusy(false);
        setPending(null);
      }
    },
    [queryClient, readSessionStamp, returnPath, router]
  );

  const executeRequestRef = useRef(executeRequest);
  const readSessionStampRef = useRef(readSessionStamp);
  useEffect(() => {
    executeRequestRef.current = executeRequest;
    readSessionStampRef.current = readSessionStamp;
  }, [executeRequest, readSessionStamp]);

  useEffect(() => {
    const challenge = readPrivacyReauthChallenge();
    if (!challenge || !beginPrivacyReauthResume(challenge.nonce)) return;
    let ignore = false;
    const resume = async () => {
      try {
        const stamp = await readSessionStampRef.current();
        if (ignore) return;
        const disposition = privacyReauthResumeDisposition(
          challenge,
          stamp,
          Date.now()
        );
        if (disposition === "clear") {
          clearPrivacyReauthChallenge();
          return;
        }
        if (disposition === "wait") return;
        disposition satisfies "run";
        const claimed = claimPrivacyReauthChallenge(challenge.nonce);
        if (!claimed || ignore) return;
        await executeRequestRef.current(claimed.action, claimed.subjectId);
      } finally {
        endPrivacyReauthResume(challenge.nonce);
      }
    };
    void resume();
    return () => {
      ignore = true;
      operationGenerationRef.current += 1;
    };
  }, []);

  return (
    <section className="mt-10 space-y-4" aria-labelledby="data-rights-heading">
      <h2 id="data-rights-heading" className="text-xl font-semibold">
        Your data
      </h2>
      <p className="text-muted-foreground text-sm">
        Export or remove the account profile connected to this sign-in. These
        actions are not sent to product analytics.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => setPending("export")}
        >
          Export my data
        </Button>
        <Button
          type="button"
          variant="destructive"
          onClick={() => setPending("deletion")}
        >
          Remove all data
        </Button>
      </div>
      {notice ? (
        <p role="status" aria-live="polite" className="text-sm">
          {notice}
        </p>
      ) : null}
      <Dialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open && !busy) setPending(null);
        }}
      >
        <DialogContent aria-labelledby="data-rights-confirm-title">
          {pending === null ? null : (
            <>
              <DialogHeader>
                <DialogTitle id="data-rights-confirm-title">
                  {confirmationCopy[pending].title}
                </DialogTitle>
                <DialogDescription>
                  {confirmationCopy[pending].body}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={busy}
                  onClick={() => setPending(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant={pending === "deletion" ? "destructive" : "default"}
                  disabled={busy}
                  onClick={() => {
                    void requireFreshSignIn(pending);
                  }}
                >
                  {busy ? "Working…" : confirmationCopy[pending].confirm}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
