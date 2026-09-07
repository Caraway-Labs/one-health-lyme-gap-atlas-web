"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  honorsDoNotTrack,
  readAnalyticsPreference,
  writeAnalyticsPreference,
  type AnalyticsConsentState,
} from "@/lib/analytics-consent";

export function PrivacyPreferences() {
  const [consent, setConsent] =
    useState<AnalyticsConsentState>("not-decided");
  const [doNotTrack, setDoNotTrack] = useState(false);

  useEffect(() => {
    setDoNotTrack(honorsDoNotTrack(navigator));
    setConsent(readAnalyticsPreference(localStorage));
  }, []);

  const saveChoice = (decision: "granted" | "denied") => {
    setConsent(writeAnalyticsPreference(localStorage, decision));
  };

  const choiceSummary = doNotTrack
    ? "Your browser's Do Not Track preference is on. Atlas will keep optional analytics off."
    : consent === "granted"
      ? "Optional analytics are allowed for this browser until this preference expires or you change it."
      : consent === "denied"
        ? "Optional analytics are off for this browser."
        : consent === "storage-unavailable"
          ? "Atlas cannot save a preference in this browser, so optional analytics remain off."
          : "Optional analytics are off until you make a choice.";

  return (
    <Dialog>
      <DialogTrigger render={<Button variant="link" className="footer-link" />}>
        Privacy settings
      </DialogTrigger>
      <DialogContent aria-labelledby="privacy-settings-title">
        <DialogHeader>
          <span className="eyebrow">Your choice</span>
          <DialogTitle id="privacy-settings-title">Privacy settings</DialogTitle>
          <DialogDescription>
            Public Atlas exploration works the same whether you allow or decline
            optional product analytics. Atlas does not use product analytics yet.
          </DialogDescription>
        </DialogHeader>
        <p>{choiceSummary}</p>
        <p className="text-muted-foreground text-sm">
          This setting stores only your choice, its date, expiry, and a format
          version in this browser for up to six months. It does not create an
          analytics identifier or send an event.
        </p>
        <DialogFooter>
          <Button onClick={() => saveChoice("denied")} variant="secondary">
            Keep optional analytics off
          </Button>
          <Button
            disabled={doNotTrack}
            onClick={() => saveChoice("granted")}
          >
            Allow optional analytics
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
