import { http, HttpResponse } from "msw";
import { describe, expect, test } from "vitest";
import { server } from "@repo/mocks/node";
import { fixtures } from "@repo/mocks/supabase";
import { testClient } from "../supabase/testing";
import { parseCredentials, signInWithPassword } from "./sign-in";

const form = (entries: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) data.set(key, value);
  return data;
};

describe("parseCredentials", () => {
  test("accepts an email and a non-empty password", () => {
    expect(parseCredentials(form({ email: "a@b.c", password: "x" }))).toEqual({
      email: "a@b.c",
      password: "x",
    });
  });

  test("rejects missing or malformed fields", () => {
    expect(parseCredentials(form({ email: "a@b.c" }))).toBeNull();
    expect(parseCredentials(form({ email: "not-an-email", password: "x" }))).toBeNull();
    expect(parseCredentials(form({ email: "a@b.c", password: "" }))).toBeNull();
  });
});

describe("signInWithPassword", () => {
  const user = fixtures.authUser();

  test("fixture credentials succeed", async () => {
    const result = await signInWithPassword(testClient(), {
      email: user.email,
      password: fixtures.FIXTURE_PASSWORD,
    });
    expect(result).toEqual({ ok: true });
  });

  test("wrong password maps to invalid_credentials", async () => {
    const result = await signInWithPassword(testClient(), { email: user.email, password: "nope" });
    expect(result).toEqual({ ok: false, code: "invalid_credentials" });
  });

  test("auth outage maps to unavailable", async () => {
    server.use(
      http.post("*/auth/v1/token", () => HttpResponse.json({ msg: "down" }, { status: 503 })),
    );
    const result = await signInWithPassword(testClient(), {
      email: user.email,
      password: fixtures.FIXTURE_PASSWORD,
    });
    expect(result).toEqual({ ok: false, code: "unavailable" });
  });
});
