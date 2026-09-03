"use client";

import { useRef, useState } from "react";
import { searchProfiles } from "../../lib/profiles/queries";
import { toDisplayName, type Profile } from "../../lib/profiles/transform";
import { browserClient } from "../../lib/supabase/client";

type State =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "done"; results: Profile[] }
  | { status: "error" };

export function ProfileSearch() {
  const [state, setState] = useState<State>({ status: "idle" });
  const latest = useRef(0);

  async function search(query: string) {
    const ticket = ++latest.current;
    if (query.trim() === "") {
      setState({ status: "idle" });
      return;
    }
    setState({ status: "loading" });
    const { data, error } = await searchProfiles(browserClient(), query);
    if (ticket !== latest.current) return;
    if (error || !data) {
      setState({ status: "error" });
      return;
    }
    setState({ status: "done", results: data });
  }

  return (
    <section>
      <label>
        Search profiles
        <input type="search" name="q" onChange={(event) => void search(event.target.value)} />
      </label>
      {state.status === "loading" && <p>Searching…</p>}
      {state.status === "error" && <p role="alert">Search failed</p>}
      {state.status === "done" && state.results.length === 0 && <p>No matches</p>}
      {state.status === "done" && state.results.length > 0 && (
        <ul>
          {state.results.map((profile) => (
            <li key={profile.id}>{toDisplayName(profile)}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
