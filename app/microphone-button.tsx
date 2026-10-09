"use client";

import { Mic, MicOff } from "lucide-react";
import type { useMicrophone } from "@/lib/use-microphone";

export function MicrophoneButton({voice,disabled}:{voice:ReturnType<typeof useMicrophone>;disabled:boolean}) {
  const micOn = voice.state === "recording" || voice.state === "connecting";
  return <button
    type="button"
    className={`voice-button ${voice.state === "recording" ? "recording" : ""}`}
    aria-label={micOn ? "Disable microphone" : "Enable microphone"}
    aria-describedby="voice-help"
    aria-pressed={micOn}
    aria-keyshortcuts="Alt+Space"
    onPointerEnter={voice.warm}
    onFocus={voice.warm}
    disabled={voice.state === "finishing" || (disabled && !voice.active)}
    onClick={voice.toggle}
  >
    {micOn ? <MicOff size={15} aria-hidden="true" /> : <Mic size={15} aria-hidden="true" />}
    {voice.state === "connecting" ? "Connecting…" : voice.state === "recording" ? "Disable mic" : voice.state === "finishing" ? "Finishing…" : "Enable mic"}
  </button>;
}
