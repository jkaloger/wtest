import type { Client } from "../supabase/client";

export type Credentials = { email: string; password: string };

export type SignInResult =
  | { ok: true }
  | { ok: false; code: "invalid_form" | "invalid_credentials" | "unavailable" };

export function parseCredentials(formData: FormData): Credentials | null {
  const email = formData.get("email");
  const password = formData.get("password");
  if (typeof email !== "string" || typeof password !== "string") return null;
  if (!email.includes("@") || password.length === 0) return null;
  return { email, password };
}

export async function signInWithPassword(
  client: Client,
  credentials: Credentials,
): Promise<SignInResult> {
  const { error } = await client.auth.signInWithPassword(credentials);
  if (!error) return { ok: true };
  if (error.status === 400) return { ok: false, code: "invalid_credentials" };
  return { ok: false, code: "unavailable" };
}
