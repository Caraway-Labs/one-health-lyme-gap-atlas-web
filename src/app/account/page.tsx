"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

export default function AccountPage() {
  const router = useRouter();
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  useEffect(() => {
    async function loadSession() {
      try {
        const result = await createClient().auth.getUser();
        setSignedIn(Boolean(result.data.user));
      } catch {
        setSignedIn(false);
      }
    }
    void loadSession();
  }, []);
  if (signedIn === null) return <main className="container py-12">Checking account session…</main>;
  if (!signedIn) return <main className="container py-12"><h1 className="text-3xl font-semibold">Your account</h1><p className="mt-2 text-muted-foreground">Sign in to manage your optional Atlas profile.</p><Button className="mt-6" render={<Link href="/auth/sign-in?next=%2Faccount" />}>Sign in</Button></main>;
  return <main className="container py-12"><p className="eyebrow">Optional account</p><h1 className="text-3xl font-semibold">Your profile</h1><p className="mt-2 text-muted-foreground">Profile setup will be available after the private Atlas API is deployed.</p><Button className="mt-6" variant="secondary" onClick={() => createClient().auth.signOut().then(() => router.push("/"))}>Sign out</Button></main>;
}
