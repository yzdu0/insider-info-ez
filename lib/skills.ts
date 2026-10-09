import { getProblem, type Language } from "./problems";
import type { InterviewRequest } from "./interview";

export const skills = [
  { id: "reasoning", name: "Requirements & reasoning" },
  { id: "testing", name: "Correctness & testing" },
  { id: "structures", name: "Data structures" },
  { id: "complexity", name: "Algorithms & complexity" },
  { id: "design", name: "Software design" },
  { id: "memory", name: "Ownership & memory safety" },
  { id: "concurrency", name: "Concurrency" },
  { id: "distributed", name: "Distributed systems" },
] as const;
export type SkillId = (typeof skills)[number]["id"];
export type SkillObservation = {
  skillId: SkillId;
  status: "strength" | "practise";
  evidence: { source: "code" | "candidate"; quote: string };
  explanation: string;
  nextStep: string;
};
export type Flashcard = { skillId: SkillId; front: string; back: string };
export type Assessment = { skills: SkillObservation[]; cards: Flashcard[] };
export type SkillSession = Assessment & { id: string; problemId: string; language: Language; completedAt: string; difficulty?: "Easy" | "Medium" | "Hard" | "Expert" };
export const MAX_SAVED_SESSIONS = 100;
export const skillName = (id: SkillId) => skills.find(skill => skill.id === id)!.name;
const legacyIds = ["requirements", "reasoning", "correctness", "testing", "complexity", "design", "memory", "concurrency", "compilers"];
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const text = (value: unknown, limit: number): value is string => typeof value === "string" && !!value.trim() && value.length <= limit;

// Provider output and browser storage are untrusted. Validate both before use.
export function parseAssessment(value: unknown): Assessment | null {
  return parseAssessmentWithIds(value, skills.map(skill => skill.id));
}

function parseAssessmentWithIds(value: unknown, ids: readonly string[]): Assessment | null {
  const validId = (id: unknown): id is SkillId => typeof id === "string" && ids.includes(id);
  if (!object(value) || !Array.isArray(value.skills) || value.skills.length > ids.length || !Array.isArray(value.cards) || value.cards.length > 6) return null;
  const seen = new Set<SkillId>();
  for (const item of value.skills) {
    if (!object(item) || !validId(item.skillId) || seen.has(item.skillId) || !["strength", "practise"].includes(item.status as string) ||
        !object(item.evidence) || !["code", "candidate"].includes(item.evidence.source as string) || !text(item.evidence.quote, 600) ||
        !text(item.explanation, 800) || !text(item.nextStep, 800)) return null;
    seen.add(item.skillId);
  }
  for (const card of value.cards) {
    if (!object(card) || !validId(card.skillId) || !text(card.front, 500) || !text(card.back, 2000) ||
        !value.skills.some(item => item.skillId === card.skillId && item.status === "practise")) return null;
  }
  return {
    skills: (value.skills as SkillObservation[]).map(item => ({ skillId: item.skillId, status: item.status, evidence: { source: item.evidence.source, quote: item.evidence.quote }, explanation: item.explanation, nextStep: item.nextStep })),
    cards: (value.cards as Flashcard[]).map(item => ({ skillId: item.skillId, front: item.front, back: item.back })),
  };
}

// Only stored v1 data uses legacy IDs. Never accept them from new feedback.
function migrateLegacySession(value: unknown): SkillSession | null {
  if (!object(value)) return null;
  const assessment = parseAssessmentWithIds(value, legacyIds);
  if (!assessment) return null;
  const remap = (id: string) => id === "requirements" ? "reasoning" : id === "correctness" ? "testing" : id;
  const merged = new Map<string, SkillObservation>();
  for (const observation of assessment.skills) {
    if ((observation.skillId as string) === "compilers") continue;
    const id = remap(observation.skillId) as SkillId;
    // Keep a concrete practice observation when merged skills disagree. Do not
    // infer strengths in newly introduced technical topics from old labels.
    if (!merged.has(id) || observation.status === "practise") merged.set(id, { ...observation, skillId: id });
  }
  const cards = assessment.cards.filter(card => (card.skillId as string) !== "compilers")
    .map(card => ({ ...card, skillId: remap(card.skillId) as SkillId }));
  return parseSkillSession({ ...value, skills: [...merged.values()], cards });
}

export function parseFinalFeedback(raw: string, data: InterviewRequest): { reply: string; assessment: Assessment } | null {
  let value: unknown;
  try { value = JSON.parse(raw); } catch { return null; }
  if (!object(value) || !text(value.reply, 12_000)) return null;
  const assessment = parseAssessment(value);
  if (!assessment) return null;
  const candidateMessages = data.messages.filter(message => message.role === "user");
  // Untouched starter code is not evidence of the candidate's skill.
  const candidateCode = data.code === getProblem(data.problemId)?.starters[data.language] ? "" : data.code;
  for (const observation of assessment.skills) {
    const { source, quote } = observation.evidence;
    if (source === "code" ? !candidateCode.includes(quote) : !candidateMessages.some(message => message.content.includes(quote))) return null;
  }
  return { reply: value.reply, assessment };
}

export function parseSkillSession(value: unknown): SkillSession | null {
  if (!object(value) || !text(value.id, 100) || !text(value.completedAt, 40) || !Number.isFinite(Date.parse(value.completedAt)) ||
      typeof value.problemId !== "string" || !getProblem(value.problemId) || !["python", "cpp", "pseudocode"].includes(value.language as string)) return null;
  if (value.difficulty !== undefined && !["Easy", "Medium", "Hard", "Expert"].includes(value.difficulty as string)) return null;
  const assessment = parseAssessment(value);
  return assessment ? { ...assessment, id: value.id, problemId: value.problemId, language: value.language as Language, completedAt: new Date(value.completedAt).toISOString(), difficulty: (value.difficulty ?? getProblem(value.problemId)!.difficulty) as SkillSession["difficulty"] } : null;
}

export function parseSkillHistory(raw: string | null): SkillSession[] | null {
  if (raw === null) return [];
  if (raw.length > 5_000_000) return null;
  try {
    const value = JSON.parse(raw);
    if (!object(value) || ![1, 2].includes(value.version as number) || !Array.isArray(value.sessions) || value.sessions.length > MAX_SAVED_SESSIONS) return null;
    const sessions = value.sessions.map(value.version === 1 ? migrateLegacySession : parseSkillSession);
    if (sessions.some(session => !session) || new Set(sessions.map(session => session!.id)).size !== sessions.length) return null;
    return sessions as SkillSession[];
  } catch { return null; }
}

export function summarizeSkills(sessions: SkillSession[]) {
  const newest = [...new Map(sessions.map(session => [session.id, session])).values()]
    .sort((a, b) => b.completedAt.localeCompare(a.completedAt) || b.id.localeCompare(a.id));
  return skills.map(skill => {
    let rating = INITIAL_SKILL_RATING;
    const attempts = new Map<string, number>();
    const observations = newest.slice().reverse().flatMap(session => {
      const observation = session.skills.find(item => item.skillId === skill.id);
      if (!observation) return [];
      const problemRating = PROBLEM_RATINGS[session.difficulty ?? getProblem(session.problemId)!.difficulty];
      const expected = 1 / (1 + 10 ** ((problemRating - rating) / 400));
      const attempt = (attempts.get(session.problemId) ?? 0) + 1;
      const k = attempts.size < 5 ? 40 : 24;
      const before = rating;
      rating += (k / Math.sqrt(attempt)) * ((observation.status === "strength" ? 1 : 0) - expected);
      attempts.set(session.problemId, attempt);
      return [{ ...observation, session, rating: Math.round(rating), delta: Math.round(rating) - Math.round(before), problemRating, expected, attempt }];
    }).reverse();
    const latest = observations[0];
    const previous = observations[1];
    return { ...skill, observations, latest, rating: Math.round(rating), delta: latest?.delta ?? 0, provisional: attempts.size < 5, ratedProblems: attempts.size, change: latest && previous && latest.status !== previous.status ? latest.status === "strength" ? "Improved since previous observation" : "Needs renewed practice" : null };
  });
}

// Fixed difficulty anchors: a personal practice estimate, not a leaderboard.
// Compute from evidence in retained history, never a model-generated score.
export const INITIAL_SKILL_RATING = 1200;
export const PROBLEM_RATINGS = { Easy: 1000, Medium: 1200, Hard: 1400, Expert: 1600 } as const;
