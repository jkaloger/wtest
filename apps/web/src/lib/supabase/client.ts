// The only module that reads the Supabase origin. Everything else takes a client as an argument.
import { createBrowserClient, createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { Database } from "@repo/types/supabase";

export type Client = SupabaseClient<Database>;

function supabaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set");
  return url;
}

function anonKey(): string {
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;
  if (!key) throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY is not set");
  return key;
}

// Mirrors @supabase/ssr's default storage key so proxy.ts can test for a session without a client.
export function authCookieName(): string {
  return `sb-${new URL(supabaseUrl()).hostname.split(".")[0]}-auth-token`;
}

export async function serverClient(): Promise<Client> {
  const store = await cookies();
  return createServerClient<Database>(supabaseUrl(), anonKey(), {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) store.set(name, value, options);
        } catch {
          // Called from a Server Component: cookies are read-only there. proxy.ts refreshes.
        }
      },
    },
  });
}

export function browserClient(): Client {
  return createBrowserClient<Database>(supabaseUrl(), anonKey());
}
