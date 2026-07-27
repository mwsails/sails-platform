import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Magic-link callback. Self-serve sign-in (supabase.auth.signInWithOtp from
// the browser) registers a PKCE code_challenge, so Supabase's verify
// endpoint redirects here with `?code=...`, exchanged server-side below.
// Links minted server-side via the Admin API (admin.inviteUserByEmail,
// admin.generateLink — used for the real invite-provisioning flow in
// src/app/admin/actions.ts, and for testing without a real inbox) have no
// registered code_challenge, so Supabase instead redirects with tokens in
// the URL fragment (`#access_token=...`), which never reaches the server.
// Since a fragment survives a same-origin redirect in the browser, hand
// those off to /auth/hash-callback, a client page that can read it.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/journey";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
    return NextResponse.redirect(`${origin}/auth/auth-code-error`);
  }

  return NextResponse.redirect(`${origin}/auth/hash-callback?next=${encodeURIComponent(next)}`);
}
