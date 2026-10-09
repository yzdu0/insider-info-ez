import Link from "next/link";
import SkillDashboard from "./skill-dashboard";

export default function SkillsPage() {
  return <div className="app-shell">
    <header className="site-header"><Link className="brand" href="/">ThinkingAloud</Link><Link className="secondary-button" href="/">Problems</Link></header>
    <SkillDashboard />
  </div>;
}
