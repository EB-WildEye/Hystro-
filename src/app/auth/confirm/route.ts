import type { NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { redirectTo } from "@/lib/redirect";
import { createClient } from "@/lib/supabase/server";

// Magic-link landing. Supports both link formats Supabase can send:
// - token_hash: from the customised email template (see README). Works even
//   when the link is opened on another device or browser.
// - code: from Supabase's default template (PKCE). Must be opened in the same
//   browser that requested the link, because the code verifier lives in a
//   cookie there.
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");

  const supabase = await createClient();
  let ok = false;
  if (tokenHash && type) {
    ok = !(await supabase.auth.verifyOtp({ type, token_hash: tokenHash })).error;
  } else if (code) {
    ok = !(await supabase.auth.exchangeCodeForSession(code)).error;
  }

  return redirectTo(ok ? "/" : "/login?error=link");
}
