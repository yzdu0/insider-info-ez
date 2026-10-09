import { ApiError, GoogleGenAI } from "@google/genai";
import { transcriptionConfig } from "@/lib/transcription";

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin !== new URL(request.url).origin) {
    return Response.json({ error: "Please enable voice from this app." }, { status: 403 });
  }
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "Add GEMINI_API_KEY to your .env file and restart the development server." }, { status: 503 });
  }
  const model = process.env.GEMINI_TRANSCRIPTION_MODEL || "gemini-3.5-transcribe-live";
  try {
    const ai = new GoogleGenAI({ apiKey, httpOptions: { apiVersion: "v1beta" } });
    const token = await ai.authTokens.create({
      config: {
        uses: 1,
        newSessionExpireTime: new Date(Date.now() + 60_000).toISOString(),
        expireTime: new Date(Date.now() + 15 * 60_000).toISOString(),
        liveConnectConstraints: { model, config: transcriptionConfig },
        httpOptions: { timeout: 15_000 },
        abortSignal: request.signal,
      },
    });
    if (!token.name) throw new Error("Missing token");
    return Response.json({ token: token.name, model }, { headers: { "Cache-Control": "no-store" } });
  } catch (failure) {
    // Upstream errors can contain credentials; only return our own messages.
    const status = failure instanceof ApiError ? failure.status : 502;
    if (status === 429) return Response.json({ error: "Gemini voice quota is exhausted. Try again later or type your thoughts." }, { status: 429 });
    if (status === 400 || status === 401 || status === 403 || status === 404) {
      return Response.json({ error: "Gemini voice is unavailable. Check your API key and GEMINI_TRANSCRIPTION_MODEL access." }, { status: 502 });
    }
    return Response.json({ error: "Couldn’t connect to Gemini voice. Try again or type your thoughts." }, { status: 502 });
  }
}
