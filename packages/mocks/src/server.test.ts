import { afterAll, beforeAll, beforeEach, expect, test } from "vitest";
import { fixtures } from "./handlers/supabase/index.ts";
import { startMockServer } from "./server.ts";

let url: string;
let close: () => Promise<void>;

beforeAll(async () => {
  ({ url, close } = await startMockServer(0));
});
afterAll(() => close());
beforeEach(() => fetch(`${url}/__reset`, { method: "POST" }));

test("__health reports ok and no-store", async () => {
  const res = await fetch(`${url}/__health`);
  expect(res.status).toBe(200);
  expect(res.headers.get("cache-control")).toBe("no-store");
  expect(await res.json()).toMatchObject({ ok: true, overrides: 0 });
});

test("serves handlers over http", async () => {
  const res = await fetch(`${url}/rest/v1/profiles?select=*`);
  expect(res.headers.get("cache-control")).toBe("no-store");
  expect(await res.json()).toEqual(fixtures.profiles);
});

test("__scenario overrides until __reset", async () => {
  const applied = await fetch(`${url}/__scenario`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ origin: "supabase", name: "serverError", args: ["profiles"] }),
  });
  expect(applied.status).toBe(200);
  expect((await fetch(`${url}/rest/v1/profiles`)).status).toBe(500);

  await fetch(`${url}/__reset`, { method: "POST" });
  expect((await fetch(`${url}/rest/v1/profiles`)).status).toBe(200);
});

test("auth.user scenario flips /auth/v1/user", async () => {
  expect((await fetch(`${url}/auth/v1/user`)).status).toBe(401);
  await fetch(`${url}/__scenario`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ origin: "supabase", name: "auth.user" }),
  });
  expect(await (await fetch(`${url}/auth/v1/user`)).json()).toEqual(fixtures.authUser());
});

test("unknown scenario is a 400", async () => {
  const res = await fetch(`${url}/__scenario`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ origin: "supabase", name: "nope" }),
  });
  expect(res.status).toBe(400);
});

test("unmatched routes are 501, never passthrough", async () => {
  expect((await fetch(`${url}/rest/v1/nothing`)).status).toBe(501);
});
