"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import {
  ATLAS_ASSISTANT_LAUNCHER_LABEL,
  atlasAssistantLauncherAccessibleName,
  shouldShowAtlasAssistantLauncher,
} from "@/lib/assistant-entry-points";
import { analyticsControlAttributes } from "@/lib/atlas-analytics";
import { observeChatLauncherDockInsets } from "@/lib/chat-launcher-dock";
import { chatLauncherPlacementForPath } from "@/lib/chat-launcher-placement";

import { EvidenceChat } from "./evidence-chat";

export function ChatLauncher() {
  return <EnabledChatLauncher />;
}

function EnabledChatLauncher() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const previousPathname = useRef(pathname);
  const launcher = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    dialog.current?.querySelector<HTMLTextAreaElement>("textarea")?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        launcher.current?.focus();
      }
      if (event.key === "Tab" && dialog.current) {
        const focusable = [
          ...dialog.current.querySelectorAll<HTMLElement>(
            "button, a, textarea:not([disabled])"
          ),
        ];
        const first = focusable[0];
        const last = focusable.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (previousPathname.current !== pathname) {
      setOpen(false);
    }
    previousPathname.current = pathname;
  }, [pathname]);

  const placement = chatLauncherPlacementForPath(pathname);
  const showLauncher = shouldShowAtlasAssistantLauncher(pathname);

  useEffect(() => {
    if (!showLauncher) {
      return;
    }
    document.documentElement.dataset.atlasChatLauncher = "enabled";
    document.documentElement.dataset.atlasChatLauncherPlacement = placement;
    const stopObserving = observeChatLauncherDockInsets();
    return () => {
      stopObserving();
      delete document.documentElement.dataset.atlasChatLauncher;
      delete document.documentElement.dataset.atlasChatLauncherPlacement;
    };
  }, [placement, showLauncher]);

  if (!showLauncher) {
    return null;
  }

  return (
    <>
      <div className={`chat-launcher-dock chat-launcher-dock--${placement}`}>
        <button
          ref={launcher}
          {...analyticsControlAttributes("evidence_chat_open")}
          className="chat-launcher"
          type="button"
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label={atlasAssistantLauncherAccessibleName()}
          onClick={() => setOpen(true)}
        >
          <span className="chat-launcher-title">
            {ATLAS_ASSISTANT_LAUNCHER_LABEL}
          </span>
          <span className="chat-launcher-early-access">Early access</span>
        </button>
      </div>
      {open && (
        <div
          className="chat-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setOpen(false);
              launcher.current?.focus();
            }
          }}
        >
          <div
            ref={dialog}
            className="chat-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="Atlas Assistant"
          >
            <button
              className="chat-close"
              {...analyticsControlAttributes("evidence_chat_close")}
              type="button"
              aria-label="Close Atlas Assistant"
              onClick={() => {
                setOpen(false);
                launcher.current?.focus();
              }}
            >
              ×
            </button>
            <EvidenceChat mode="drawer" />
          </div>
        </div>
      )}
    </>
  );
}
