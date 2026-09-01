# Tagvico v4 plan: strip down and focus

**Status:** direction agreed 2026-09; scope not yet frozen. Nothing in this
document changes the [v3 compatibility contract](STATUS.md) — every feature
listed here keeps working through the entire v3 line.

## Why

Paperless-ngx v3 ships native AI: metadata suggestions constrained to the
existing vocabulary, an apply-suggestions workflow action, document chat, and
remote OCR. That covers the routine autotagging Tagvico automated in v1/v2.
Tagvico does not compete with the platform on its own turf. The product is the
layer Paperless deliberately does not build: **Action Cases, deadlines,
checklists, household roles, the approval boundary, and the family bots.**

v4 therefore reduces surface area to what Tagvico does uniquely well, and
funds that focus by removing features that upstream now covers or that cost
disproportionate maintenance.

## Keep and invest (the product)

- Action Center: cases, checklists, due dates, owners, audit trail, Paperless
  custom-field mirroring.
- Households, roles, and the approval boundary with the deterministic
  executor.
- Ask Tagvico research with visible tool activity.
- **Telegram and Discord bots — both are core surfaces.** v3.3.0 already adds
  per-user flood control, prompt-context escaping, token-redacted logs, and
  Discord button caps; further polish continues.
- The review queue, restore snapshots, and processing history.
- Reviewable metadata filing as an **opt-in included utility** (it stays, but
  never leads the product again).

## Maintenance mode in v3, removal candidates for v4

| Feature | Why it is a candidate | Migration path |
|---|---|---|
| OCR rescue queue | Paperless-ngx v3 has remote OCR and a parser plugin framework | Use Paperless native OCR / remote OCR |
| ChatGPT-subscription (Codex) adapter | High maintenance, ToS- and SDK-fragile, account-specific | OpenRouter, OpenAI direct, or a local endpoint |
| GitHub Copilot adapter | Same profile as the Codex adapter | Same |
| OpenAI Flex/Batch modes | Exist to make bulk autotagging cheap — a demoted use case | Standard mode, or native Paperless AI |

"Maintenance mode" means: keeps working through v3, receives bug and security
fixes, receives no new capabilities, and is documented as a removal candidate.

## Bot roadmap (inspired by OpenClaw and Hermes Agent)

Reviewed 2026-09 against [OpenClaw](https://github.com/openclaw/openclaw) and
[Hermes Agent](https://hermes-agent.nousresearch.com/) — the two strongest
open-source chat-assistant gateways. Adopted, planned, and explicitly
rejected ideas:

**Shipped in v3.3.0:** proactive action-deadline reminders (their
heartbeat/cron-delivery pattern, translated to Action Case due dates).

**Planned, in priority order:**

1. **Pairing codes instead of hand-edited JSON env.** OpenClaw pairs channels
   with codes/QR; Tagvico should let the admin generate a one-time code in
   the web UI that a family member redeems with `/link <code>`, storing the
   member's Paperless token encrypted in the database instead of in
   `TELEGRAM_USERS_JSON`/`DISCORD_USERS_JSON`. Biggest onboarding and
   secret-hygiene win.
2. **Voice notes with speech-to-text.** Hermes transcribes Telegram voice
   memos (local whisper, Groq, or OpenAI). Natural for a family bot;
   transcription must respect the same provider boundary as everything else
   (local endpoint keeps it local).
3. **Emoji-reaction status feedback.** Hermes reacts 👀 while working and
   ✅/❌ when done — cheap polish that replaces "Uploading…" filler messages.
4. **Idle expiry for in-memory conversation history.** OpenClaw supports
   idle timeouts and daily session resets; Tagvico histories currently live
   until `/clear` or restart.
5. **Streaming answers via progressive message edits** where the transport
   supports it.

**Deliberately not adopted:** general agent tools (shell, browser, files),
persistent agent memory/skill learning, multi-agent routing, and guest
access. They are the core of those projects but contradict Tagvico's narrow
tool catalog and approval boundary — the bots stay scoped assistants over
Paperless and the Action Center, not general agents.

## Decision gates before the v4 cut is final

1. **Usage signal.** Run a GitHub Discussion asking which candidates users
   would miss, and consider adding coarse opt-in feature flags (enabled y/n,
   no counts) to the telemetry heartbeat.
2. **Paperless v3 compatibility work lands first** (E2E stack against
   Paperless 3.x, drop `created_date`, pin an API version) so v4 starts from
   a verified baseline.
3. **Native-AI coexistence** ships as documentation in v3.3 and ideally as
   in-app detection before v4.

## Explicit non-goals (all majors)

- No hosted "Tagvico Cloud" that stores or processes documents.
- No replacement of Paperless search, storage, or its native AI.
- No shell or filesystem tools in the Companion.
- No write to Paperless without an approval gate or an explicit automatic
  mode the administrator chose.

## Monetization direction (exploratory)

Preferred: a paid tier of the same self-hosted container (household features,
priority support) and possibly a thin, content-blind hosted relay for push
notifications and bot reachability. A document-touching cloud offering is out
of scope.
