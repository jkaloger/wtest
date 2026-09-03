import type { AuthUser } from "../handlers/supabase/fixtures.ts";

export type Session = {
  access_token: string;
  refresh_token: string;
  token_type: "bearer";
  expires_in: number;
  expires_at: number;
  user: AuthUser;
};

const ONE_HOUR = 3600;

export function session(user: AuthUser, now = Math.floor(Date.now() / 1000)): Session {
  const exp = now + ONE_HOUR;
  return {
    access_token: unsignedJwt({
      iss: "http://127.0.0.1/auth/v1",
      sub: user.id,
      aud: user.aud,
      role: user.role,
      email: user.email,
      exp,
      iat: now,
      session_id: "00000000-0000-4000-8000-0000000000aa",
      is_anonymous: false,
    }),
    refresh_token: "mock-refresh-token",
    token_type: "bearer",
    expires_in: ONE_HOUR,
    expires_at: exp,
    user,
  };
}

// Three-part JWT with a placeholder signature. Nothing in the harness verifies signatures;
// supabase-js only needs `split('.').length === 3` and a decodable payload.
function unsignedJwt(payload: Record<string, unknown>): string {
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  return `${header}.${base64url(JSON.stringify(payload))}.mock-signature`;
}

export function base64url(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
