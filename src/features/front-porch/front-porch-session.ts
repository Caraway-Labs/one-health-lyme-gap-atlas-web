import { isSupabaseAuthConfigured } from "@/lib/auth/app-route-guard";
import { createClient } from "@/lib/supabase/server";

export async function readFrontPorchSignedIn(): Promise<boolean> {
  const configured = isSupabaseAuthConfigured(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  );
  if (!configured) {
    return false;
  }

  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    return Boolean(data.user);
  } catch {
    return false;
  }
}
