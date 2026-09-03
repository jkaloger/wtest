"use server";

import { redirect } from "next/navigation";
import { serverClient } from "../supabase/server";
import { parseCredentials, signInWithPassword } from "./sign-in";

export async function signIn(formData: FormData): Promise<void> {
  const credentials = parseCredentials(formData);
  if (!credentials) redirect("/login?error=invalid_form");

  const result = await signInWithPassword(await serverClient(), credentials);
  if (!result.ok) redirect(`/login?error=${result.code}`);

  redirect("/dashboard");
}
