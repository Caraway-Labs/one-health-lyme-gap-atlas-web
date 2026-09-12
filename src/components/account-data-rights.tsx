"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  confirmPrivacyRequestV1MePrivacyRequestsRequestIdConfirmPost,
  createPrivacyRequestV1MePrivacyRequestsPost,
  downloadPrivacyExportV1MePrivacyRequestsRequestIdExportGet,
} from "@/generated/atlas";
import { AtlasApiError } from "@/lib/api-mutator";
import { createClient } from "@/lib/supabase/client";

type PrivacyAction = "export" | "deletion";

const confirmationCopy: Record<
  PrivacyAction,
  { title: string; body: string; confirm: string }
> = {
  export: {
    title: "Export my data?",
    body: "Atlas will prepare a JSON file of your account profile. Saved workspaces, in-product feedback, unlinked Amplitude sessions, and browser-only chat history are omitted. Completion is targeted within 30 days. Public Atlas datasets are unaffected. The download is available for a limited time after completion. If Atlas cannot complete the request, this page will show a support status and a request reference.",
    confirm: "Export my data",
  },
  deletion: {
    title: "Remove all data?",
    body: "This permanently deletes your Atlas account and profile. It cannot be undone. Saved workspaces and feedback stores are not launched. Unlinked Amplitude sessions expire after 90 days and cannot be looked up by account. Browser chat history stays on this device until you clear it. Public Atlas datasets and methodology are unaffected. Completion is targeted within 30 days. If Atlas cannot complete the request, this page will show a support status and a request reference.",
    confirm: "Remove all data",
  },
};

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

export function AccountDataRights() {
  const router = useRouter();
  const [pending, setPending] = useState<PrivacyAction | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  async function runRequest(action: PrivacyAction) {
    setBusy(true);
    setNotice(null);
    try {
      const created = await createPrivacyRequestV1MePrivacyRequestsPost({
        action,
      });
      if (created.status !== 200) {
        throw new Error("Privacy request was not accepted.");
      }
      const confirmed =
        await confirmPrivacyRequestV1MePrivacyRequestsRequestIdConfirmPost(
          created.data.request_id,
          { nonce: created.data.confirmation_nonce }
        );
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
        const file =
          await downloadPrivacyExportV1MePrivacyRequestsRequestIdExportGet(
            created.data.request_id
          );
        if (file.status !== 200) {
          throw new Error("Export download failed.");
        }
        downloadJson(file.data);
        setNotice("Your data export downloaded.");
        return;
      }
      await createClient().auth.signOut();
      router.push("/");
    } catch (error) {
      if (error instanceof AtlasApiError && error.status === 401) {
        router.push("/auth/sign-in?next=%2Faccount");
        return;
      }
      const reference =
        error instanceof AtlasApiError && error.requestId
          ? ` Reference: ${error.requestId}.`
          : "";
      setNotice(
        `We could not complete that privacy request. Please try again later.${reference}`
      );
    } finally {
      setBusy(false);
      setPending(null);
    }
  }

  const copy = pending ? confirmationCopy[pending] : null;

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
          {copy ? (
            <>
              <DialogHeader>
                <DialogTitle id="data-rights-confirm-title">
                  {copy.title}
                </DialogTitle>
                <DialogDescription>{copy.body}</DialogDescription>
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
                    if (pending) void runRequest(pending);
                  }}
                >
                  {busy ? "Working…" : copy.confirm}
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </section>
  );
}
