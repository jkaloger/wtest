import { http, HttpResponse, type HttpHandler } from "msw";
import type { TablesInsert } from "@repo/types/supabase";
import { authUser, FIXTURE_PASSWORD, profile, profiles, type Profile } from "./fixtures.ts";
import { session } from "../../auth/session.ts";
import {
  applyFilters,
  PGRST_SINGLE_MISMATCH,
  selectColumns,
  wantsRepresentation,
  wantsSingleObject,
} from "./postgrest.ts";

export const PROFILES = "*/rest/v1/profiles";
export const AUTH_USER = "*/auth/v1/user";
export const AUTH_TOKEN = "*/auth/v1/token";

export const profilesResolver = ({ request }: { request: Request }) => {
  const url = new URL(request.url);
  const rows = selectColumns(applyFilters(profiles, url), url);
  if (!wantsSingleObject(request)) return HttpResponse.json(rows);
  if (rows.length !== 1) return HttpResponse.json(PGRST_SINGLE_MISMATCH, { status: 406 });
  return HttpResponse.json(rows[0]);
};

export const restHandlers: HttpHandler[] = [
  http.get(PROFILES, profilesResolver),

  http.post(PROFILES, async ({ request }) => {
    const body = (await request.json()) as TablesInsert<"profiles"> | TablesInsert<"profiles">[];
    const inserted: Profile[] = (Array.isArray(body) ? body : [body]).map((row, i) =>
      profile({ id: `00000000-0000-4000-8000-00000000f${String(i).padStart(3, "0")}`, ...row }),
    );
    if (!wantsRepresentation(request)) return new HttpResponse(null, { status: 201 });
    return HttpResponse.json(wantsSingleObject(request) ? inserted[0] : inserted, {
      status: 201,
    });
  }),
];

type PasswordGrant = { email?: string; password?: string };

export const authHandlers: HttpHandler[] = [
  http.post(AUTH_TOKEN, async ({ request }) => {
    const grant = new URL(request.url).searchParams.get("grant_type");
    if (grant !== "password") {
      return HttpResponse.json(
        { code: 400, error_code: "invalid_grant", msg: `unsupported grant_type ${grant}` },
        { status: 400 },
      );
    }
    const { email, password } = (await request.json()) as PasswordGrant;
    const user = authUser();
    if (email !== user.email || password !== FIXTURE_PASSWORD) {
      return HttpResponse.json(
        {
          code: 400,
          error_code: "invalid_credentials",
          msg: "Invalid login credentials",
          error: "invalid_grant",
          error_description: "Invalid login credentials",
        },
        { status: 400 },
      );
    }
    return HttpResponse.json(session(user));
  }),
];

export const handlers: HttpHandler[] = [...restHandlers, ...authHandlers];
