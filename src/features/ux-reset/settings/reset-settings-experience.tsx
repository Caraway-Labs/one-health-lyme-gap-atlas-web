"use client";

import { resetRouteById } from "@/features/ux-reset/paths";
import { DefaultJurisdictionReadout } from "@/features/ux-reset/settings/default-jurisdiction-readout";

export function ResetSettingsExperience() {
  const route = resetRouteById("settings");

  return (
    <>
      <header className="ux-reset-page-header">
        <p className="eyebrow">UX Reset professional workspace</p>
        <h1>{route.label}</h1>
        <p className="type-body">{route.description}</p>
      </header>
      <DefaultJurisdictionReadout />
    </>
  );
}
