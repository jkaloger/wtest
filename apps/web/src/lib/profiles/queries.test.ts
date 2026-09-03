import { describe, expect, test } from "vitest";
import { server } from "@repo/mocks/node";
import { fixtures, scenario } from "@repo/mocks/supabase";
import { testClient } from "../supabase/testing";
import { listProfiles, profileById, searchProfiles } from "./queries";

describe("listProfiles", () => {
  test("returns every fixture row", async () => {
    const { data, error } = await listProfiles(testClient());
    expect(error).toBeNull();
    expect(data).toEqual(fixtures.profiles);
  });

  test("surfaces a server error instead of throwing", async () => {
    server.use(...scenario.serverError("profiles"));
    const { data, error } = await listProfiles(testClient());
    expect(data).toBeNull();
    expect(error?.message).toBe("internal_error");
  });

  test("empty scenario yields an empty array", async () => {
    server.use(...scenario.empty("profiles"));
    const { data } = await listProfiles(testClient());
    expect(data).toEqual([]);
  });
});

describe("searchProfiles", () => {
  test("filters by username substring, case-insensitive", async () => {
    const { data } = await searchProfiles(testClient(), "GRA");
    expect(data?.map((p) => p.username)).toEqual(["grace"]);
  });
});

describe("profileById", () => {
  test("returns one row", async () => {
    const [first] = fixtures.profiles;
    const { data } = await profileById(testClient(), first!.id);
    expect(data).toEqual(first);
  });

  test("unknown id is a PGRST116 error", async () => {
    const { data, error } = await profileById(testClient(), "missing");
    expect(data).toBeNull();
    expect(error?.code).toBe("PGRST116");
  });
});
