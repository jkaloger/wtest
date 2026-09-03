import express, { type Express } from "express";
import { createMiddleware } from "@mswjs/http-middleware";
import type { HttpHandler } from "msw";
import {
  handlers as defaults,
  resolveScenario,
  scenarioNames,
  type ScenarioRequest,
} from "./handlers/index.ts";

export function createMockServer(base: HttpHandler[] = defaults): Express {
  let overrides: HttpHandler[] = [];
  const app = express();

  app.use((req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
    res.setHeader(
      "Access-Control-Allow-Headers",
      req.header("access-control-request-headers") ?? "*",
    );
    res.setHeader("Access-Control-Expose-Headers", "Content-Range");
    if (req.method === "OPTIONS") {
      res.status(204).end();
      return;
    }
    next();
  });
  app.use(express.json());

  app.get("/__health", (_req, res) => {
    res.json({ ok: true, overrides: overrides.length, scenarios: scenarioNames() });
  });

  app.post("/__reset", (_req, res) => {
    overrides = [];
    res.status(204).end();
  });

  app.post("/__scenario", (req, res) => {
    try {
      const applied = resolveScenario(req.body as ScenarioRequest);
      overrides = [...applied, ...overrides];
      res.json({ ok: true, overrides: overrides.length });
    } catch (error) {
      res.status(400).json({ ok: false, error: (error as Error).message });
    }
  });

  // Overrides win by preceding the defaults. A fresh middleware per request keeps the override
  // list live without reaching into msw internals.
  app.use((req, res, next) => createMiddleware(...overrides, ...base)(req, res, next));

  app.use((req, res) => {
    res.status(501).json({ error: `mock server: unhandled ${req.method} ${req.originalUrl}` });
  });

  return app;
}

export function startMockServer(port = Number(process.env.MOCK_PORT ?? 4010), host = "127.0.0.1") {
  const app = createMockServer();
  return new Promise<{ close: () => Promise<void>; url: string }>((resolve) => {
    const listener = app.listen(port, host, () => {
      const address = listener.address();
      const bound = typeof address === "object" && address ? address.port : port;
      const url = `http://${host}:${bound}`;
      console.log(`mock server listening on ${url}`);
      resolve({
        url,
        close: () => new Promise((done) => listener.close(() => done())),
      });
    });
  });
}
