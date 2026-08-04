# Tagvico AI privacy notice

Last updated: 28 July 2026

Tagvico AI is self-hosted software. The operator of each installation controls
the Paperless-ngx connection, model provider, network exposure, users, logs,
and local data retention. This notice describes what the Tagvico project
receives, not what an operator may configure locally.

## Document processing

Tagvico reads OCR text and metadata from the Paperless-ngx instance selected by
the operator. With Ollama or another endpoint on the operator's network, that
content can remain on infrastructure they control. When a hosted provider is
selected, the content required for classification is sent directly to that
provider under its terms and privacy notice. It is not routed through a
Tagvico-operated service.

Provider credentials are stored in the installation's `data/.env` file and are
not sent to the Tagvico project. Processing history and review suggestions are
stored in the installation's local SQLite database.

## Optional Telegram interface

An operator may enable a Telegram bot and allowlist numeric Telegram user IDs
with separate Paperless API tokens. This configuration remains on the
installation and is not sent to the Tagvico project. Unknown users and
non-private chats are ignored. Bot conversation history is bounded, separated
by user, held only in process memory, and removed by `/clear` or restart.

Telegram bot chats are not end-to-end encrypted. Questions, uploads, and
original documents returned through the bot are processed by Telegram under
its terms. Retrieved OCR text and questions are also processed by the selected
model provider as described above. A local model can keep the inference step
on operator-controlled infrastructure, but it does not make Telegram a local
or end-to-end encrypted transport.

## Optional Discord interface

An operator may enable a Discord bot and allowlist Discord user IDs (numeric
snowflakes) with separate Paperless API tokens. This configuration remains on
the installation and is not sent to the Tagvico project. Messages from unknown
users, bots, webhooks, and other channels are silently ignored. Unauthorized
slash commands receive only a private unavailable response.

In direct messages, all content from allowlisted users is processed. In the
optional home channel, only native slash commands, bot @-mentions, or replies
to the bot that keep the bot mention enabled trigger processing; unaddressed
messages are ignored. The bot does
not request Discord's privileged Message Content intent.

Conversation history is bounded, isolated by Discord user and channel,
held only in process memory, and removed by `/clear` or restart. Document
download and approval buttons are bound to the originating Discord user ID;
attempts by another user to replay an interaction are rejected without action.
Home-channel document downloads are delivered as ephemeral messages.
Answers triggered by @mentions or replies are ordinary channel messages and
are visible to every member who can read that channel. Slash-command responses
are ephemeral.

Discord bot messages are not end-to-end encrypted. Questions, uploads, and
original documents returned through the bot are processed by Discord under its
terms. Retrieved OCR text and questions are also processed by the selected
model provider as described above. A local model can keep the inference step
on operator-controlled infrastructure, but it does not make Discord a local or
end-to-end encrypted transport.

File uploads are validated against HTTPS Discord CDN URLs, a sanitized
filename, and a 10 MiB default and hard maximum. Per-user Paperless tokens mean
Paperless remains the document-permission authority for each user.

Automatic AI metadata classification for Discord bot uploads is a separate
explicit opt-in (`DISCORD_UPLOAD_AUTOMATIC_METADATA=yes`) because it bypasses
the web review queue. The provider boundary described in the document-processing
section applies equally to this classification pass.

## Optional installation analytics

Anonymous installation analytics are **off by default**. An administrator may
explicitly enable or disable them in Settings or with
`TAGVICO_TELEMETRY_ENABLED=yes|no`. When enabled, the installation sends one
heartbeat approximately every 24 hours, beginning 15 minutes after startup.

The payload contains only:

- rotating daily and monthly HMAC identifiers;
- Tagvico version;
- a broad processed-document-count bucket;
- review or automatic write mode;
- `local`, `hosted`, or `custom` provider category; and
- booleans for OCR rescue, custom fields, and controlled tags.

It does **not** contain document text, titles or metadata; document or user
identifiers; names or email addresses; Paperless URLs, hostnames, or domains;
API keys or provider account details; exact document counts; model names;
errors, stack traces, IP-derived location, cookies, or advertising identifiers.

The random secret used to derive period identifiers remains on the local
installation. Daily identifiers change each day and monthly identifiers change
each month, preventing the project from linking an installation across months.
The receiver does not intentionally store source IP addresses or user-agent
headers. Its deduplication rows expire after 62 days. Hosting infrastructure
may necessarily process network addresses to deliver the request; its request
logging must be disabled or minimized by the project operator.

Administrators can preview the exact current payload before enabling sharing.
The payload is also printed to the local application log after a successful
send. Disabling analytics stops future heartbeats immediately.

## Website and GitHub

The public Tagvico landing page may send one first-party page-view request to
the open-source aggregate receiver. The request contains no body and uses no
cookie, local storage, visitor or session identifier, fingerprint, referrer,
precise location, advertising identifier, or cross-site profile. The receiver
increments one UTC-day counter and retains daily totals for 93 days. A page
view is a request, not a unique person.

The browser skips the page-view request when Global Privacy Control or Do Not
Track is enabled. Network infrastructure necessarily processes an IP address
to deliver a request, but the Tagvico receiver does not read or store source IP
addresses or user-agent headers. Infrastructure request logging must be
disabled or minimized before this endpoint is enabled.

The landing page may show two deliberately separate statistics: page views
over the previous 30 days, and unauthenticated reports from opted-in active
installations for the current month. Both public write paths fail closed
without their shared-key rate limiter, and installation totals below five are
not published exactly. GitHub independently processes repository visits,
stars, clones, issues, and release access under GitHub's own terms. Those
GitHub statistics are not treated as Tagvico installations or users.

The in-app update check and star count request public release and repository
data directly from GitHub; Tagvico does not receive those requests. See the
repository's [`telemetry/PRIVACY_ASSESSMENT.md`](telemetry/PRIVACY_ASSESSMENT.md)
for the narrow consent and notice assessment that applies to the unmodified
first-party counter.

## Contact and changes

Privacy questions can be sent to `clusterz[at]protonmail.com`. Material changes
to analytics fields, purposes, or retention will be documented before release.
This notice is informational and does not replace an installation operator's
own legal obligations or privacy notice.
