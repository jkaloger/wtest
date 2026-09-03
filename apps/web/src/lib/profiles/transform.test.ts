import { expect, test } from "vitest";
import { fixtures } from "@repo/mocks/supabase";
import { toDisplayName } from "./transform";

test("prefers display_name", () => {
  expect(toDisplayName(fixtures.profile())).toBe("Ada Lovelace");
});

test("falls back to @username when display_name is null or blank", () => {
  expect(toDisplayName(fixtures.profile({ display_name: null }))).toBe("@ada");
  expect(toDisplayName(fixtures.profile({ display_name: "   " }))).toBe("@ada");
});
