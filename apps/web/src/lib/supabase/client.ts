// The only module that reads the Supabase origin. Everything else takes a client as an argument.
// Server-side construction lives in ./server.ts because `next/headers` cannot enter client bundles.
import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@repo/types/supabase";

export type Client = SupabaseClient<Database>;

export function supabaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set");
  return url;
}

export function anonKey(): string {
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;
  if (!key) throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY is not set");
  return key;
}

// Mirrors @supabase/ssr's default storage key so proxy.ts can test for a session without a client.
export function authCookieName(): string {
  return `sb-${new URL(supabaseUrl()).hostname.split(".")[0]}-auth-token`;
}

export function browserClient(): Client {
  return createBrowserClient<Database>(supabaseUrl(), anonKey());
}
