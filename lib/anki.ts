import type { SkillSession } from "./skills";

// Anki imports UTF-8 tab-separated text; HTML preserves code/newlines. Escape
// every provider-supplied character before adding our own line breaks.
function field(text: string) {
  const html = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/\r\n?|\n/g, "<br>").replace(/\t/g, "    ");
  return `"${html.replace(/"/g, '""')}"`;
}
export function exportAnki(sessions: SkillSession[]) {
  const seen = new Set<string>();
  const rows: string[] = [];
  for (const session of [...sessions].sort((a, b) => b.completedAt.localeCompare(a.completedAt))) {
    for (const card of session.cards) {
      const key = card.front.trim().toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push([field(card.front), field(card.back), `ThinkingAloud skill::${card.skillId} problem::${session.problemId}`].join("\t"));
    }
  }
  return rows.length ? ["#separator:Tab", "#html:true", "#notetype:Basic", "#tags column:3", "#columns:Front\tBack\tTags", ...rows, ""].join("\n") : "";
}
export function downloadAnki(sessions: SkillSession[]) {
  const content = exportAnki(sessions);
  if (!content) return;
  const url = URL.createObjectURL(new Blob([content], { type: "text/plain;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url; anchor.download = "thinkingaloud-anki.txt";
  document.body.appendChild(anchor); anchor.click(); anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}
