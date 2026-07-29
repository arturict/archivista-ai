# Project status

**Status:** stable v3. The latest stable patch is `3.2.5`.

## Stable v3 contract

Tagvico AI v3.0.0 established the accountable action and approval layer for the
stable, reviewable Paperless-ngx workflow. The current v3.2.5 release improves
first-run verification, source-backed answers, recovery, privacy-safe aggregate
metrics, and responsive product states without changing the v3 compatibility
contract. The following are commitments for the complete v3 release line:

- Existing v2 and v3 data volumes are upgraded with versioned, idempotent SQLite
  migrations and a pre-migration database backup.
- Canonical `TAGVICO_*` environment variables, port `3000`, `/app/data`, and
  the documented setup, login, health, review, history, and settings workflows
  remain supported throughout v3.
- Stable upgrades do not intentionally discard the local admin account,
  settings, processing history, review queue, or original metadata snapshots.
- Paperless data is accessed only through the official Paperless REST API.

The household, Action Case, checklist, approval, and encrypted member-token
records introduced by schema v5 are also preserved through compatible v3
upgrades. Breaking changes to these contracts require a new major version.
Provider model names, prices, quotas, and account entitlements remain controlled
by the provider and can change independently of Tagvico.

## Recommended deployment policy

- Check the [GitHub releases page](https://github.com/arturict/tagvico-ai/releases)
  before installing or upgrading. The current recommendation is to pin
  `ghcr.io/arturict/tagvico-ai:3.2.5` rather than `latest` for explicit change
  control and unambiguous rollback.
- Back up the complete `tagvico_ai_data` volume before every upgrade.
- Start in **Review first** and test representative, non-sensitive documents
  before enabling Automatic mode.
- Treat ChatGPT subscription access as experimental and account-specific; it is
  not an API SLA.
- Keep anonymous installation analytics disabled unless you explicitly choose
  to share the locally previewed aggregate heartbeat.

## Security and support

Report reproducible bugs through the
[issue tracker](https://github.com/arturict/tagvico-ai/issues) after removing
credentials, private URLs, document contents, and personal information.
Security issues must not be filed publicly; follow
[`SECURITY.md`](../SECURITY.md).

Release-specific upgrade and rollback instructions are available on the
[GitHub releases page](https://github.com/arturict/tagvico-ai/releases) and in
the [versioned v3 documentation](https://tagvico.arturf.ch/docs/).
