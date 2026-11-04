export type SoundCue = "hover" | "press" | "navigate" | "toggle";
/** Short, locally synthesized interface sounds. No audio downloads or background loop. */
export class InteractionSound {
  private context: AudioContext | null = null;
  private lastHover = 0;
  async unlock() {
    if (typeof window === "undefined" || !window.AudioContext) return false;
    try {
      this.context ||= new window.AudioContext();
      if (this.context.state === "suspended") await this.context.resume();
      return this.context.state === "running";
    } catch { return false; }
  }
  play(cue: SoundCue) {
    const ctx = this.context;
    if (!ctx || ctx.state !== "running") return;
    if (cue === "hover" && Date.now() - this.lastHover < 100) return;
    if (cue === "hover") this.lastHover = Date.now();
    const notes = cue === "navigate" ? [330, 495] : cue === "toggle" ? [660, 880] : cue === "hover" ? [940] : [480];
    notes.forEach((frequency, index) => {
      const start = ctx.currentTime + index * .045;
      const duration = cue === "hover" ? .035 : .085;
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(frequency, start);
      oscillator.frequency.exponentialRampToValueAtTime(frequency * .72, start + duration);
      gain.gain.setValueAtTime(.0001, start);
      gain.gain.exponentialRampToValueAtTime(cue === "hover" ? .012 : .035, start + .004);
      gain.gain.exponentialRampToValueAtTime(.0001, start + duration);
      oscillator.connect(gain); gain.connect(ctx.destination);
      oscillator.onended = () => {oscillator.disconnect(); gain.disconnect();};
      oscillator.start(start); oscillator.stop(start + duration + .01);
    });
  }
  suspend() { void this.context?.suspend().catch(() => {}); }
  close() { void this.context?.close().catch(() => {}); this.context = null; }
}
