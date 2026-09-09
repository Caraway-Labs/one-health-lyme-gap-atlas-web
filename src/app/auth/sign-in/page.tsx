"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { safeReturnPath } from "@/lib/auth/return-path";
import { createClient } from "@/lib/supabase/client";

export default function SignInPage() {
  const searchParams = useSearchParams();
  const next = safeReturnPath(searchParams.get("next"));
  const [email, setEmail] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function signInWithGoogle() {
    setBusy(true); setNotice(null);
    try {
      const { error } = await createClient().auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` } });
      if (error) setNotice("Google sign-in is unavailable. Please try again.");
    } catch { setNotice("Account sign-in is not configured."); }
    finally { setBusy(false); }
  }

  async function sendMagicLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setNotice(null);
    try {
      const { error } = await createClient().auth.signInWithOtp({ email, options: { emailRedirectTo: `${window.location.origin}/auth/confirm?next=${encodeURIComponent(next)}` } });
      setNotice(error ? "We could not send a sign-in link. Please try again." : "If that address can receive Atlas sign-in email, a link is on its way.");
    } catch { setNotice("Account sign-in is not configured."); }
    finally { setBusy(false); }
  }

  return <main className="container py-12"><section className="mx-auto max-w-md space-y-6"><div><p className="eyebrow">Optional account</p><h1 className="text-3xl font-semibold">Sign in to Atlas</h1><p className="mt-2 text-muted-foreground">Accounts are optional. You can continue exploring public Atlas information without one.</p></div><Button className="w-full" onClick={signInWithGoogle} disabled={busy}>Continue with Google</Button><form onSubmit={sendMagicLink} className="space-y-3"><label className="block text-sm font-medium" htmlFor="email">Email address</label><Input id="email" name="email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} /><Button className="w-full" type="submit" variant="secondary" disabled={busy}>Email me a sign-in link</Button></form>{notice && <p role="status" aria-live="polite" className="text-sm text-muted-foreground">{notice}</p>}<Link className="text-sm underline" href={next}>Continue without an account</Link></section></main>;
}
