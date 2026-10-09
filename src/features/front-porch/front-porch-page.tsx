import { AnalyticsClient } from "@/components/analytics-client";
import {
  frontPorchBodyFont,
  frontPorchHeroFont,
} from "@/features/front-porch/front-porch-font";
import { readFrontPorchSignedIn } from "@/features/front-porch/front-porch-session";
import { FrontPorchView } from "@/features/front-porch/front-porch-view";
import { LegacyRootFragmentRedirect } from "@/features/front-porch/legacy-root-fragment-redirect";

export async function FrontPorchPage() {
  const signedIn = await readFrontPorchSignedIn();

  return (
    <>
      <LegacyRootFragmentRedirect />
      <AnalyticsClient />
      <FrontPorchView
        heroFontClassName={`${frontPorchHeroFont.variable} ${frontPorchBodyFont.variable}`}
        signedIn={signedIn}
      />
    </>
  );
}
