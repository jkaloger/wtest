import { toDisplayName, type Profile } from "../../lib/profiles/transform";

export function ProfileCard({ profile }: { profile: Profile }) {
  return (
    <article aria-label={profile.username}>
      <h2>{toDisplayName(profile)}</h2>
      <p>@{profile.username}</p>
    </article>
  );
}
