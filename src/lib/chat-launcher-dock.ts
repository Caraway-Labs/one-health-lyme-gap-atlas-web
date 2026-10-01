const INSET_SELECTOR = '[data-slot="sidebar-inset"]';

export function syncChatLauncherDockInsets(): void {
  const inset = document.querySelector<HTMLElement>(INSET_SELECTOR);
  if (!inset) {
    document.documentElement.style.removeProperty("--chat-launcher-dock-left");
    document.documentElement.style.removeProperty("--chat-launcher-dock-width");
    return;
  }
  const { left, width } = inset.getBoundingClientRect();
  document.documentElement.style.setProperty(
    "--chat-launcher-dock-left",
    `${left}px`
  );
  document.documentElement.style.setProperty(
    "--chat-launcher-dock-width",
    `${width}px`
  );
}

export function clearChatLauncherDockInsets(): void {
  document.documentElement.style.removeProperty("--chat-launcher-dock-left");
  document.documentElement.style.removeProperty("--chat-launcher-dock-width");
}

export function observeChatLauncherDockInsets(): () => void {
  const inset = document.querySelector<HTMLElement>(INSET_SELECTOR);
  if (!inset) {
    return () => {
      clearChatLauncherDockInsets();
    };
  }

  const update = () => syncChatLauncherDockInsets();
  update();

  const resizeObserver = new ResizeObserver(update);
  resizeObserver.observe(inset);

  const sidebar = document.querySelector<HTMLElement>('[data-slot="sidebar"]');
  if (sidebar) {
    resizeObserver.observe(sidebar);
  }

  window.addEventListener("resize", update, { passive: true });
  window.addEventListener("scroll", update, { passive: true });

  return () => {
    resizeObserver.disconnect();
    window.removeEventListener("resize", update);
    window.removeEventListener("scroll", update);
    clearChatLauncherDockInsets();
  };
}
