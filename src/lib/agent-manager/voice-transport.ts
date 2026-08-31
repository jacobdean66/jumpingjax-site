export type VoiceTransportProfile = {
  id: "textnow_iphone" | "browser_simulation" | "programmable_voice";
  inboundWebhook: boolean;
  liveAudioStream: boolean;
  structuredTurns: boolean;
  credentialsConfigured: boolean;
  paidTelephonyApproved: boolean;
};

export type VoiceTransportReadiness = {
  status: "blocked" | "proof_only" | "ready_to_connect";
  reasons: string[];
  mayHandleCustomerCalls: boolean;
};

export const TEXTNOW_IPHONE_PROFILE: VoiceTransportProfile = {
  id: "textnow_iphone",
  inboundWebhook: false,
  liveAudioStream: false,
  structuredTurns: false,
  credentialsConfigured: false,
  paidTelephonyApproved: false,
};

export const BROWSER_SIMULATION_PROFILE: VoiceTransportProfile = {
  id: "browser_simulation",
  inboundWebhook: false,
  liveAudioStream: false,
  structuredTurns: true,
  credentialsConfigured: false,
  paidTelephonyApproved: false,
};

export function evaluateVoiceTransport(profile: VoiceTransportProfile): VoiceTransportReadiness {
  if (profile.id === "textnow_iphone") {
    return {
      status: "blocked",
      reasons: ["TextNow on iPhone exposes no supported inbound webhook or live-audio stream"],
      mayHandleCustomerCalls: false,
    };
  }
  if (profile.id === "browser_simulation") {
    return {
      status: "proof_only",
      reasons: ["Structured simulated turns are available, but no telephone call is connected"],
      mayHandleCustomerCalls: false,
    };
  }
  const reasons = [
    !profile.inboundWebhook ? "Inbound webhook is not configured" : null,
    !profile.liveAudioStream ? "Live audio stream is not configured" : null,
    !profile.structuredTurns ? "Structured booking turns are not configured" : null,
    !profile.credentialsConfigured ? "Provider credentials are not configured" : null,
    !profile.paidTelephonyApproved ? "Telephony charges are not approved" : null,
  ].filter((reason): reason is string => Boolean(reason));
  return {
    status: reasons.length ? "blocked" : "ready_to_connect",
    reasons,
    mayHandleCustomerCalls: reasons.length === 0,
  };
}
