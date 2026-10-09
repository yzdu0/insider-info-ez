"use client";

import Link from "next/link";
import { useState } from "react";
import { downloadAnki, exportAnki } from "@/lib/anki";
import { getProblem } from "@/lib/problems";
import { clearSkillHistory, useSkillHistory } from "@/lib/skill-store";
import { summarizeSkills } from "@/lib/skills";

export default function SkillDashboard() {
  const { sessions, warning } = useSkillHistory();
  const [filter, setFilter] = useState<"all" | "practise">("all");
  const summaries = summarizeSkills(sessions);
  const cardCount = exportAnki(sessions).split("\n").filter(line => line && !line.startsWith("#")).length;
  const observed = summaries.filter(skill => skill.latest).length;
  return <main className="skills-page">
    <div className="library-heading"><h1>Your skills</h1><Link href="/" className="secondary-button">Practise a problem →</Link></div>
    <p className="skill-intro">Build a rating for each skill by practising problems. Ratings use problem difficulty and observed performance, with evidence and a next step for every update.</p>
    <div className="skill-summary"><span>{sessions.length} completed {sessions.length === 1 ? "interview" : "interviews"}</span><span>{observed}/{summaries.length} skills observed</span><span>{summaries.filter(skill => skill.latest?.status === "practise").length} areas to practise</span></div>
    <div className="skill-actions">
      <button type="button" disabled={!cardCount} onClick={() => downloadAnki(sessions)}>Export {cardCount} Anki {cardCount === 1 ? "card" : "cards"}</button>
      <button type="button" disabled={!sessions.length && !warning} onClick={() => { if (window.confirm("Clear all skill progress and flashcards saved in this browser?")) clearSkillHistory(); }}>Clear saved progress</button>
    </div>
    <p className="skill-note">Saved on this browser, without an account. Finish an interview or choose “Give up & see feedback” to update your skills. The latest 100 interviews are retained.</p>
    <details className="rating-help"><summary>How ratings work</summary><p>Each skill starts at 1200. Problems act as opponents: Easy 1000, Medium 1200, Hard 1400, Expert 1600. A strength observation counts as a win; an observed gap counts as a loss. Harder wins gain more points; easier losses cost more. Skills without evidence do not change.</p><p>Ratings are provisional until you have evidence from five different problems in that skill. Early updates use K=40, then K=24. Repeating the same problem has less weight (divided by the square root of the attempt count). Ratings are replayed from your retained interview history. This is an Elo-style practice estimate based on AI feedback, not a calibrated ranking of candidates.</p></details>
    {warning && <p className="chat-error" role="alert">{warning}</p>}
    {!sessions.length && <p className="skills-empty">Your first completed interview will appear here, with evidence and practice steps.</p>}
    <nav className="library-categories" aria-label="Skill filters"><button aria-pressed={filter === "all"} onClick={() => setFilter("all")}>All skills</button><button aria-pressed={filter === "practise"} onClick={() => setFilter("practise")}>Practise next</button></nav>
    <div className="skill-grid">{summaries.filter(skill => filter === "all" || skill.latest?.status === "practise").map(skill => <section className="skill-card" key={skill.id}>
      <div className="skill-card-heading"><h2>{skill.name}</h2><span className={`skill-status ${skill.latest?.status ?? "unobserved"}`}>{skill.latest ? skill.latest.status === "strength" ? "Strength observed" : "Practise next" : "Not observed"}</span></div>
      <div className="skill-rating"><strong>{skill.latest ? skill.rating : "—"}</strong><span>{skill.latest ? <><span className={skill.delta >= 0 ? "rating-gain" : "rating-loss"}>{skill.delta > 0 ? "+" : ""}{skill.delta} last interview</span><br />{skill.provisional ? "Provisional" : "Elo-style rating"} · {skill.ratedProblems} {skill.ratedProblems === 1 ? "problem" : "problems"}</> : "Unrated · starts at 1200"}</span></div>
      {skill.latest ? <>
        <p>{skill.latest.explanation}</p><p><strong>Next step:</strong> {skill.latest.nextStep}</p>
        {skill.change && <p className="skill-change">{skill.change}</p>}
        <p className="skill-note">Latest: {getProblem(skill.latest.session.problemId)!.title} · {new Date(skill.latest.session.completedAt).toLocaleDateString()} · {skill.observations.length} {skill.observations.length === 1 ? "observation" : "observations"}</p>
        <details><summary>Evidence & history</summary>{skill.observations.map(item => <div className="skill-history" key={item.session.id}>
          <strong>{getProblem(item.session.problemId)!.title}</strong><span> · {new Date(item.session.completedAt).toLocaleDateString()} · {item.status === "strength" ? "Strength observed" : "Practise next"}</span>
          <p className="skill-note">{item.session.difficulty ?? getProblem(item.session.problemId)!.difficulty} · Problem rating {item.problemRating} · Skill rating {item.rating} ({item.delta > 0 ? "+" : ""}{item.delta})</p>
          <blockquote>{item.evidence.quote}</blockquote><small>{item.evidence.source === "code" ? "Your code" : "Your message"}</small><p>{item.explanation}</p><p>{item.nextStep}</p>
        </div>)}</details>
      </> : <p>No evidence yet. This skill will be updated when it comes up in an interview.</p>}
    </section>)}</div>
    {filter === "practise" && !summaries.some(skill => skill.latest?.status === "practise") && <p>No observed practice areas yet.</p>}
    <section className="anki-help"><h2>Your flashcards</h2><p>Review these AI-generated cards, then export and import the text file in Anki: File → Import. Use Basic notes; Front, Back, and Tags are specified in the file. Importing the same question again can update its answer rather than add a duplicate.</p>
      {[...sessions].reverse().filter(session => session.cards.length).map(session => <details key={session.id}><summary>{getProblem(session.problemId)!.title} · {session.cards.length} cards · {new Date(session.completedAt).toLocaleDateString()}</summary>{session.cards.map((card, index) => <div className="flashcard-preview" key={index}><strong>{card.front}</strong><p>{card.back}</p></div>)}</details>)}
      {!cardCount && <p>Cards will appear when feedback identifies a specific skill to practise.</p>}
    </section>
  </main>;
}
