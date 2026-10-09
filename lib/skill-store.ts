"use client";

import { useSyncExternalStore } from "react";
import { MAX_SAVED_SESSIONS, parseSkillHistory, parseSkillSession, type SkillSession } from "./skills";

export const SKILL_STORAGE_KEY = "thinkingaloud.skills.v1";
type Snapshot = { sessions: SkillSession[]; warning: string };
const empty: Snapshot = { sessions: [], warning: "" };
let snapshot = empty;
let lastRaw: string | null | undefined;
let memoryOnly = false;
const listeners = new Set<() => void>();
const announce = () => listeners.forEach(listener => listener());
function read(): Snapshot {
  if (memoryOnly) return snapshot;
  try {
    const raw = window.localStorage.getItem(SKILL_STORAGE_KEY);
    if (raw !== lastRaw) {
      lastRaw = raw;
      const sessions = parseSkillHistory(raw);
      snapshot = sessions ? { sessions, warning: "" } : { sessions: [], warning: "Saved progress could not be read. Clear saved progress to reset it; the original data has been left untouched." };
    }
  } catch {
    memoryOnly = true;
    snapshot = { ...snapshot, warning: "Browser storage is unavailable. Progress is kept only while this page stays open." };
  }
  return snapshot;
}
function write(sessions: SkillSession[]) {
  const raw = JSON.stringify({ version: 2, sessions });
  try {
    window.localStorage.setItem(SKILL_STORAGE_KEY, raw);
    lastRaw = raw; memoryOnly = false;
    snapshot = { sessions, warning: "" };
  } catch {
    memoryOnly = true;
    snapshot = { sessions, warning: "Progress could not be saved in this browser. Export your cards before leaving this page." };
  }
  announce();
  return snapshot.warning;
}
export function saveSkillSession(value: SkillSession): string {
  const session = parseSkillSession(value);
  if (!session) return "Skill feedback could not be saved because it was incomplete.";
  const current = read();
  if (current.warning && !memoryOnly) return current.warning;
  // Retrying feedback for the same interview updates its entry, not its count.
  return write([...current.sessions.filter(item => item.id !== session.id), session]
    .sort((a, b) => a.completedAt.localeCompare(b.completedAt)).slice(-MAX_SAVED_SESSIONS));
}
export function clearSkillHistory() { return write([]); }
function subscribe(listener: () => void) {
  listeners.add(listener);
  const changed = (event: StorageEvent) => {
    if (event.key === SKILL_STORAGE_KEY || event.key === null) { lastRaw = undefined; read(); listener(); }
  };
  window.addEventListener("storage", changed);
  return () => { listeners.delete(listener); window.removeEventListener("storage", changed); };
}
export function useSkillHistory() { return useSyncExternalStore(subscribe, read, () => empty); }
