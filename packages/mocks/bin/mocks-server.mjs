#!/usr/bin/env node
// Node >= 22.18 strips types natively, so the package runs from source with no build step.
import { startMockServer } from "../src/server.ts";

await startMockServer();
