import { delay, http, HttpResponse, type HttpHandler } from "msw";
import type { Database } from "@repo/types/supabase";
import { profilesResolver } from "./handlers.ts";

export type Resource = keyof Database["public"]["Tables"];

const rest = (resource: Resource) => `*/rest/v1/${resource}`;

const happyPath: Record<Resource, typeof profilesResolver> = {
  profiles: profilesResolver,
};

export function notFound(resource: Resource): HttpHandler[] {
  return [
    http.all(rest(resource), () =>
      HttpResponse.json(
        {
          code: "PGRST205",
          details: null,
          hint: null,
          message: `Could not find the table 'public.${resource}' in the schema cache`,
        },
        { status: 404 },
      ),
    ),
  ];
}

export function serverError(resource: Resource): HttpHandler[] {
  return [
    http.all(rest(resource), () =>
      HttpResponse.json(
        { code: "XX000", details: null, hint: null, message: "internal_error" },
        { status: 500 },
      ),
    ),
  ];
}

export function slow(resource: Resource, ms = 2000): HttpHandler[] {
  return [
    http.get(rest(resource), async (info) => {
      await delay(ms);
      return happyPath[resource](info);
    }),
  ];
}

export function empty(resource: Resource): HttpHandler[] {
  return [http.get(rest(resource), () => HttpResponse.json([]))];
}

export const scenario = { notFound, serverError, slow, empty };
