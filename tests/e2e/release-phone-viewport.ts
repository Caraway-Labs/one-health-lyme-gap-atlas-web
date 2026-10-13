export const phoneReleaseWidths = [320, 375, 390] as const;

// These stay on desktop. 640 is half of the 1280px Ask Atlas window (200% zoom).
// 740 is the short landscape height check, not a phone portrait.
export const desktopRetainedNarrowWidths = [640, 740] as const;

export const frontPorchCompositionViewports = [
  { height: 900, width: 1440 },
  { height: 800, width: 1280 },
  { height: 844, width: 390 },
  { height: 700, width: 320 },
] as const;

export const frontPorchBoundaryWidths = [
  320, 390, 768, 800, 801, 850, 851, 1024, 1440,
] as const;

export const publicTrustViewports = [
  { height: 800, width: 320 },
  { height: 844, width: 390 },
  { height: 900, width: 768 },
  { height: 800, width: 1280 },
  { height: 900, width: 1440 },
] as const;

export const feedbackPhoneViewport = { height: 844, width: 390 } as const;

export function isPhoneReleaseViewport(width: number): boolean {
  return phoneReleaseWidths.some((phoneWidth) => phoneWidth === width);
}

export function releaseViewportRuns(
  projectName: string,
  width: number
): boolean {
  const phone = isPhoneReleaseViewport(width);
  if (projectName === "mobile") {
    return phone;
  }
  return !phone;
}
