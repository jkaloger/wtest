import type { Client } from "../supabase/client";

export function listProfiles(client: Client) {
  return client.from("profiles").select("*").order("username");
}

export function searchProfiles(client: Client, query: string) {
  return client.from("profiles").select("*").ilike("username", `%${query}%`).limit(10);
}

export function profileById(client: Client, id: string) {
  return client.from("profiles").select("*").eq("id", id).single();
}
