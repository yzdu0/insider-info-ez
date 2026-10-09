import { GoogleGenAI, type LiveServerMessage, type Session } from "@google/genai";
import { transcriptionConfig } from "./transcription";

export class VoiceSetupError extends Error {}

// A connection is prepared without touching the microphone. Each microphone
// session consumes one connection so late events cannot leak into a new session.
export class PreparedVoiceConnection {
  readonly session: Promise<Session>;
  onMessage?: (message: LiveServerMessage) => void;
  onDisconnect?: () => void;
  private abort = new AbortController();
  private connected?: Session;
  private closed = false;
  private claimed = false;
  private timer?: ReturnType<typeof setTimeout>;

  constructor(onReady: () => void, onUnavailable: () => void, onExpire: () => void) {
    this.timer = setTimeout(() => this.close(), 20_000);
    this.session = this.connect().then((session) => {
      if (this.closed) { session.close(); throw new VoiceSetupError("Voice connection was cancelled."); }
      this.connected = session;
      clearTimeout(this.timer);
      if (!this.claimed) {
        onReady();
        // Retire idle connections after two minutes, leaving time for a full
        // nine-minute microphone session within the fifteen-minute token expiry.
        this.timer = setTimeout(() => { this.close(); onExpire(); }, 120_000);
      }
      return session;
    }).catch((failure) => {
      this.close(); onUnavailable();
      throw failure instanceof VoiceSetupError ? failure : new VoiceSetupError("Couldn’t connect to Gemini voice. Try again or type your thoughts.");
    });
    // Preloading may fail before a user enables the mic. Keep failures handled;
    // the caller still receives the error when it awaits this session.
    void this.session.catch(() => {});
  }

  get available() { return !this.closed && !this.claimed; }

  claim() {
    this.claimed = true;
    clearTimeout(this.timer);
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    clearTimeout(this.timer);
    this.abort.abort();
    this.connected?.close();
  }

  private async connect() {
    const response = await fetch("/api/transcription/token", { method: "POST", signal: this.abort.signal });
    const result = await response.json();
    if (!response.ok || typeof result.token !== "string" || typeof result.model !== "string") {
      throw new VoiceSetupError(result.error || "Couldn’t enable Gemini voice. Try again or type your thoughts.");
    }
    if (this.closed) throw new VoiceSetupError("Voice connection was cancelled.");
    const ai = new GoogleGenAI({ apiKey: result.token, httpOptions: { apiVersion: "v1beta" } });
    return ai.live.connect({
      model: result.model,
      config: transcriptionConfig,
      callbacks: {
        onmessage: (message) => { if (!this.closed) this.onMessage?.(message); },
        onerror: () => this.disconnected(),
        onclose: () => this.disconnected(),
      },
    });
  }

  private disconnected() {
    if (this.closed) return;
    this.close();
    this.onDisconnect?.();
  }
}

export class VoiceConnectionPool {
  private cached?: PreparedVoiceConnection;
  private disposed = false;

  constructor(private status: (ready: boolean) => void) {}

  prepare() {
    if (this.disposed || this.cached?.available) return;
    const connection = new PreparedVoiceConnection(
      () => { if (this.cached === connection) this.status(true); },
      () => { if (this.cached === connection) this.status(false); },
      () => { if (this.cached === connection) { this.status(false); this.prepare(); } },
    );
    connection.onDisconnect = () => { if (this.cached === connection) this.status(false); };
    this.cached = connection;
  }

  take() {
    this.prepare();
    const connection = this.cached;
    if (!connection) throw new VoiceSetupError("Voice is not ready. Try again.");
    connection.claim();
    this.cached = undefined;
    this.status(false);
    return connection;
  }

  close() {
    this.disposed = true;
    this.cached?.close();
    this.cached = undefined;
    this.status(false);
  }
}
