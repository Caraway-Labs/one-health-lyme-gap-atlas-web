/** Public API concurrent read limit shared by Compare county records and observations. */
export const COMPARE_PUBLIC_READ_LIMIT = 5;

type ReadWaiter = {
  grant: () => void;
  reject: (error: DOMException) => void;
};

let activeReads = 0;
const readWaiters: ReadWaiter[] = [];

/** Test isolation. In-flight reads must already have settled or aborted. */
export function resetCompareReadLimit(): void {
  activeReads = 0;
  const pending = readWaiters.splice(0);
  for (const waiter of pending) {
    waiter.reject(new DOMException("Aborted", "AbortError"));
  }
}

function releaseCompareRead(): void {
  activeReads = Math.max(0, activeReads - 1);
  const next = readWaiters.shift();
  if (!next) {
    return;
  }
  activeReads += 1;
  next.grant();
}

/**
 * Holds one of the five public read slots until `read` settles.
 * Callers beyond the limit wait, so county records and observations cannot
 * exceed the limit together.
 */
export async function withCompareReadLimit<T>(
  signal: AbortSignal,
  read: () => Promise<T>
): Promise<T> {
  if (signal.aborted) {
    throw new DOMException("Aborted", "AbortError");
  }
  if (activeReads < COMPARE_PUBLIC_READ_LIMIT) {
    activeReads += 1;
  } else {
    const { promise, reject, resolve } = Promise.withResolvers<boolean>();
    const waiter: ReadWaiter = {
      grant: () => {
        resolve(true);
      },
      reject: (error) => {
        reject(error);
      },
    };
    const onAbort = () => {
      const index = readWaiters.indexOf(waiter);
      if (index !== -1) {
        readWaiters.splice(index, 1);
      }
      waiter.reject(new DOMException("Aborted", "AbortError"));
    };
    signal.addEventListener("abort", onAbort, { once: true });
    readWaiters.push(waiter);
    try {
      await promise;
    } finally {
      signal.removeEventListener("abort", onAbort);
    }
  }
  try {
    return await read();
  } finally {
    releaseCompareRead();
  }
}
