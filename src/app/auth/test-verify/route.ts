import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// TEMPORARY — Phase 1 headless verification only. admin.generateLink()'s
// action_link expects PKCE code_verifier cookies this browser never set
// (it never called signInWithOtp itself), so exchangeCodeForSession fails.
// verifyOtp with token_hash sidesteps that — no verifier needed. Delete this
// route once end-to-end verification is done; it's a test harness, not a
// real auth path.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  if (!tokenHash) return NextResponse.json({ error: "missing token_hash" }, { status: 400 });

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "magiclink" });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.redirect(`${origin}/journey`);
}
