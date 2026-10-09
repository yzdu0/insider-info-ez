"use client";

import Link from "next/link";
import { useState } from "react";
import { categories, difficultyRank, problems, type ProblemCategory } from "@/lib/problems";

export default function ProblemLibrary() {
  const [selectedCategory, setSelectedCategory] = useState<ProblemCategory | "all">("all");
  const [query, setQuery] = useState("");
  const visibleProblems = problems.filter((problem) =>
    (selectedCategory === "all" || problem.category === selectedCategory) &&
    `${problem.title} ${problem.category}`.toLowerCase().includes(query.trim().toLowerCase()),
  );

  return (
    <main className="library">
      <div className="library-heading"><h1>Problems</h1><span role="status">{visibleProblems.length} {visibleProblems.length === 1 ? "problem" : "problems"}</span></div>
      <nav className="library-categories" aria-label="Problem categories">
        {(["all", ...categories] as const).map((category) => (
          <button key={category} type="button" aria-pressed={selectedCategory === category} onClick={() => setSelectedCategory(category)}>
            {category === "all" ? "All" : category}
          </button>
        ))}
      </nav>
      <input className="library-search" type="search" aria-label="Search problems" placeholder="Search problems" value={query} onChange={(event) => setQuery(event.target.value)} />
      {categories.map((category) => {
        const categoryProblems = visibleProblems.filter((problem) => problem.category === category).sort((a, b) => difficultyRank[a.difficulty] - difficultyRank[b.difficulty]);
        if (!categoryProblems.length) return null;
        return (
          <section className="problem-category" key={category} aria-label={category}>
            {selectedCategory === "all" && <h2>{category}</h2>}
            <div className="problem-list">
              {categoryProblems.map((problem) => (
                <Link className="problem-row" key={problem.id} href={`/interview/${problem.id}`}>
                  <span className="problem-name">{problem.title}</span>
                  <span className="problem-language">{problem.preferredLanguage === "cpp" ? "C++" : problem.preferredLanguage === "python" ? "Python" : "Pseudocode"}</span>
                  <span className="problem-difficulty">{problem.difficulty}</span>
                </Link>
              ))}
            </div>
          </section>
        );
      })}
      {!visibleProblems.length && <div className="library-empty"><p>No matching problems.</p><button type="button" onClick={() => { setQuery(""); setSelectedCategory("all"); }}>Clear filters</button></div>}
    </main>
  );
}
