"use client";

import Link from "next/link";
import { downloadAnki } from "@/lib/anki";
import { skillName, summarizeSkills, type SkillSession } from "@/lib/skills";
import { useSkillHistory } from "@/lib/skill-store";

export function SessionSkills({ session }: { session: SkillSession }) {
  const { sessions } = useSkillHistory();
  const ratings = summarizeSkills([...sessions.filter(item => item.id !== session.id), session]);
  return <section className="session-skills" aria-label="Skills from this interview">
    <h3>Skills from this interview</h3>
    {!session.skills.length && <p>Not enough candidate work was observed to assess skills. Try an interview and explain your reasoning as you code.</p>}
    {session.skills.map(skill => <div className="session-skill" key={skill.skillId}>
      <strong>{skillName(skill.skillId)}</strong><span className={`skill-status ${skill.status}`}>{skill.status === "strength" ? "Strength observed" : "Practise next"}</span>
      {ratings.find(item => item.id === skill.skillId)?.observations.filter(item => item.session.id === session.id).map(item => <p className="skill-note" key={item.session.id}>Rating {item.rating} · <span className={item.delta >= 0 ? "rating-gain" : "rating-loss"}>{item.delta > 0 ? "+" : ""}{item.delta}</span> from this interview</p>)}
      <p>{skill.explanation}</p><p><strong>Next step:</strong> {skill.nextStep}</p>
      <details><summary>Observed evidence</summary><blockquote>{skill.evidence.quote}</blockquote><small>{skill.evidence.source === "code" ? "Your code" : "Your message"}</small></details>
    </div>)}
    <div className="skill-actions"><Link href="/skills">View all skills</Link>{session.cards.length > 0 && <button type="button" onClick={() => downloadAnki([session])}>Export {session.cards.length} Anki {session.cards.length === 1 ? "card" : "cards"}</button>}</div>
    {session.cards.length > 0 && <p className="skill-note">Import the downloaded text file in Anki using File → Import, with the Basic note type.</p>}
  </section>;
}
