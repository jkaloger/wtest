import { expect, test } from "vitest";
import { isProtected, redirectFor } from "./guard";

test("dashboard and its children are protected", () => {
  expect(isProtected("/dashboard")).toBe(true);
  expect(isProtected("/dashboard/settings")).toBe(true);
  expect(isProtected("/dashboards")).toBe(false);
  expect(isProtected("/")).toBe(false);
});

test("anon on a protected path is sent to /login, everything else passes", () => {
  expect(redirectFor("/dashboard", false)).toBe("/login");
  expect(redirectFor("/dashboard", true)).toBeNull();
  expect(redirectFor("/login", false)).toBeNull();
});
