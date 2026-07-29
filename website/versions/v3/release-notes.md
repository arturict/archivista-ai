# Release notes

## v3.2.5

Released 29 July 2026.

Tagvico 3.2.5 turns the first run into a verified path instead of a sequence of
blind saves. Guided setup checks Paperless access, authenticates the selected
provider, loads its live model catalog, and verifies the exact model before
creating the owner. Built-in endpoints are prefilled and authenticated Ollama
endpoints work without mixing local and cloud credentials.
Docker- and host-injected connection values are verified as the effective
runtime configuration. Public model discovery also limits response bytes,
catalog entries, time, and concurrency.

Non-secret setup progress can resume in the same tab after an interruption.
Paperless tokens, passwords, provider keys, and account credentials are never
stored in that browser draft. New installations start in Review first mode
with scheduled scans paused, then continue directly to Ask Tagvico. Enabling a
schedule later in Settings takes effect without restarting the container.

Ask Tagvico source titles now link to the permitted Paperless-backed document
view. Authentication, rate-limit, and transient Paperless failures remain
retryable instead of appearing as missing documents. Setup, Documents, Ask
Tagvico, Activity, and Settings also have clearer loading, empty, retry, and
narrow-screen states.

The landing page now separates aggregate request totals from explicitly opted-in
installation reports. The first-party design uses no cookies, fingerprints,
referrers, stored IP addresses, or permanent installation identifiers. It
respects Global Privacy Control and Do Not Track and suppresses small
installation totals.

Release acceptance covers setup, synthetic document upload, search, cited
answers, tag changes, approval-first actions, cleanup, and recovery against an
isolated real Paperless-ngx 2.20.15 container.

Upgrade by backing up `tagvico_ai_data`, pinning
`ghcr.io/arturict/tagvico-ai:3.2.5`, and recreating only the Tagvico container.
This is a v3 patch with no data migration.

## v3.2.0

Released 26 July 2026.

Tagvico 3.2 replaces the previous dark application and marketing surfaces with
one light **Paper & Pine** interface. The main navigation now follows concrete
jobs: Home, Documents, Ask Tagvico, Organize tags, Activity, and Settings.

Ask Tagvico is now a three-column research workspace. Conversations remain on
the left, the answer and configured-model composer stay in the centre, and a
live research trail shows every safe Paperless search, document read, source
count, and pending approval on the right.

Read tools can inspect documents and tags immediately. Document and tag
creates, edits and deletions remain inert until an owner or adult approves the
durable proposal. The configured-model picker is grouped by collapsible
provider and exposes model-specific reasoning levels.

Content requests such as read, inspect, open, and review now read the bounded
Paperless matches. GitHub Copilot receives the saved reasoning level, accidental
substring matches no longer start research, and conversations remain reachable
from a dedicated drawer on narrow screens.

Duplicate-tag cleanup has its own review workspace. Analysis is read-only, each
many-to-one mapping shows its document impact, and moving references remains a
separate operation from deleting the unused source.

Document chips, provider controls and model metadata now meet the light
interface's contrast targets. Home, Documents, Activity and live model catalogs
show their actual structure as skeletons while data is loading.

Upgrade by backing up `tagvico_ai_data`, pinning
`ghcr.io/arturict/tagvico-ai:3.2.0`, and recreating only the Tagvico container.
This remains a v3 upgrade. There is no v4 migration and no parallel beta-theme
preference.

## v3.1.2

Released 24 July 2026.

This focused Ask Tagvico hotfix removes embedding-only models from every chat
model picker. It covers common embedding names as well as colon- and
slash-delimited provider IDs such as `qwen3-embedding:4b`.

Upgrade by backing up `tagvico_ai_data`, pinning
`ghcr.io/arturict/tagvico-ai:3.1.2`, and recreating only the Tagvico container.
No settings or data migration is required.

## v3.1.1

- Unified Settings around eight supported runtimes with write-only credentials,
  live probes, scrollable model catalogs, and account authentication for
  ChatGPT subscription and GitHub Copilot.
- Added durable Ask Tagvico conversations, model choice, retry/copy/stop,
  privacy-safe tool activity, and intent-aware Paperless research.
- Made trigger tags optional, kept four tags as the default ceiling, and added
  clearer scan results, recovery queues, exact restore, and history cleanup.
- Added many-to-one duplicate-tag proposals, custom filing instructions, an
  advanced system prompt, and the in-product changelog.

## v3.1.0

- Moved every user-facing workflow into the same green React application shell.
- Reorganized navigation around Actions, Ask Tagvico, Automation, Activity, and
  Settings.
- Restored Paperless discovery, added approval-first tag unification, and
  bundled the matching versioned documentation at `/docs/`.

For complete technical details, see the repository
[CHANGELOG](https://github.com/arturict/tagvico-ai/blob/main/CHANGELOG.md) and
[GitHub releases](https://github.com/arturict/tagvico-ai/releases).
