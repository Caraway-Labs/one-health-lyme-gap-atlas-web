import { useEffect, useRef } from "react";
import type { RefObject } from "react";

/** Listen for clicks without putting a handler on a non-interactive element. */
export function useDomClick(
  onClick: (event: MouseEvent) => void
): RefObject<HTMLDivElement | null> {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node) {
      return;
    }
    node.addEventListener("click", onClick);
    return () => node.removeEventListener("click", onClick);
  }, [onClick]);
  return ref;
}
