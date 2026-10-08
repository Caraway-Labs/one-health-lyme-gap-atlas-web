import { FrontPorchPage } from "@/features/front-porch/front-porch-page";
import { pageMetadataForRoute } from "@/lib/navigation";

export const metadata = pageMetadataForRoute("/");

// The public root must reflect the current Front Porch after each deployment.
export const dynamic = "force-dynamic";

export default function Page() {
  return <FrontPorchPage />;
}
