import {
  type PublicOrigins,
  resolvePublicOrigins,
  rewritePublicOriginText,
} from "./public-origins";

type OriginNode = {
  children?: OriginNode[];
  type: string;
  url?: string;
  value?: string;
};

const TEXT_NODES = new Set(["text", "code", "inlineCode", "html"]);

export function rewriteOriginTree(
  tree: OriginNode,
  origins: PublicOrigins
): void {
  if (typeof tree.url === "string") {
    tree.url = rewritePublicOriginText(tree.url, origins);
  }
  if (TEXT_NODES.has(tree.type) && typeof tree.value === "string") {
    tree.value = rewritePublicOriginText(tree.value, origins);
  }
  if (!tree.children) return;
  for (const child of tree.children) rewriteOriginTree(child, origins);
}

/** Fumadocs compile step. Reads the public origin env for this build. */
export function remarkPublicOrigins() {
  return (tree: OriginNode) => {
    rewriteOriginTree(tree, resolvePublicOrigins());
  };
}
