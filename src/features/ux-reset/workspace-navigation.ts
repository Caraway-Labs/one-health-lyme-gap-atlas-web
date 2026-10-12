export type WorkspaceHistoryMode = "assign" | "replace";

/** Full navigation so a later Back or reload rechecks the session. */
export function followWorkspaceHref(
  href: string,
  history: WorkspaceHistoryMode = "assign"
): void {
  switch (history) {
    case "assign": {
      window.location.assign(href);
      return;
    }
    case "replace": {
      window.location.replace(href);
      return;
    }
    default: {
      const exhaustive: never = history;
      throw new Error(
        `Unsupported workspace navigation: ${String(exhaustive)}`
      );
    }
  }
}
