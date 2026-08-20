# Cursor Prompt — Jumping Jax Work Desktop Readiness Check

Perform a **read-only hardware and hosting assessment** of this work desktop to determine whether it can run the Jumping Jax self-hosted AI answering machine continuously.

## Project context

- AI answering-machine number: `863-933-1420` on AT&T.
- Desired routing: the normal phone rings first; the AI answers only unanswered calls.
- Required production voice: Jacob's authorized voice clone.
- Target cash cost: below $25/month at ordinary usage. Do not describe telephone usage as unlimited because carrier minutes still cost money.
- Possible local components: faster-whisper speech recognition, a small local language model, OpenVoice voice cloning, and the existing Jumping Jax booking orchestrator.
- Twilio would provide telephone connectivity later.
- `AI_RECEPTIONIST_LIVE_ACTIONS` must remain disabled.

## Restrictions

- Do not install or update software.
- Do not alter Windows, BIOS, firewall, router, sleep, or power settings.
- Do not create provider accounts or paid resources.
- Do not expose ports, start tunnels, or inspect/report the public IP address.
- Do not forward, port, or modify `863-933-1420`.
- Do not use customer data, credentials, or voice recordings.
- Do not edit application code during this assessment.

## Read-only checks

Run appropriate read-only Windows/PowerShell checks and report:

1. Computer manufacturer and exact model.
2. CPU model, physical cores, logical processors, and virtualization support.
3. Installed and currently available RAM.
4. GPU model, dedicated VRAM, driver version, and CUDA or DirectML capability where applicable.
5. Disk type, total size, free space, and available health status.
6. Windows version, active power plan, last boot time, and current sleep/hibernation timers.
7. Whether wired Ethernet is present and its negotiated link speed. Do not display MAC addresses, Wi-Fi passwords, public IPs, or other secrets.
8. Whether Docker, WSL, Python, Node.js, FFmpeg, Git, and relevant GPU runtimes are already installed, including versions.
9. Current CPU, RAM, disk, and GPU utilization at idle.
10. Suitability for an always-on Windows service, including likely heat, power, update, sleep, and network reliability risks.

## Evaluation

Classify the desktop as:

- **A — Fully local candidate:** likely capable of realtime speech recognition, local AI, and local cloned voice.
- **B — Hybrid candidate:** capable of hosting booking/orchestration and some local audio components, but heavy voice or AI work should use an API.
- **C — Unsuitable:** should not host the live receptionist; provide minimum replacement specifications.

Estimate expected conversational latency conservatively. Do not assume a GPU exists. Do not recommend buying hardware until the inspection is complete.

## Output

If the Jumping Jax repository is present, save the completed report as:

`docs/ai-receptionist-work-desktop-readiness-report.md`

If the repository is not present, save it as a Markdown file in the current writable project directory and report the full path.

End with the smallest safe next action:

- local microphone/voice rehearsal;
- hybrid sandbox;
- or a hardware decision.

Do not connect any phone number or enable live actions.
