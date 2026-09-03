import Link from "next/link";

export default function Home() {
  return (
    <main>
      <h1>Harness proving ground</h1>
      <p>Toy Next.js app exercising the three-layer test harness.</p>
      <Link href="/login">Sign in</Link>
    </main>
  );
}
