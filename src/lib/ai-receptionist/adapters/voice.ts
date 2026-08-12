import type { AiReceptionistConfig } from "../config";
import { assertLiveActionsAllowed } from "../config";

export type VoiceUtterance = {
  text: string;
  voiceProfile: "jacob_clone_sim" | "jacob_clone_live";
  disclosure: boolean;
};

export interface VoiceAdapter {
  readonly provider: string;
  synthesize(utterance: VoiceUtterance): Promise<{
    transcript: string;
    audioRef: string | null;
    simulated: boolean;
  }>;
  transcribe(audioRef: string): Promise<{
    text: string;
    confidence: number;
    simulated: boolean;
  }>;
}

export class SimVoiceAdapter implements VoiceAdapter {
  readonly provider = "sim-voice";
  private readonly spoken: VoiceUtterance[] = [];

  constructor(private readonly _config: AiReceptionistConfig) {
    void this._config;
  }

  async synthesize(utterance: VoiceUtterance) {
    this.spoken.push(utterance);
    return {
      transcript: utterance.text,
      audioRef: `sim-audio://${encodeURIComponent(utterance.text.slice(0, 40))}`,
      simulated: true,
    };
  }

  async transcribe(audioRef: string) {
    return {
      text: audioRef.startsWith("sim-audio://")
        ? decodeURIComponent(audioRef.replace("sim-audio://", ""))
        : "",
      confidence: 0.99,
      simulated: true,
    };
  }

  listSpoken(): VoiceUtterance[] {
    return [...this.spoken];
  }
}

export class LiveVoiceAdapterNotImplemented implements VoiceAdapter {
  readonly provider = "live-voice-unimplemented";

  constructor(private readonly config: AiReceptionistConfig) {}

  async synthesize(utterance: VoiceUtterance): Promise<never> {
    void utterance;
    assertLiveActionsAllowed(this.config, "voice.synthesize");
    throw new Error("live_voice_adapter_not_implemented");
  }

  async transcribe(audioRef: string): Promise<never> {
    void audioRef;
    assertLiveActionsAllowed(this.config, "voice.transcribe");
    throw new Error("live_voice_adapter_not_implemented");
  }
}
