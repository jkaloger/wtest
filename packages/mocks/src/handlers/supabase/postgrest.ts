// Minimal PostgREST semantics: `select`, `<col>=eq.<v>`, `<col>=ilike.<pattern>`, single-object
// Accept header. Enough for the toy app's query builders; extend when a real query needs more.

type Row = Record<string, unknown>;

const RESERVED = new Set(["select", "order", "limit", "offset"]);
const OBJECT_ACCEPT = "application/vnd.pgrst.object+json";

export function applyFilters<T extends Row>(rows: readonly T[], url: URL): T[] {
  let out = [...rows];
  for (const [column, raw] of url.searchParams) {
    if (RESERVED.has(column)) continue;
    const dot = raw.indexOf(".");
    if (dot === -1) continue;
    const op = raw.slice(0, dot);
    const value = raw.slice(dot + 1);
    out = out.filter((row) => matches(row[column], op, value));
  }
  const limit = url.searchParams.get("limit");
  if (limit !== null) out = out.slice(0, Number(limit));
  return out;
}

function matches(cell: unknown, op: string, value: string): boolean {
  switch (op) {
    case "eq":
      return String(cell) === value;
    case "neq":
      return String(cell) !== value;
    case "is":
      return value === "null" ? cell === null : String(cell) === value;
    case "ilike":
      return ilike(String(cell ?? ""), value);
    case "like":
      return like(String(cell ?? ""), value, "");
    default:
      throw new Error(`postgrest mock: unsupported operator "${op}"`);
  }
}

function ilike(cell: string, pattern: string): boolean {
  return like(cell, pattern, "i");
}

function like(cell: string, pattern: string, flags: string): boolean {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/[*%]/g, ".*");
  return new RegExp(`^${escaped}$`, flags).test(cell);
}

export function selectColumns<T extends Row>(rows: T[], url: URL): Row[] {
  const select = url.searchParams.get("select");
  if (!select || select === "*") return rows;
  const columns = select.split(",").map((c) => c.trim());
  return rows.map((row) => Object.fromEntries(columns.map((c) => [c, row[c]])));
}

export function wantsSingleObject(request: Request): boolean {
  return request.headers.get("accept")?.includes(OBJECT_ACCEPT) ?? false;
}

export function wantsRepresentation(request: Request): boolean {
  return request.headers.get("prefer")?.includes("return=representation") ?? false;
}

export const PGRST_SINGLE_MISMATCH = {
  code: "PGRST116",
  details: "The result contains 0 rows",
  hint: null,
  message: "JSON object requested, multiple (or no) rows returned",
};
