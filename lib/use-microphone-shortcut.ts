"use client";

import { useEffect } from "react";

type VoiceControls = {active:boolean;toggle:()=>void;cancel:(preserve?:boolean)=>void};

export function useMicrophoneShortcut({active,toggle,cancel}:VoiceControls,disabled:boolean) {
  useEffect(() => {
    const down = (event:KeyboardEvent) => {
      if (event.code === "Escape" && active) { event.preventDefault(); cancel(true); return; }
      if (event.code !== "Space" || event.ctrlKey || !event.altKey || event.metaKey || event.shiftKey || event.isComposing) return;
      if (disabled && !active) return;
      event.preventDefault(); event.stopPropagation();
      if (!event.repeat) toggle();
    };
    window.addEventListener("keydown",down,true);
    return () => window.removeEventListener("keydown",down,true);
  }, [active,toggle,cancel,disabled]);
}
