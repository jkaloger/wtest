import { expect, test } from "vitest";
import { render } from "vitest-browser-react";
import { fixtures } from "@repo/mocks/supabase";
import { ProfileCard } from "./index";

test("renders display name and handle", async () => {
  const screen = await render(<ProfileCard profile={fixtures.profile()} />);
  await expect.element(screen.getByRole("heading")).toHaveTextContent("Ada Lovelace");
  await expect.element(screen.getByText("@ada")).toBeVisible();
});

test("falls back to the handle when display_name is null", async () => {
  const screen = await render(<ProfileCard profile={fixtures.profile({ display_name: null })} />);
  await expect.element(screen.getByRole("heading")).toHaveTextContent("@ada");
});
