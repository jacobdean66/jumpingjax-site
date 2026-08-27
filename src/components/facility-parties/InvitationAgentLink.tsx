"use client";

import Link from "next/link";
import type { ComponentProps } from "react";

import type { InvitationAgentAction } from "@/lib/facility-parties/invitations/agent";
import { notifyInvitationAgent } from "@/lib/facility-parties/invitations/agent-client";

type Props = ComponentProps<typeof Link> & {
  invitationAction: InvitationAgentAction;
  invitationTheme: string;
  bookingId?: string;
  optionIndex?: number;
  alternatesUsed?: number;
  selection?: string;
};

export function InvitationAgentLink({
  invitationAction,
  invitationTheme,
  bookingId,
  optionIndex,
  alternatesUsed,
  selection,
  onClick,
  ...props
}: Props) {
  return (
    <Link
      {...props}
      onClick={(event) => {
        notifyInvitationAgent({
          action: invitationAction,
          sourceText: invitationTheme,
          bookingId,
          optionIndex,
          alternatesUsed,
          selection,
        });
        onClick?.(event);
      }}
    />
  );
}
