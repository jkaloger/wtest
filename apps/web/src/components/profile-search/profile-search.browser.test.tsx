import { expect, test } from "vitest";
import { userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import { worker } from "@repo/mocks/browser";
import { scenario } from "@repo/mocks/supabase";
import { ProfileSearch } from "./index";

test("typing lists matching fixture rows", async () => {
  const screen = await render(<ProfileSearch />);
  await userEvent.fill(screen.getByRole("searchbox"), "a");
  await expect.element(screen.getByRole("listitem").nth(0)).toHaveTextContent("Ada Lovelace");
  await expect.element(screen.getByRole("listitem").nth(1)).toHaveTextContent("Grace Hopper");
  await expect.element(screen.getByRole("listitem")).toHaveLength(2);
});

test("shows the error state when the origin fails", async () => {
  worker.use(...scenario.serverError("profiles"));
  const screen = await render(<ProfileSearch />);
  await userEvent.fill(screen.getByRole("searchbox"), "ada");
  await expect.element(screen.getByRole("alert")).toHaveTextContent("Search failed");
});

test("no matches renders the empty message", async () => {
  worker.use(...scenario.empty("profiles"));
  const screen = await render(<ProfileSearch />);
  await userEvent.fill(screen.getByRole("searchbox"), "zzz");
  await expect.element(screen.getByText("No matches")).toBeVisible();
});
