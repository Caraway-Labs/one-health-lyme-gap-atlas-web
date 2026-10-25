import {
  findPath,
  type Folder,
  type Item,
  type Node,
  type Root,
} from "fumadocs-core/page-tree";

/** Docs home. Stays the Product guide tab target. */
export const DOCS_HOME_PATH = "/docs";

export const PRODUCT_GUIDE_TAB = "Product guide";

const PRODUCT_GUIDE_ID = "docs-tab-product-guide";

/**
 * Group loose top-level pages into a Product guide root folder.
 * `develop` and `api-reference` stay where they are and become the other tabs
 * when their meta.json sets `"root": true`. Page files and URLs do not move.
 */
export function withDocsSidebarTabs(tree: Root): Root {
  const sectionRoots: Node[] = [];
  const productChildren: Node[] = [];
  for (const child of tree.children) {
    if (child.type === "folder" && child.root) {
      sectionRoots.push(child);
      continue;
    }
    productChildren.push(child);
  }

  const home = productChildren.find(
    (node): node is Item => node.type === "page" && node.url === DOCS_HOME_PATH
  );
  const productGuide: Folder = {
    $id: PRODUCT_GUIDE_ID,
    children: productChildren,
    index: home,
    name: PRODUCT_GUIDE_TAB,
    root: true,
    type: "folder",
  };

  return {
    ...tree,
    children: [productGuide, ...sectionRoots],
  };
}

function normalizedPath(value: string): string {
  if (value.length > 1 && value.endsWith("/")) return value.slice(0, -1);
  return value;
}

/**
 * A tab is current when the URL is a real page in that root folder.
 * Cross-links (a Quickstart link inside Product guide) have no file `$ref`
 * and do not make a second tab current.
 */
export function isDocsTabCurrent(
  folder: Folder | undefined,
  pathname: string
): boolean {
  if (!folder) return false;
  const current = normalizedPath(pathname);
  const match = findPath(
    folder.children,
    (node) =>
      node.type === "page" &&
      node.$ref !== undefined &&
      normalizedPath(node.url) === current
  );
  return match !== null;
}
