import { afterAll, afterEach, beforeAll } from "vitest";
import { server } from "@repo/mocks/node";

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
