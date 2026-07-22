import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// One-click sign-in for admin-provisioned users, bridging the gap until
// SMTP is configured (Supabase's built-in email sender is rate-limited and
// not meant for production). Takes a token_hash from
// admin.generateLink({ type: 'magiclink' | 'invite', ... }) and verifies it
// server-side via verifyOtp, which doesn't need the PKCE code_verifier
// cookie a real signInWithOtp-initiated link would (that cookie only exists
// in whichever browser started the request, which breaks the moment
// someone opens the email on a different device than the one that
// requested it — the same issue that made headless testing need this).
// Safe to keep: token_hash only comes from the service-role key, and each
// one is single-use.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const next = searchParams.get("next") ?? "/journey";
  if (!tokenHash) return NextResponse.json({ error: "missing token_hash" }, { status: 400 });

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "magiclink" });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.redirect(`${origin}${next}`);
}
