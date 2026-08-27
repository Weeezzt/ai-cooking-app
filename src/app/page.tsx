import Link from "next/link";

export default function HomePage() {
  return (
    <main>
      <h1>AI Cooking App</h1>
      <p>Foundation shell. The journey:</p>
      <nav>
        <ul>
          <li>
            <Link href="/plan">PLAN</Link>
          </li>
          <li>
            <Link href="/shop">SHOP</Link>
          </li>
          <li>
            <Link href="/cook">COOK</Link>
          </li>
        </ul>
      </nav>
    </main>
  );
}
