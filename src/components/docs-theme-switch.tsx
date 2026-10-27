"use client";

import { useTheme } from "fumadocs-ui/provider/base";
import { Monitor, Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";

import { cn } from "@/lib/utils";

function subscribeToNothing(): () => void {
  return () => {};
}

function useIsClient(): boolean {
  return useSyncExternalStore(
    subscribeToNothing,
    () => true,
    () => false
  );
}

const THEME_OPTIONS = [
  { icon: Sun, label: "Light", value: "light" },
  { icon: Moon, label: "Dark", value: "dark" },
  { icon: Monitor, label: "System", value: "system" },
] as const;

/**
 * Light, dark, and system choice for the docs header. The pressed state is
 * withheld until mount so the server HTML matches the first client render.
 */
export function DocsThemeSwitch({ className }: { className?: string }) {
  const { setTheme, theme } = useTheme();
  const mounted = useIsClient();

  return (
    <div
      aria-label="Theme"
      className={cn(
        "inline-flex items-center rounded-full border p-0.5",
        className
      )}
      data-docs-theme-switch=""
      role="group"
    >
      {THEME_OPTIONS.map((option) => {
        const Icon = option.icon;
        const pressed = mounted && theme === option.value;
        return (
          <button
            aria-label={option.label}
            aria-pressed={pressed}
            className={cn(
              "text-fd-muted-foreground rounded-full p-1.5",
              pressed && "bg-fd-accent text-fd-accent-foreground"
            )}
            key={option.value}
            onClick={() => {
              setTheme(option.value);
            }}
            type="button"
          >
            <Icon aria-hidden="true" className="size-4" />
          </button>
        );
      })}
    </div>
  );
}
