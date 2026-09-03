import { redirect } from "next/navigation";
import { ProfileCard } from "../../src/components/profile-card";
import { ProfileSearch } from "../../src/components/profile-search";
import { listProfiles } from "../../src/lib/profiles/queries";
import { serverClient } from "../../src/lib/supabase/client";

export default async function Dashboard() {
  const client = await serverClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) redirect("/login");

  const { data: profiles, error } = await listProfiles(client);

  return (
    <main>
      <h1>Dashboard</h1>
      <p>Signed in as {user.email}</p>
      {error ? (
        <p role="alert">Could not load profiles</p>
      ) : (
        <ul aria-label="profiles">
          {profiles.map((profile) => (
            <li key={profile.id}>
              <ProfileCard profile={profile} />
            </li>
          ))}
        </ul>
      )}
      <ProfileSearch />
    </main>
  );
}
