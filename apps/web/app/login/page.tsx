import { signIn } from "../../src/lib/auth/actions";

const MESSAGES: Record<string, string> = {
  invalid_form: "Enter an email and password.",
  invalid_credentials: "Invalid login credentials.",
  unavailable: "Sign-in is unavailable right now.",
};

export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <main>
      <h1>Sign in</h1>
      {error && <p role="alert">{MESSAGES[error] ?? "Sign-in failed."}</p>}
      <form action={signIn}>
        <label>
          Email
          <input type="email" name="email" required />
        </label>
        <label>
          Password
          <input type="password" name="password" required />
        </label>
        <button type="submit">Sign in</button>
      </form>
    </main>
  );
}
