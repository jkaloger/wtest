// Layer-1 client: no cookies, no refresh timers. `serverClient()` needs a request scope (e2e only).
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@repo/types/supabase";
import type { Client } from "./client";

export function testClient(): Client {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key)
    throw new Error("SUPABASE_URL / SUPABASE_ANON_KEY unset: run via `just` or load .env.test");
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
