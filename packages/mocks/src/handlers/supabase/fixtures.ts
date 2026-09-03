import type { Tables } from "@repo/types/supabase";

export type Profile = Tables<"profiles">;

export type AuthUser = {
  id: string;
  aud: "authenticated";
  role: "authenticated";
  email: string;
  email_confirmed_at: string;
  app_metadata: { provider: "email"; providers: ["email"] };
  user_metadata: Record<string, never>;
  identities: [];
  created_at: string;
  updated_at: string;
  is_anonymous: false;
};

export const FIXTURE_PASSWORD = "correct-horse-battery-staple";

const EPOCH = "2026-01-01T00:00:00.000Z";

export function profile(overrides: Partial<Profile> = {}): Profile {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    username: "ada",
    display_name: "Ada Lovelace",
    created_at: EPOCH,
    ...overrides,
  };
}

export const profiles: readonly Profile[] = [
  profile(),
  profile({
    id: "00000000-0000-4000-8000-000000000002",
    username: "grace",
    display_name: "Grace Hopper",
  }),
  profile({
    id: "00000000-0000-4000-8000-000000000003",
    username: "linus",
    display_name: null,
  }),
];

export function authUser(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    aud: "authenticated",
    role: "authenticated",
    email: "ada@example.com",
    email_confirmed_at: EPOCH,
    app_metadata: { provider: "email", providers: ["email"] },
    user_metadata: {},
    identities: [],
    created_at: EPOCH,
    updated_at: EPOCH,
    is_anonymous: false,
    ...overrides,
  };
}
