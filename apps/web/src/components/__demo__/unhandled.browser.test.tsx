// AC2 probe only: with every handler removed, the component's origin query is an unhandled
// request under `onUnhandledRequest: "error"`, so the happy-path assertion must fail.
// `DEMO_UNHANDLED=1 vitest run --project browser src/components/__demo__/unhandled` exits non-zero.
import { expect, test } from "vitest";
import { userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import { worker } from "@repo/mocks/browser";
import { ProfileSearch } from "../profile-search";

test.skipIf(process.env.DEMO_UNHANDLED !== "1")(
  "fails when the origin handler is removed",
  async () => {
    worker.resetHandlers();
    const screen = await render(<ProfileSearch />);
    await userEvent.fill(screen.getByRole("searchbox"), "ada");
    await expect
      .element(screen.getByRole("listitem"), { timeout: 2000 })
      .toHaveTextContent("Ada Lovelace");
  },
);
