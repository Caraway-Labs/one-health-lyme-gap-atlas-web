"use client";

import {
  createContext,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  inheritedContextPublicationKey,
  parseAskAtlasInheritedContext,
  type AskAtlasInheritedContext,
} from "@/features/ux-reset/ask-atlas/inherited-context";

type SetAskAtlasInheritedContext = (
  value: AskAtlasInheritedContext | null
) => void;

const AskAtlasInheritedContextValue =
  createContext<AskAtlasInheritedContext | null>(null);

const AskAtlasInheritedContextSet = createContext<SetAskAtlasInheritedContext>(
  () => {}
);

export function AskAtlasInheritedContextProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [value, setValue] = useState<AskAtlasInheritedContext | null>(null);
  const setContext = useMemo<SetAskAtlasInheritedContext>(() => setValue, []);
  return (
    <AskAtlasInheritedContextSet.Provider value={setContext}>
      <AskAtlasInheritedContextValue.Provider value={value}>
        {children}
      </AskAtlasInheritedContextValue.Provider>
    </AskAtlasInheritedContextSet.Provider>
  );
}

export function useAskAtlasInheritedContext(): AskAtlasInheritedContext | null {
  return useContext(AskAtlasInheritedContextValue);
}

/**
 * Publish the page's validated allowlist. Unmount and key changes clear the
 * previous snapshot so navigation cannot leave the prior county in place.
 */
export function usePublishAskAtlasInheritedContext(
  next: AskAtlasInheritedContext | null
): void {
  const setContext = useContext(AskAtlasInheritedContextSet);
  const publicationKey = inheritedContextPublicationKey(next);
  useLayoutEffect(() => {
    setContext(
      publicationKey ? parseAskAtlasInheritedContext(publicationKey) : null
    );
    return () => setContext(null);
  }, [publicationKey, setContext]);
}
