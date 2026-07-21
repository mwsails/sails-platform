import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// PKCE magic-link callback: Supabase's verify endpoint redirects here with
// `?code=...` after the user clicks the emailed link (or after
// admin.generateLink()'s action_link is visited, used for testing without a
// real inbox). `params` is a promise per Next.js 15+ route handler convention.
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
  }

  return NextResponse.redirect(`${origin}/auth/auth-code-error`);
}
