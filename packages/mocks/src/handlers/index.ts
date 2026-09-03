import type { HttpHandler } from "msw";
import { handlers as supabaseHandlers } from "./supabase/handlers.ts";
import { anonSession, userSession } from "../auth/index.ts";
import type { AuthUser } from "./supabase/fixtures.ts";
import * as supabaseScenarios from "./supabase/scenarios.ts";

export const handlers: HttpHandler[] = [...supabaseHandlers, ...anonSession().handlers];

type ScenarioFn = (...args: never[]) => HttpHandler[];

const registry: Record<string, Record<string, ScenarioFn>> = {
  supabase: {
    notFound: supabaseScenarios.notFound as ScenarioFn,
    serverError: supabaseScenarios.serverError as ScenarioFn,
    slow: supabaseScenarios.slow as ScenarioFn,
    empty: supabaseScenarios.empty as ScenarioFn,
    "auth.anon": () => anonSession().handlers,
    "auth.user": ((user?: AuthUser) => userSession(user).handlers) as ScenarioFn,
  },
};

export type ScenarioRequest = { origin: string; name: string; args?: unknown[] };

// Shared by the loopback server's `/__scenario` and anything else that names scenarios as data.
export function resolveScenario({ origin, name, args = [] }: ScenarioRequest): HttpHandler[] {
  const fn = registry[origin]?.[name];
  if (!fn) throw new Error(`unknown scenario ${origin}.${name}`);
  return fn(...(args as never[]));
}

export function scenarioNames(): string[] {
  return Object.entries(registry).flatMap(([origin, fns]) =>
    Object.keys(fns).map((name) => `${origin}.${name}`),
  );
}
