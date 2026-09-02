import { EvidenceChat } from "@/components/evidence-chat";

interface KnowledgeGraphPageProps {
  searchParams: Promise<{ conversation?: string | string[] }>;
}

export const metadata = {
  description:
    "Ask questions grounded in reviewed PubMed and PMC Open Access literature.",
  title: "Knowledge Graph Evidence | One Health Lyme Gap Atlas",
};

export default async function KnowledgeGraphPage({
  searchParams,
}: KnowledgeGraphPageProps) {
  if (process.env.NEXT_PUBLIC_KG_CHAT_ENABLED !== "true") {
    return (
      <main className="knowledge-workspace">
        <section className="chat-panel">
          <header>
            <div>
              <span className="kicker">Reviewed literature</span>
              <h1>Knowledge graph evidence workspace</h1>
            </div>
          </header>
          <p className="medical-notice">
            The evidence workspace is not yet enabled.
          </p>
        </section>
      </main>
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
