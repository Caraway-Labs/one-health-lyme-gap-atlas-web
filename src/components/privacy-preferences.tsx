"use client";

import { useState, useSyncExternalStore } from "react";

import {
  ANALYTICS_PREFERENCE_CHANGED_EVENT,
  notifyAnalyticsPreferenceChanged,
} from "@/components/analytics-client";
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

const ANALYTICS_PURPOSE =
  "Public Atlas exploration works the same whether you allow or decline optional product analytics. Atlas does not use product analytics only after you explicitly allow them.";

const STORAGE_LIMITATION =
  "This setting stores only your choice, its date, expiry, and a format version in this browser for up to six months. It does not create an analytics identifier or send an event.";

export type PrivacyPreferencesPresentation = "dialog" | "section";

type PrivacyPreferencesProps = {
  presentation?: PrivacyPreferencesPresentation;
};

function subscribeAnalyticsPreference(onStoreChange: () => void): () => void {
  window.addEventListener(ANALYTICS_PREFERENCE_CHANGED_EVENT, onStoreChange);
  return () => {
    window.removeEventListener(
      ANALYTICS_PREFERENCE_CHANGED_EVENT,
      onStoreChange
    );
  };
}

function storedConsentSnapshot(): AnalyticsConsentState {
  return readAnalyticsPreference(localStorage);
}

function doNotTrackSnapshot(): boolean {
  return honorsDoNotTrack(navigator);
}

function analyticsChoiceSummary(
  consent: AnalyticsConsentState,
  doNotTrack: boolean
): string {
  if (doNotTrack) {
    return "Your browser's Do Not Track preference is on. Atlas will keep optional analytics off.";
  }
  switch (consent) {
    case "granted": {
      return "Optional analytics are allowed for this browser until this preference expires or you change it.";
    }
    case "denied": {
      return "Optional analytics are off for this browser.";
    }
    case "storage-unavailable": {
      return "Atlas cannot save a preference in this browser, so optional analytics remain off.";
    }
    case "not-decided": {
      return "Optional analytics are off until you make a choice.";
    }
    default: {
      const exhaustive: never = consent;
      return exhaustive;
    }
  }
}

function PrivacyChoiceActions({
  doNotTrack,
  saveChoice,
}: {
  doNotTrack: boolean;
  saveChoice: (decision: "granted" | "denied") => void;
}) {
  return (
    <>
      <Button
        onClick={() => saveChoice("denied")}
        type="button"
        variant="secondary"
      >
        Keep optional analytics off
      </Button>
      <Button
        disabled={doNotTrack}
        onClick={() => saveChoice("granted")}
        type="button"
      >
        Allow optional analytics
      </Button>
    </>
  );
}

function PrivacyChoiceCopy({
  consent,
  doNotTrack,
}: {
  consent: AnalyticsConsentState;
  doNotTrack: boolean;
}) {
  return (
    <>
      <p role="status">{analyticsChoiceSummary(consent, doNotTrack)}</p>
      <p className="text-muted-foreground text-sm">{STORAGE_LIMITATION}</p>
    </>
  );
}

export function PrivacyPreferences({
  presentation = "dialog",
}: PrivacyPreferencesProps) {
  const storedConsent = useSyncExternalStore(
    subscribeAnalyticsPreference,
    storedConsentSnapshot,
    () => "not-decided" as const
  );
  const doNotTrack = useSyncExternalStore(
    subscribeAnalyticsPreference,
    doNotTrackSnapshot,
    () => false
  );
  const [writeResult, setWriteResult] = useState<AnalyticsConsentState | null>(
    null
  );
  const consent = writeResult ?? storedConsent;

  const saveChoice = (decision: "granted" | "denied") => {
    if (decision === "granted" && honorsDoNotTrack(navigator)) {
      return;
    }
    const next = writeAnalyticsPreference(localStorage, decision);
    setWriteResult(next);
    notifyAnalyticsPreferenceChanged();
  };

  if (presentation === "section") {
    return (
      <section
        aria-labelledby="settings-privacy-heading"
        className="grid gap-3"
        data-testid="settings-privacy-preferences"
        id="privacy-settings"
      >
        <h2 className="type-card" id="settings-privacy-heading">
          Privacy settings
        </h2>
        <p className="type-body">
          Optional analytics. This browser choice does not change the required
          starting view or the optional profile fields.
        </p>
        <p className="type-body">{ANALYTICS_PURPOSE}</p>
        <PrivacyChoiceCopy consent={consent} doNotTrack={doNotTrack} />
        <div className="flex flex-wrap gap-2">
          <PrivacyChoiceActions
            doNotTrack={doNotTrack}
            saveChoice={saveChoice}
          />
        </div>
      </section>
    );
  }

  if (presentation !== "dialog") {
    const exhaustive: never = presentation;
    return exhaustive;
  }

  return (
    <Dialog
      onOpenChange={(isOpen) => {
        if (isOpen) {
          setWriteResult(null);
        }
      }}
    >
      <DialogTrigger render={<Button variant="link" className="footer-link" />}>
        Privacy settings
      </DialogTrigger>
      <DialogContent aria-labelledby="privacy-settings-title">
        <DialogHeader>
          <span className="eyebrow">Your choice</span>
          <DialogTitle id="privacy-settings-title">
            Privacy settings
          </DialogTitle>
          <DialogDescription>{ANALYTICS_PURPOSE}</DialogDescription>
        </DialogHeader>
        <PrivacyChoiceCopy consent={consent} doNotTrack={doNotTrack} />
        <DialogFooter>
          <PrivacyChoiceActions
            doNotTrack={doNotTrack}
            saveChoice={saveChoice}
          />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
