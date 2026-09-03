import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@repo/types/supabase";
import { anonKey, supabaseUrl, type Client } from "./client";

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
