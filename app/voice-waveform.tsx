// Decorative audio feedback: the adjacent status text announces recording.
export function VoiceWaveform({ level }: { level: number }) {
  const amplitude = Math.max(0, Math.min(1, level));
  return (
    <span className="voice-waveform" aria-hidden="true">
      {[0.35, 0.6, 0.85, 0.65, 1, 0.75, 0.9, 0.55, 0.3].map((weight, index) => (
        <span key={index} style={{ transform: `scaleY(${0.12 + amplitude * weight * 0.88})` }} />
      ))}
    </span>
  );
}
