"use client";

import type { Session } from "@google/genai";
import { useCallback, useEffect, useRef, useState } from "react";
import { PreparedVoiceConnection, VoiceConnectionPool, VoiceSetupError } from "./prepared-voice-connection";
import { MAX_TRANSCRIPT_LENGTH } from "./transcription";

type VoiceState = "idle" | "connecting" | "recording" | "finishing";
type Recording = {
  phase: VoiceState;
  context: AudioContext;
  connection?: PreparedVoiceConnection;
  session?: Session;
  stream?: MediaStream;
  source?: MediaStreamAudioSourceNode;
  worklet?: AudioWorkletNode;
  timer?: ReturnType<typeof setTimeout>;
  flushTimer?: ReturnType<typeof setTimeout>;
  interim: string;
  hasAudioActivity: boolean;
  streamEnded: boolean;
};

export function useMicrophone(onTranscript: (text: string) => void, onRecover: (text: string) => void, enabled = true) {
  const [state, setState] = useState<VoiceState>("idle");
  const [preview, setPreview] = useState("");
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const current = useRef<Recording | null>(null);
  const pool = useRef<VoiceConnectionPool | null>(null);
  const callbacks = useRef({ onTranscript, onRecover });
  const enabledRef = useRef(enabled);
  useEffect(() => { enabledRef.current = enabled; }, [enabled]);
  useEffect(() => { callbacks.current = { onTranscript, onRecover }; }, [onTranscript, onRecover]);

  const dispose = useCallback((recording: Recording) => {
    if (current.current === recording) current.current = null;
    clearTimeout(recording.timer); clearTimeout(recording.flushTimer);
    recording.connection?.close();
    recording.stream?.getTracks().forEach((track) => track.stop());
    recording.source?.disconnect(); recording.worklet?.disconnect();
    if (recording.worklet) recording.worklet.port.onmessage = null;
    void recording.context.close().catch(() => {});
    setState("idle"); setPreview(""); setAudioLevel(0);
    if (enabledRef.current) pool.current?.prepare();
  }, []);

  const cancel = useCallback((preserve = false) => {
    const recording = current.current;
    if (recording) {
      const draft = recording.interim.trim();
      dispose(recording);
      if (preserve && draft) callbacks.current.onRecover(draft);
    }
    setError("");
  }, [dispose]);

  const fail = useCallback((recording: Recording, message: string) => {
    if (current.current !== recording) return;
    const draft = recording.interim.trim();
    dispose(recording); setError(message);
    if (draft) callbacks.current.onRecover(draft);
  }, [dispose]);

  const stop = useCallback(() => {
    const recording = current.current;
    if (!recording || recording.phase === "finishing") return;
    if (recording.phase === "connecting") { cancel(); return; }
    recording.phase = "finishing";
    setState("finishing"); setAudioLevel(0);
    clearTimeout(recording.timer);
    // Stop hardware immediately; the worklet can still flush its buffered PCM.
    recording.worklet?.port.postMessage("stop");
    recording.stream?.getTracks().forEach((track) => track.stop());
    recording.source?.disconnect();
    recording.flushTimer = setTimeout(() => fail(recording, "Microphone capture stopped unexpectedly. Your draft has been kept for editing."), 2_000);
  }, [cancel, fail]);

  const start = useCallback(async () => {
    if (!enabled || current.current) return;
    setError(""); setPreview("");
    if (!navigator.mediaDevices?.getUserMedia || !window.AudioContext || !window.AudioWorkletNode) {
      setError("Voice needs microphone support on HTTPS or localhost. You can still type your thoughts."); return;
    }
    let context: AudioContext;
    try { context = new AudioContext(); } catch { setError("Couldn’t start audio. Try again or type your thoughts."); return; }
    const recording: Recording = {phase:"connecting", context, interim:"", hasAudioActivity:false, streamEnded:false};
    current.current = recording; setState("connecting");
    recording.timer = setTimeout(() => fail(recording, "Microphone setup timed out. Enable mic to try again."), 20_000);
    try {
      if (!pool.current) pool.current = new VoiceConnectionPool(setReady);
      recording.connection = pool.current.take();
      await context.resume();
      if (current.current !== recording) return;
      const stream = await navigator.mediaDevices.getUserMedia({audio:{channelCount:1,echoCancellation:true,noiseSuppression:true},video:false});
      if (current.current !== recording) { stream.getTracks().forEach((track) => track.stop()); return; }
      recording.stream = stream;
      await context.audioWorklet.addModule("/audio/pcm-capture.js");
      if (current.current !== recording) return;
      const connection = recording.connection;
      connection.onMessage = (message) => {
        if (current.current !== recording) return;
        const content = message.serverContent;
        if (!content) return;
        if (content.interimInputTranscription) {
          recording.interim = content.interimInputTranscription.text ?? "";
          setPreview(recording.interim);
          if (recording.interim.length > MAX_TRANSCRIPT_LENGTH) {
            fail(recording, "Your transcript is too long. Edit it to 4,000 characters before sending."); return;
          }
        }
        // This transcription model emits authoritative text at the end of each
        // speech turn. It may omit `finished`; model-completion events are not
        // candidate speech and must never submit a second message.
        if (content.inputTranscription?.text?.trim()) {
          const text = content.inputTranscription.text.trim();
          recording.interim = ""; recording.hasAudioActivity = false; setPreview("");
          if (text.length > MAX_TRANSCRIPT_LENGTH) {
            callbacks.current.onRecover(text);
            fail(recording, "Your transcript is too long. Edit it to 4,000 characters before sending."); return;
          }
          callbacks.current.onTranscript(text);
          if (recording.phase === "finishing" && recording.streamEnded) dispose(recording);
        }
      };
      connection.onDisconnect = () => fail(recording, "Gemini voice lost its connection. Any unfinished transcript has been kept for editing.");
      const session = await connection.session;
      if (current.current !== recording) return;
      recording.session = session;
      recording.worklet = new AudioWorkletNode(context, "pcm-capture");
      recording.source = context.createMediaStreamSource(stream);
      recording.worklet.port.onmessage = ({data}: MessageEvent<{pcm?:ArrayBuffer;stopped?:boolean}>) => {
        if (current.current !== recording || recording.streamEnded) return;
        try {
          if (data.pcm) {
            const samples = new DataView(data.pcm);
            let energy = 0;
            for (let offset=0;offset<samples.byteLength;offset+=2) energy += (samples.getInt16(offset,true)/32768) ** 2;
            const rms = samples.byteLength ? Math.sqrt(energy/(samples.byteLength/2)) : 0;
            if (rms >= 0.003) recording.hasAudioActivity = true;
            if (recording.phase === "recording") setAudioLevel(Math.min(1,Math.max(0,rms-0.008)*8));
            let binary = "";
            for (const byte of new Uint8Array(data.pcm)) binary += String.fromCharCode(byte);
            session.sendRealtimeInput({audio:{data:btoa(binary),mimeType:"audio/pcm;rate=16000"}});
          }
          if (data.stopped) {
            clearTimeout(recording.flushTimer);
            recording.streamEnded = true;
            if (!recording.hasAudioActivity && !recording.interim.trim()) { dispose(recording); return; }
            recording.timer = setTimeout(() => fail(recording, "The final transcript timed out. Any unfinished draft has been kept for editing."), 12_000);
            session.sendRealtimeInput({audioStreamEnd:true});
          }
        } catch { fail(recording, "Couldn’t send audio. Any unfinished transcript has been kept for editing."); }
      };
      recording.worklet.onprocessorerror = () => fail(recording, "Microphone capture failed. Try again or type your thoughts.");
      stream.getAudioTracks().forEach((track) => track.addEventListener("ended", () => {
        if (recording.phase === "recording") fail(recording, "Your microphone disconnected. Any unfinished transcript has been kept for editing.");
      }));
      recording.source.connect(recording.worklet);
      recording.worklet.connect(context.destination); // Silent output keeps capture processing.
      clearTimeout(recording.timer); recording.phase = "recording"; setState("recording");
      // The provider supports ten-minute transcription sessions. Finish before
      // its limit, rather than silently dropping audio on a closed connection.
      recording.timer = setTimeout(() => { stop(); setError("Microphone session ended. Enable mic again to continue."); }, 9 * 60_000);
    } catch (failure) {
      const name = failure instanceof DOMException ? failure.name : "";
      fail(recording, name === "NotAllowedError" ? "Microphone permission was denied. Allow it in your browser to use voice."
        : name === "NotFoundError" ? "No microphone found. Connect one or type your thoughts."
        : name === "NotReadableError" ? "Your microphone is unavailable. Check whether another app is using it."
        : failure instanceof VoiceSetupError ? failure.message : "Couldn’t start voice. Check Gemini voice access, then try again or type your thoughts.");
    }
  }, [dispose, enabled, fail, stop]);

  const toggle = useCallback(() => { if (current.current) stop(); else void start(); }, [start, stop]);
  const warm = useCallback(() => {
    if (!enabled || document.hidden || current.current || !navigator.mediaDevices?.getUserMedia || !window.AudioContext || !window.AudioWorkletNode) return;
    if (!pool.current) pool.current = new VoiceConnectionPool(setReady);
    pool.current.prepare();
  }, [enabled]);

  useEffect(() => {
    if (!enabled) { cancel(true); pool.current?.close(); pool.current = null; }
    else warm();
  }, [cancel, enabled, warm]);

  useEffect(() => {
    const prepare = () => {
      if (!enabledRef.current || document.hidden || !navigator.mediaDevices?.getUserMedia || !window.AudioContext || !window.AudioWorkletNode) return;
      if (!pool.current) pool.current = new VoiceConnectionPool(setReady);
      pool.current.prepare();
    };
    prepare();
    const leave = () => cancel(true);
    const suspend = () => { pool.current?.close(); pool.current = null; leave(); };
    const hide = () => { if (document.hidden) suspend(); else prepare(); };
    window.addEventListener("blur", leave);
    window.addEventListener("pagehide", suspend);
    window.addEventListener("pageshow", prepare);
    document.addEventListener("visibilitychange", hide);
    return () => {
      window.removeEventListener("blur", leave);
      window.removeEventListener("pagehide", suspend);
      window.removeEventListener("pageshow", prepare);
      document.removeEventListener("visibilitychange", hide);
      pool.current?.close(); pool.current = null;
      if (current.current) dispose(current.current);
    };
  }, [cancel, dispose]);

  return {state,preview,error,audioLevel,active:state !== "idle",start,stop,cancel,toggle,ready,warm};
}
