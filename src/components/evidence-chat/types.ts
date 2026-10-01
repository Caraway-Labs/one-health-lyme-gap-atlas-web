export type AssistantChatLayoutMode = "drawer" | "workspace";

export interface EvidenceChatProps {
  mode?: AssistantChatLayoutMode;
  initialConversationId?: string;
}
