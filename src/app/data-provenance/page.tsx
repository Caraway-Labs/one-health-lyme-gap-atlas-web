import { pageMetadataForRoute } from "@/lib/navigation";

export { DataProvenancePage as default } from "@/features/public-trust/data-provenance-page";

export const metadata = {
  ...pageMetadataForRoute("/data-provenance"),
  alternates: { canonical: "/data-provenance" },
};
