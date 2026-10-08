import { headers } from "next/headers";

import {
  FRONT_PORCH_SESSION_HEADER,
  isFrontPorchSignedInHeader,
} from "@/lib/auth/front-porch-session-header";

export async function readFrontPorchSignedIn(): Promise<boolean> {
  const headerStore = await headers();
  return isFrontPorchSignedInHeader(
    headerStore.get(FRONT_PORCH_SESSION_HEADER)
  );
}
