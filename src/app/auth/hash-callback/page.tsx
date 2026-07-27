"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Implicit-flow half of /auth/callback (see the comment there): reads
// access_token/refresh_token off the URL fragment left by an Admin-API-minted
// link (invite emails, or admin.generateLink() for testing) and establishes
// the session client-side, since fragments never reach the server.
export default function HashCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.slice(1));
    const access_token = params.get("access_token");
    const refresh_token = params.get("refresh_token");
    const next = searchParams.get("next") ?? "/journey";

    if (!access_token || !refresh_token) {
      router.replace("/auth/auth-code-error");
      return;
    }

    const supabase = createClient();
    supabase.auth.setSession({ access_token, refresh_token }).then(({ error }) => {
      router.replace(error ? "/auth/auth-code-error" : next);
    });
  }, [router, searchParams]);

  return (
    <main className="mx-auto max-w-md px-6 py-24 text-center">
      <p className="text-sm text-muted">Signing you in...</p>
    </main>
  );
}
