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

Both public write paths fail closed unless their Cloudflare Workers Rate
Limiting bindings are present. One shared route key permits at most 60 accepted
pageview writes per minute in each Cloudflare location. A separate shared route
key permits at most 30 heartbeat writes per minute. These bounds limit forged
metric inflation and database-write cost without adding an IP address, cookie,
visitor identifier, or fingerprint to Tagvico's data. Installation reports
remain unauthenticated, so the public total is a bounded, opted-in signal rather
than a verified user count. Clients spread their first and daily sends across
randomized windows and retry a failed send after a randomized 5 to 15 minute
delay. Short retries are limited to two and apply only to network failures,
timeouts, rate limits, and server errors; persistent or non-transient failures
return to the next daily window. Restarts and upgrades therefore do not
synchronize every installation behind the shared cap.

Network infrastructure still processes an IP address while delivering a
request. Review the hosting provider's own request-log, data-processing,
retention, and regional settings before deploying.

1. Create a D1 database and apply `schema.sql`.
2. Copy `wrangler.toml.example` to `wrangler.toml`, set the database ID, and
   keep both rate-limiter bindings enabled.
3. Store a long random `ADMIN_TOKEN` with `wrangler secret put ADMIN_TOKEN`.
4. Set `PUBLIC_ORIGIN` to the exact landing-page origin.
5. Keep the custom-domain route in `wrangler.toml`, deploy, confirm Cloudflare
   replaced any previous DNS record for `telemetry.tagvico.arturf.ch`, and
   disable request-log storage where supported.
6. Verify accepted and rate-limited `POST /v1/pageview` requests, then verify
   `POST /v1/heartbeat` and
   `GET /v1/public-summary` both with the website Origin header and without an
   Origin header for server-side monitoring. Foreign browser origins remain
   rejected. Query the private `GET /v1/summary` with the bearer token. Never
   expose the raw D1 database publicly.

The aggregate dashboard must label every result as opted-in installations.
The public landing counter must use `credentials: "omit"` and
`referrerPolicy: "no-referrer"`, and skip collection when Global Privacy
Control or Do Not Track is enabled.
