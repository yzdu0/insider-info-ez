"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { getOpeningMessage, getProblem, type Language } from "@/lib/problems";
import type { InterviewRequest, Message } from "@/lib/interview";
import { countUserMessages, MAX_USER_MESSAGES, prepareInterviewHistory } from "@/lib/interview-session";
import { useMicrophone } from "@/lib/use-microphone";
import { useMicrophoneShortcut } from "@/lib/use-microphone-shortcut";
import { MAX_TRANSCRIPT_LENGTH } from "@/lib/transcription";
import { MicrophoneButton } from "./microphone-button";
import { VoiceWaveform } from "./voice-waveform";
import { parseAssessment, type SkillSession } from "@/lib/skills";
import { saveSkillSession } from "@/lib/skill-store";
import { SessionSkills } from "./session-skills";

const Editor = dynamic(() => import("@monaco-editor/react"), { ssr: false, loading: () => <div className="editor-loading">Loading editor…</div> });
type Mode = InterviewRequest["mode"];

export default function InterviewWorkspace({ initialProblemId }: { initialProblemId: string }) {
  const initialProblem = getProblem(initialProblemId)!;
  const [problemId, setProblemId] = useState<string>(initialProblem.id);
  const problem = getProblem(problemId)!;
  const [language, setLanguage] = useState<Language>(initialProblem.preferredLanguage);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const draftKey = `${problemId}:${language}`;
  const code = drafts[draftKey] ?? problem.starters[language] ?? "";
  const [messages, setMessages] = useState<Message[]>([{ role: "assistant", content: getOpeningMessage(initialProblem) }]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [failedRequest, setFailedRequest] = useState<InterviewRequest | null>(null);
  const [ended, setEnded] = useState(false);
  const [endingRequested, setEndingRequested] = useState(false);
  const [pendingVoice, setPendingVoice] = useState<{ text: string; code: string }[]>([]);
  const [skillSession, setSkillSession] = useState<SkillSession | null>(null);
  const [storageWarning, setStorageWarning] = useState("");
  const sessionId = useRef<string | null>(null);
  const userMessageCount = countUserMessages(messages);
  const atLimit = userMessageCount >= MAX_USER_MESSAGES;
  const conversationClosed = ended || atLimit || endingRequested;
  const chatLog = useRef<HTMLDivElement>(null);
  const inFlight = useRef(false);
  const voice = useMicrophone(
    (transcript) => {
      if (conversationClosed || failedRequest) return;
      // Snapshot the code when the sentence finishes, then serialize requests
      // through a render so each next turn includes the preceding AI response.
      setPendingVoice((queue) => queue.length + userMessageCount < MAX_USER_MESSAGES ? [...queue, { text: transcript, code }] : queue);
    },
    (transcript) => setInput((draft) => draft ? `${draft}\n${transcript}` : transcript),
    !conversationClosed && !failedRequest && userMessageCount + pendingVoice.length < MAX_USER_MESSAGES,
  );
  useMicrophoneShortcut(voice, conversationClosed || busy || !!failedRequest || !!input.trim() || userMessageCount + pendingVoice.length >= MAX_USER_MESSAGES);

  useEffect(() => {
    const log = chatLog.current;
    if (log && (messages.length > 1 || voice.active || voice.error)) {
      // Scroll only the conversation, keeping the microphone control stationary.
      log.scrollTo({ top: log.scrollHeight, behavior: voice.active ? "auto" : "smooth" });
    }
  }, [messages, pendingVoice, busy, error, voice.active, voice.state, voice.preview, voice.error]);

  function newInterview(id = problemId) {
    if (busy) return;
    if (messages.length > 1 && !window.confirm("Start a new interview? This will clear the chat. Your code drafts will stay in this tab.")) return;
    voice.cancel();
    setPendingVoice([]);
    setSkillSession(null); setStorageWarning(""); sessionId.current = null;
    const nextProblem = getProblem(id)!;
    if (id !== problemId || nextProblem.starters[language] === undefined) setLanguage(nextProblem.preferredLanguage);
    setProblemId(id);
    setMessages([{ role: "assistant", content: getOpeningMessage(nextProblem) }]);
    setInput(""); setError(""); setFailedRequest(null); setEnded(false); setEndingRequested(false);
  }

  const requestReply = useCallback(async (payload: InterviewRequest) => {
    if (inFlight.current) return;
    inFlight.current = true;
    if (payload.mode === "feedback") setEndingRequested(true);
    setBusy(true); setError(""); setFailedRequest(null);
    try {
      const response = await fetch("/api/interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(55_000),
      });
      const result = await response.json();
      if (!response.ok || typeof result.reply !== "string") throw new Error(result.error || "The interviewer couldn’t respond. Try again.");
      setMessages((history) => [...history, { role: "assistant", content: result.reply }]);
      if (result.ended === true || payload.mode === "feedback" || countUserMessages(payload.messages) >= MAX_USER_MESSAGES) {
        setEnded(true);
        const assessment = parseAssessment(result.assessment);
        if (assessment) {
          sessionId.current ??= crypto.randomUUID();
          const session: SkillSession = { ...assessment, id: sessionId.current, problemId: payload.problemId, language: payload.language, difficulty: getProblem(payload.problemId)!.difficulty, completedAt: new Date().toISOString() };
          setSkillSession(session); setStorageWarning(saveSkillSession(session));
        }
      }
    } catch (failure) {
      setError(failure instanceof Error && failure.name !== "TimeoutError" ? failure.message : "The request timed out. Please try again.");
      setFailedRequest(payload);
    } finally {
      setBusy(false); inFlight.current = false;
    }
  }, []);

  const send = useCallback((content = input, mode: Mode = "interview", codeSnapshot = code, preserveDraft = false) => {
    if (conversationClosed || !content.trim() || content.trim().length > MAX_TRANSCRIPT_LENGTH || inFlight.current || failedRequest) return;
    const history: Message[] = [...messages, { role: "user", content: content.trim() }];
    setMessages(history);
    if (!preserveDraft) setInput("");
    void requestReply({ problemId, language, code: codeSnapshot, mode: countUserMessages(history) >= MAX_USER_MESSAGES ? "feedback" : mode, messages: prepareInterviewHistory(history) });
  }, [input, code, conversationClosed, failedRequest, messages, problemId, language, requestReply]);

  useEffect(() => {
    if (!pendingVoice.length) return;
    let cancelled = false;
    // Run after the commit, when history and callbacks include the last reply.
    // Cleanup prevents an outdated render from draining a reset interview.
    queueMicrotask(() => {
      if (cancelled) return;
      if (conversationClosed) { setPendingVoice([]); return; }
      if (busy || inFlight.current || failedRequest) return;
      const next = pendingVoice[0];
      setPendingVoice((queue) => queue.slice(1));
      send(next.text, "interview", next.code, true);
    });
    return () => { cancelled = true; };
  }, [pendingVoice, conversationClosed, busy, failedRequest, send]);

  function giveUp() {
    if (ended || inFlight.current) return;
    voice.cancel();
    setPendingVoice([]);
    void requestReply({ problemId, language, code, mode: "feedback", messages: prepareInterviewHistory(messages) });
  }

  return (
    <div className="app-shell">
      <header className="site-header">
        <Link className="brand" href="/" aria-label="ThinkingAloud home"><span className="brand-mark">{ "{}" }</span>Thinking<span className="brand-light">Aloud</span><span className="brand-dot"></span></Link>
        <div className="header-actions"><Link className="secondary-button" href="/skills">Your skills</Link><Link className="secondary-button" href="/">Problems</Link><button className="secondary-button" onClick={() => newInterview()} disabled={busy}>New interview</button></div>
      </header>
      <main>
        <section className="problem-strip" aria-label="Problem">
          <h1 className="interview-title">{problem.title}</h1>
        </section>
        <div className="workspace">
          <section className="code-panel panel" aria-labelledby="code-heading">
            <div className="editor-toolbar"><span id="code-heading" className="file-tab">{language === "python" ? "solution.py" : language === "cpp" ? "solution.cpp" : "approach.txt"}</span><div className="editor-language"><label className="sr-only" htmlFor="language">Editor language</label><select id="language" value={language} onChange={(event) => setLanguage(event.target.value as Language)} disabled={busy || voice.active || !!pendingVoice.length}>{problem.starters.python !== undefined && <option value="python">Python</option>}{problem.starters.cpp !== undefined && <option value="cpp">C++</option>}{problem.starters.pseudocode !== undefined && <option value="pseudocode">Pseudocode</option>}</select></div></div>
            <div className="editor-container"><Editor height="100%" language={language === "pseudocode" ? "plaintext" : language} theme="vs" value={code} onChange={(value) => setDrafts((current) => ({ ...current, [draftKey]: value ?? "" }))} options={{ fontSize: 14, fontFamily: "var(--font-geist-mono), monospace", minimap: { enabled: false }, padding: { top: 24, bottom: 20 }, scrollBeyondLastLine: false, lineNumbersMinChars: 3, renderLineHighlight: "none", overviewRulerBorder: false, hideCursorInOverviewRuler: true, tabSize: 4, wordWrap: "on", automaticLayout: true, ariaLabel: "Interview solution editor", readOnly: busy }} /></div>
            <div className="code-actions"><span>AI review · No execution</span><button className="review-button" disabled={conversationClosed || busy || voice.active || !!pendingVoice.length || !!failedRequest} onClick={() => send("Please review my current code and challenge my approach.", "review")}>Review code</button></div>
          </section>
          <section className="chat-panel panel" aria-labelledby="chat-heading">
            <div className="panel-header"><span id="chat-heading">Interviewer</span><span role="status">{conversationClosed ? "Interview ended" : voice.active ? "Microphone on" : voice.ready ? "Voice ready" : "Voice preparing…"}</span></div>
            <div ref={chatLog} className="chat-messages" role="log" aria-label="Interview conversation" aria-live="polite" aria-busy={busy}>
              {messages.map((message, index) => <div key={index} className={`message ${message.role}`}><div className="message-author">{message.role === "assistant" ? "Interviewer" : "You"}</div><div className="message-body"><ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown></div></div>)}
              {skillSession && <SessionSkills session={skillSession} />}
              {storageWarning && <p className="chat-error" role="alert">{storageWarning}</p>}
              {busy && <div className="thinking"><span className="thinking-dots">•••</span> {conversationClosed ? "Preparing feedback…" : "Thinking…"}</div>}
              {error && <div className="chat-error" role="alert"><p>{error}</p><button onClick={() => failedRequest && void requestReply(failedRequest)} disabled={busy}>{failedRequest?.mode === "feedback" ? "Retry feedback" : "Retry response"}</button>{failedRequest?.mode !== "feedback" && <button onClick={() => { setMessages((history) => history.slice(0, -1)); setInput(failedRequest?.messages.at(-1)?.content ?? ""); setFailedRequest(null); setError(""); }}>Edit message</button>}</div>}
              {voice.active && <div className="voice-preview"><div className="voice-preview-heading">{voice.state === "recording" && <VoiceWaveform level={voice.audioLevel} />}<span role="status">{voice.state === "connecting" ? "Setting up microphone…" : voice.state === "recording" ? "Listening — pause to send a sentence." : "Finishing your transcript…"}</span></div>{voice.preview && <p>{voice.preview}</p>}</div>}
              {pendingVoice.length > 0 && <div className="voice-preview"><span role="status">{pendingVoice.length} spoken {pendingVoice.length === 1 ? "message" : "messages"} queued</span>{pendingVoice.map((turn, index) => <p key={index}>{turn.text}</p>)}</div>}
              {voice.error && <p className="voice-error" role="alert">{voice.error}</p>}
              {input.length > MAX_TRANSCRIPT_LENGTH && <p className="voice-error" role="alert">Shorten your draft to 4,000 characters before sending ({input.length.toLocaleString()} currently).</p>}
            </div>
            <div className="chat-compose">
              <div className="interview-progress">
                <span>{userMessageCount}/{MAX_USER_MESSAGES} messages</span>
                {!ended && <button type="button" className="give-up-button" onClick={giveUp} disabled={busy}>{endingRequested ? busy ? "Preparing feedback…" : "Retry feedback" : atLimit ? "View feedback" : "Give up & see feedback"}</button>}
              </div>
              {conversationClosed && <p className="interview-ended" role="status">{ended ? "Interview complete. Your feedback is above. Start a new interview to try again." : atLimit ? "You’ve reached the 20-message limit. This interview ends with feedback." : "This interview has ended. Your feedback is being prepared; retry if it fails."}</p>}
              <form onSubmit={(event) => { event.preventDefault(); if (!voice.active) send(); }}>
                <label className="sr-only" htmlFor="thoughts">Share your thoughts with the interviewer</label>
                <textarea id="thoughts" placeholder="Ask or think out loud…" value={input} onChange={(event) => setInput(event.target.value)} maxLength={MAX_TRANSCRIPT_LENGTH} disabled={conversationClosed || busy || voice.active || !!pendingVoice.length || !!failedRequest} rows={3} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); send(); } }} />
                <div className="compose-bottom">
                  <MicrophoneButton voice={voice} disabled={conversationClosed || busy || !!failedRequest || !!input.trim() || userMessageCount + pendingVoice.length >= MAX_USER_MESSAGES} />
                  <span>Enter ↵</span>
                  <button className="send-button" type="submit" aria-label="Send message" disabled={conversationClosed || busy || voice.active || !!pendingVoice.length || !!failedRequest || !input.trim() || input.trim().length > MAX_TRANSCRIPT_LENGTH}>{busy ? "…" : "↑"}</button>
                </div>
              </form>
              <p id="voice-help" className="voice-help">Enable your mic and speak. Pause after a sentence to send it automatically. Option+Space on Mac (Alt+Space elsewhere) toggles the mic; Escape turns it off. First use may need microphone permission.</p>
              <p className="privacy-note">Code, chat, and microphone audio while the mic is enabled are sent to Gemini.</p>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
