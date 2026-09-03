import { http, HttpResponse, type HttpHandler } from "msw";
import { AUTH_TOKEN, AUTH_USER, unauthorized } from "../handlers/supabase/handlers.ts";
import { authUser, type AuthUser } from "../handlers/supabase/fixtures.ts";
import { base64url, session } from "./session.ts";

export type SessionCookie = {
  name: string;
  value: string;
  domain: string;
  path: "/";
  httpOnly: false;
  secure: false;
  sameSite: "Lax";
};

export type AuthFixture = { handlers: HttpHandler[]; cookies: SessionCookie[] };

const DEFAULT_SUPABASE_URL = "http://127.0.0.1:4010";
const DEFAULT_APP_HOST = "127.0.0.1";

function env(name: string): string | undefined {
  return typeof process === "undefined" ? undefined : process.env[name];
}

export function supabaseUrl(): string {
  return env("SUPABASE_URL") ?? env("NEXT_PUBLIC_SUPABASE_URL") ?? DEFAULT_SUPABASE_URL;
}

// @supabase/ssr storage key: `sb-<first hostname label>-auth-token`. Under loopback → `sb-127-auth-token`.
export function cookieName(url: string = supabaseUrl()): string {
  return `sb-${new URL(url).hostname.split(".")[0]}-auth-token`;
}

// Forces anonymity even when a valid bearer token is presented (e.g. a stale cookie).
export function anonSession(): AuthFixture {
  return {
    handlers: [http.get(AUTH_USER, () => unauthorized())],
    cookies: [],
  };
}

export function userSession(user: AuthUser = authUser()): AuthFixture {
  const current = session(user);
  return {
    handlers: [
      // Layers 1-2 send the anon key, not a session token, so the user is forced here.
      http.get(AUTH_USER, () => HttpResponse.json(user)),
      http.post(AUTH_TOKEN, ({ request }) => {
        const grant = new URL(request.url).searchParams.get("grant_type");
        if (grant !== "refresh_token") return undefined;
        return HttpResponse.json(session(user));
      }),
    ],
    cookies: [
      {
        name: cookieName(),
        value: `base64-${base64url(JSON.stringify(current))}`,
        domain: env("APP_HOST") ?? DEFAULT_APP_HOST,
        path: "/",
        httpOnly: false,
        secure: false,
        sameSite: "Lax",
      },
    ],
  };
}

export { authUser };
export type { AuthUser };
