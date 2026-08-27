-- Activate the application-owned invitation specialist and document every UI
-- action it accepts. Rendering remains deterministic and uses repo-local assets.
update public.agents
set
  agent_type = 'application',
  enabled = true,
  paused = false,
  status = 'idle',
  capabilities = '[
    "invitation.create",
    "invitation.alternate",
    "invitation.choose_delivery",
    "invitation.choose_template",
    "invitation.open",
    "invitation.view",
    "invitation.email",
    "invitation.print"
  ]'::jsonb,
  configuration_reference = 'src/lib/facility-parties/invitations/agent.ts',
  updated_at = now()
where key = 'party-invitation';
