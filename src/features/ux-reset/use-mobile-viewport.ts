"use client";

import { useSyncExternalStore } from "react";

const MOBILE_NAV_MEDIA = "(max-width: 800px)";

function getMobileSnapshot(): boolean {
  return window.matchMedia(MOBILE_NAV_MEDIA).matches;
}

function getServerMobileSnapshot(): boolean {
  return false;
}

function subscribeMobileViewport(onStoreChange: () => void): () => void {
  const media = window.matchMedia(MOBILE_NAV_MEDIA);
  media.addEventListener("change", onStoreChange);
  return () => media.removeEventListener("change", onStoreChange);
}

export function useMobileViewport(): boolean {
  return useSyncExternalStore(
    subscribeMobileViewport,
    getMobileSnapshot,
    getServerMobileSnapshot
  );
}
