"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { EvidenceChat } from "./evidence-chat";

export function ChatLauncher() {
  if (process.env.NEXT_PUBLIC_KG_CHAT_ENABLED !== "true") {
    return null;
  }
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

  return (
    <>
      <button
        ref={launcher}
        className="chat-launcher"
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        Ask the evidence
      </button>
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
            aria-label="Ask the evidence"
          >
            <button
              className="chat-close"
              type="button"
              aria-label="Close evidence chat"
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
