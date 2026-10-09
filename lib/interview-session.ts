import type { Message } from "./interview";

export const MAX_USER_MESSAGES = 20;
export const MAX_HISTORY_CHARACTERS = 60_000;

export function countUserMessages(messages: Message[]) {
  return messages.filter((message) => message.role === "user").length;
}

// Keep every turn (and its message count) rather than dropping early reasoning.
// If necessary, shorten older text explicitly, retaining the latest turns.
export function prepareInterviewHistory(messages: Message[]): Message[] {
  let excess = messages.reduce((total, message) => total + message.content.length, 0) - MAX_HISTORY_CHARACTERS;
  return messages.map((message) => {
    if (excess <= 0 || message.content.length <= 300) return message;
    const length = Math.max(300, message.content.length - excess);
    const marker = "\n[Earlier message shortened to fit the interview context.]";
    const content = message.content.slice(0, length - marker.length) + marker;
    excess -= message.content.length - content.length;
    return { ...message, content };
  });
}
