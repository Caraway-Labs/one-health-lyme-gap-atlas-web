import { Suspense } from "react";

import {
  SignInEntrance,
  SignInIdentity,
} from "@/app/auth/sign-in/sign-in-entrance";

export default function SignInPage() {
  return (
    <Suspense
      fallback={
        <div className="auth-entrance">
          <SignInIdentity />
          <main className="auth-entrance-main">
            <p>Loading sign-in…</p>
          </main>
        </div>
      }
    >
      <SignInEntrance />
    </Suspense>
  );
}
