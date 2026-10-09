import { ApiError, GoogleGenAI } from "@google/genai";
import { buildInterviewContents, interviewerInstruction, isFinalInterviewRequest, parseInterviewRequest } from "@/lib/interview";
import { parseFinalFeedback } from "@/lib/skills";
import { skillFeedbackInstruction, skillFeedbackSchema } from "@/lib/skill-feedback";

/**
 * POST /api/interview is the server-side bridge between the workspace and Gemini.
 * The browser sends the selected problem ID, language, current code, recent chat
 * history, and interaction mode. Final feedback also returns validated skill
 * observations and practice cards. Errors use an appropriate HTTP status.
 * This handler does not stream the response.
 *
 * Each request supplies its own history, so this route does not store a session.
 * It also does not compile or execute candidate code: Gemini reviews it as text.
 */
export async function POST(request: Request) {
  // Reject browser requests whose Origin differs from this endpoint's origin.
  // Origin includes the scheme, hostname, and port. Requests without this header
  // (for example, a CLI client) are allowed. This is a browser-origin guard, not
  // authentication or rate limiting: non-browser clients can omit/spoof Origin.
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return Response.json({ error: "Please send requests from this app." }, { status: 403 });
  }
  // Keep untrusted JSON typed as unknown until the shared validator checks it.
  let body: unknown;
  try {
    // Read text first so oversized serialized payloads can be rejected before
    // JSON parsing. This limit counts JavaScript string code units, not bytes,
    // and is checked after buffering the body; it is not a transport size limit.
    const raw = await request.text();
    if (raw.length > 128_000) return Response.json({ error: "This session is too large. Start a new interview." }, { status: 413 });
    body = JSON.parse(raw);
  } catch {
    // Body-reading failures and malformed JSON both produce a client error.
    return Response.json({ error: "The request must contain valid JSON." }, { status: 400 });
  }
  // Validate the known problem, supported language, mode, code length, and
  // message roles/content/limits. Feedback may follow an interviewer message.
  // Reject invalid input before making a potentially billable Gemini request.
  const data = parseInterviewRequest(body);
  if (!data) return Response.json({ error: "Invalid interview request. Check the problem, code, and messages." }, { status: 400 });
  // Next.js loads this server-only value from .env in local development.
  // Never return the key or expose it through a NEXT_PUBLIC_ variable. Reading
  // it here also allows the page to render when the API has not been configured.
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return Response.json({ error: "Add GEMINI_API_KEY to your .env file and restart the development server." }, { status: 503 });

  const startedAt = Date.now();
  const ending = isFinalInterviewRequest(data);
  try {
    // Create the SDK client only after validation and configuration succeed.
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      // Allow a server-side model override without changing the browser client.
      model: process.env.GEMINI_MODEL || "gemini-flash-latest",
      // Resolve the full server-only problem contract and combine it with the
      // latest code snapshot and chat. The helper maps assistant roles to the
      // SDK's "model" role; private requirements are not sent to the browser.
      contents: buildInterviewContents(data),
      config: {
        // These instructions define interviewer behavior, including revealing
        // requirements through candidate-led clarification and reviewing code
        // without claiming to run it.
        systemInstruction: ending ? `${interviewerInstruction}\n${skillFeedbackInstruction}` : interviewerInstruction,
        ...(ending ? { responseMimeType: "application/json", responseJsonSchema: skillFeedbackSchema } : {}),
        // Permit some variation in conversational phrasing and bound output.
        // The token limit is separate from the prompt's requested word count.
        temperature: 0.7,
        maxOutputTokens: ending ? 8192 : 2048,
        // Bound the upstream HTTP wait to 45 seconds. Passing the incoming
        // request's signal also lets the SDK observe request cancellation.
        httpOptions: { timeout: 45_000 },
        abortSignal: request.signal,
      },
    });
    // The SDK's text accessor collects text from the response. An empty result
    // is an upstream failure (e.g. no usable text), not a successful chat turn.
    const reply = response.text?.trim();
    if (!reply) return Response.json({ error: "The interviewer returned no response. Please try again." }, { status: 502 });
    if (ending) {
      const feedback = parseFinalFeedback(reply, data);
      if (!feedback) return Response.json({ error: "The interviewer returned incomplete skill feedback. Please retry feedback." }, { status: 502 });
      return Response.json({ ...feedback, ended: true }, { headers: { "Cache-Control": "no-store" } });
    }
    // Return only the interviewer text, not SDK metadata or the private prompt.
    // Explicitly prevent caching this conversation-specific response.
    return Response.json({ reply, ended: isFinalInterviewRequest(data) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    // Translate SDK errors into controlled, actionable messages. Never forward
    // upstream bodies or error.message: those may contain sensitive details.
    // Log only diagnostic metadata: never the key, prompt, code, or raw error.
    const status = error instanceof ApiError ? error.status : 502;
    const errorName = error instanceof Error ? error.name : "UnknownError";
    console.error("Gemini interview request failed", {
      status,
      errorName,
      model: process.env.GEMINI_MODEL || "gemini-flash-latest",
      elapsedMs: Date.now() - startedAt,
    });
    // Preserve 429 so clients can distinguish quota/rate-limit failures.
    if (status === 429) return Response.json({ error: "Gemini’s quota is currently exhausted. Wait a moment or check your API quota, then retry." }, { status: 429 });
    if (status === 401 || status === 403) return Response.json({ error: "Gemini could not authenticate this request. Check your API key and its access in Google AI Studio." }, { status: 502 });
    if (status === 400) return Response.json({ error: "Gemini rejected the request. Check the configured model and server configuration; this does not necessarily mean your API key is invalid." }, { status: 502 });
    // A missing upstream resource commonly points to the configured model.
    if (status === 404) return Response.json({ error: "The configured Gemini model is unavailable. Check GEMINI_MODEL in .env." }, { status: 502 });
    if (status === 408 || status === 504 || errorName === "TimeoutError" || errorName === "AbortError") return Response.json({ error: "The Gemini request timed out or was interrupted. Please retry." }, { status: 504 });
    if (error instanceof ApiError && status >= 500) return Response.json({ error: "Gemini is temporarily unavailable. Please retry in a moment." }, { status: 502 });
    // All other upstream failures share a retryable message without exposing
    // provider internals. The workspace keeps the failed turn available to retry.
    return Response.json({ error: "The interviewer couldn’t connect to Gemini. Please try again." }, { status: 502 });
  }
}
