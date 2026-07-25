# Release notes

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
