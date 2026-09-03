import { describe, expect, test } from "vitest";
import { server } from "../../node.ts";
import { fixtures, scenario } from "./index.ts";
import { anonSession, cookieName, userSession } from "../../auth/index.ts";

const BASE = "http://127.0.0.1:4010";

describe("rest/v1/profiles", () => {
  test("returns fixture rows", async () => {
    const res = await fetch(`${BASE}/rest/v1/profiles?select=*`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(fixtures.profiles);
  });

  test("filters by eq and honours select", async () => {
    const [first] = fixtures.profiles;
    const res = await fetch(`${BASE}/rest/v1/profiles?select=username&id=eq.${first!.id}`);
    expect(await res.json()).toEqual([{ username: first!.username }]);
  });

  test("single-object accept returns 406 on zero rows", async () => {
    const res = await fetch(`${BASE}/rest/v1/profiles?id=eq.missing`, {
      headers: { accept: "application/vnd.pgrst.object+json" },
    });
    expect(res.status).toBe(406);
  });

  test("insert echoes representation when preferred", async () => {
    const res = await fetch(`${BASE}/rest/v1/profiles`, {
      method: "POST",
      headers: { "content-type": "application/json", prefer: "return=representation" },
      body: JSON.stringify({ username: "new" }),
    });
    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject([{ username: "new", display_name: "Ada Lovelace" }]);
  });
});

describe("scenarios", () => {
  test("serverError overrides the happy path for one test", async () => {
    server.use(...scenario.serverError("profiles"));
    const res = await fetch(`${BASE}/rest/v1/profiles`);
    expect(res.status).toBe(500);
  });

  test("resetHandlers restored the happy path", async () => {
    const res = await fetch(`${BASE}/rest/v1/profiles`);
    expect(res.status).toBe(200);
  });

  test("empty returns no rows", async () => {
    server.use(...scenario.empty("profiles"));
    expect(await (await fetch(`${BASE}/rest/v1/profiles`)).json()).toEqual([]);
  });

  test("notFound is a 404", async () => {
    server.use(...scenario.notFound("profiles"));
    expect((await fetch(`${BASE}/rest/v1/profiles`)).status).toBe(404);
  });
});

describe("auth", () => {
  test("password grant with fixture creds returns a session", async () => {
    const res = await fetch(`${BASE}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: fixtures.authUser().email,
        password: fixtures.FIXTURE_PASSWORD,
      }),
    });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.access_token.split(".")).toHaveLength(3);
    expect(body.user.id).toBe(fixtures.authUser().id);
  });

  test("wrong password is invalid_credentials", async () => {
    const res = await fetch(`${BASE}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "ada@example.com", password: "nope" }),
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error_code: "invalid_credentials" });
  });

  test("anon by default: /auth/v1/user is 401", async () => {
    expect((await fetch(`${BASE}/auth/v1/user`)).status).toBe(401);
  });

  test("userSession handlers make /auth/v1/user return the user", async () => {
    const user = fixtures.authUser();
    server.use(...userSession(user).handlers);
    expect(await (await fetch(`${BASE}/auth/v1/user`)).json()).toEqual(user);
  });

  test("cookie name follows the ssr storage-key rule", () => {
    expect(cookieName("http://127.0.0.1:4010")).toBe("sb-127-auth-token");
    expect(cookieName("https://abcdefgh.supabase.co")).toBe("sb-abcdefgh-auth-token");
    expect(anonSession().cookies).toEqual([]);
    expect(userSession().cookies[0]!.value.startsWith("base64-")).toBe(true);
  });
});

describe("unhandled requests", () => {
  test("reject with an error under onUnhandledRequest: error", async () => {
    await expect(fetch(`${BASE}/rest/v1/unknown_table`)).rejects.toThrow();
  });
});
