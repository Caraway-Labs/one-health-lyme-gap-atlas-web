import { AssistantDemo } from "@/features/assistant/assistant-demo";
import { isAssistantDemoEnabled } from "@/features/assistant/feature-flag";

export const metadata = { title: "Talk with the Atlas demo" };

export default function AssistantDemoPage() {
  if (
    !isAssistantDemoEnabled(
      process.env.NEXT_PUBLIC_ATLAS_ASSISTANT_DEMO_ENABLED
    )
  ) {
    return (
      <main className="mx-auto max-w-3xl p-8">
        <h1>Talk with the Atlas is not enabled</h1>
        <p>
          The assistant demo is feature-gated while its governed backend is
          under review.
        </p>
      </main>
    );
  }
  return (
    <main className="mx-auto max-w-3xl p-8">
      <header className="mb-6">
        <p className="text-muted-foreground text-sm">
          Feature-gated development demo
        </p>
        <h1 className="text-3xl font-semibold">Talk with the Atlas</h1>
        <p>
          This local fixture demonstrates the approved UI boundary only. It is
          not medical advice and does not retrieve live Atlas data.
        </p>
      </header>
      <AssistantDemo />
    </main>
  );
}
