import Link from "next/link";

export default function Home() {
  return (
    <main style={{ padding: 40 }}>
      <h1>OpsPilot</h1>
      <p>Business ops tracker</p>
      <Link href="/dashboard">Go to dashboard</Link>
    </main>
  );
}
