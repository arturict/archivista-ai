# Tagvico telemetry receiver

This optional Cloudflare Worker receives the documented aggregate heartbeat
and a first-party landing-page counter. It deliberately does not inspect or
persist request IP addresses, user agents, hostnames, or referrers. It does not
set cookies, create a visitor ID, or fingerprint a browser.

Landing page views are aggregated into one count per UTC day and expire after
93 days. They are requests, not unique people. Installation heartbeats are
opt-in, daily identifiers are deduplicated, and rows expire after 62 days.
Public installation totals below five are suppressed instead of exposing an
exact small count. Marketing page views and opted-in active installations must
always be labelled separately.

Network infrastructure still processes an IP address while delivering a
request. Review the hosting provider's own request-log, data-processing,
retention, and regional settings before deploying.

1. Create a D1 database and apply `schema.sql`.
2. Copy `wrangler.toml.example` to `wrangler.toml` and set the database ID.
3. Store a long random `ADMIN_TOKEN` with `wrangler secret put ADMIN_TOKEN`.
4. Set `PUBLIC_ORIGIN` to the exact landing-page origin.
5. Deploy, attach `telemetry.tagvico.arturf.ch`, and disable request-log storage
   where supported.
6. Verify `POST /v1/heartbeat`, `POST /v1/pageview`, and
   `GET /v1/public-summary`. Query the private `GET /v1/summary` with the bearer
   token. Never expose the raw D1 database publicly.

The aggregate dashboard must label every result as opted-in installations.
The public landing counter must use `credentials: "omit"` and
`referrerPolicy: "no-referrer"`, and skip collection when Global Privacy
Control or Do Not Track is enabled.
