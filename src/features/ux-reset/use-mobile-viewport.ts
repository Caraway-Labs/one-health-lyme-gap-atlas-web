"use client";

import { useEffect, useState } from "react";

const MOBILE_NAV_MEDIA = "(max-width: 800px)";

export function useMobileViewport(): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") {
      return;
    }
    const media = window.matchMedia(MOBILE_NAV_MEDIA);
    const update = () => setIsMobile(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return isMobile;
}
