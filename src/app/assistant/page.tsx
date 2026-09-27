import { ComingSoonPage } from "@/components/coming-soon-page";
import { EvidenceChat } from "@/components/evidence-chat";
import { pageMetadataForRoute } from "@/lib/navigation";

export const metadata = pageMetadataForRoute("/assistant");

interface AssistantPageProps {
  searchParams: Promise<{ conversation?: string | string[] }>;
}

export default async function AssistantPage({
  searchParams,
}: AssistantPageProps) {
  if (process.env.NEXT_PUBLIC_KG_CHAT_ENABLED !== "true") {
    return (
      <ComingSoonPage
        title="Atlas Assistant"
        description="Ask questions grounded in reviewed PubMed and PMC Open Access literature when early access is enabled."
      />
    );
  }
  const params = await searchParams;
  const selected =
    typeof params.conversation === "string" ? params.conversation : undefined;
  return (
    <main className="knowledge-workspace">
      <EvidenceChat initialConversationId={selected} />
    </main>
  );
}
