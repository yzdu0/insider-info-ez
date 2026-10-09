import { Modality, AudioTranscriptionConfigMode, type LiveConnectConfig } from "@google/genai";

export const transcriptionConfig: LiveConnectConfig = {
  responseModalities: [Modality.TEXT],
  inputAudioTranscription: { mode: AudioTranscriptionConfigMode.VERBATIM },
  realtimeInputConfig: { automaticActivityDetection: { disabled: false, silenceDurationMs: 900 } },
};

export const MAX_TRANSCRIPT_LENGTH = 4_000;
