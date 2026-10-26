/**
 * Explicit local preview of the signed-in shell.
 * Development only. A production build inlines NODE_ENV as "production", so
 * the flag cannot open the workspace there even if it is present at runtime.
 */
export function localPreviewOptIn(input: {
  nodeEnv: string | undefined;
  previewFlag: string | undefined;
}): boolean {
  return input.nodeEnv === "development" && input.previewFlag === "1";
}

export function localPreviewRequested(): boolean {
  return localPreviewOptIn({
    nodeEnv: process.env.NODE_ENV,
    previewFlag: process.env.NEXT_PUBLIC_ATLAS_LOCAL_PREVIEW,
  });
}
