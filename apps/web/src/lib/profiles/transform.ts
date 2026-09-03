import type { Tables } from "@repo/types/supabase";

export type Profile = Tables<"profiles">;

export function toDisplayName(profile: Pick<Profile, "username" | "display_name">): string {
  return profile.display_name?.trim() || `@${profile.username}`;
}
