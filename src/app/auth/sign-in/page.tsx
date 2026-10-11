import { Suspense } from "react";

import { SignInEntrance } from "@/app/auth/sign-in/sign-in-entrance";

export default function SignInPage() {
  return (
    <Suspense
      fallback={
        <main className="auth-entrance-main">
          <p>Loading sign-in…</p>
        </main>
      }
    >
      <SignInEntrance />
    </Suspense>
  );
}
