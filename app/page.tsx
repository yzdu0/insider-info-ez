import Link from "next/link";
import ProblemLibrary from "@/app/problem-library";

export default function Home() {
  return (
    <div className="app-shell">
      <header className="site-header">
        <Link className="brand" href="/" aria-label="ThinkingAloud home"><span className="brand-mark">{"{}"}</span>Thinking<span className="brand-light">Aloud</span></Link>
        <Link className="secondary-button" href="/skills">Your skills</Link>
      </header>
      <ProblemLibrary />
    </div>
  );
}
