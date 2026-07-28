# Landing counter privacy assessment

Last reviewed: 28 July 2026

This is a narrow implementation assessment, not legal advice. It applies only
while the public landing counter remains first-party and keeps all of the
technical limits below. A material change requires a new review before
deployment.

## Purpose and separation

The project wants one coarse marketing signal and one coarse product signal:

- landing page views over the previous 30 days;
- current-month active installations that explicitly enabled anonymous
  installation analytics.

Page views are requests, not people. GitHub views, stars, clones, and post
reach are separate platform metrics. None is presented as an activated
installation or user.

## Data flow and minimization

The landing script sends an empty `POST /v1/pageview` request only from the
first-party Tagvico origin. It uses `credentials: "omit"` and
`referrerPolicy: "no-referrer"`. It does not set or read cookies or local
storage, assign a visitor or session ID, fingerprint the device, collect a
precise location, or create a cross-site profile.

The receiver increments one UTC-day counter. It does not inspect or persist IP
addresses, user agents, hostnames, or referrers. Daily aggregate rows expire
after 93 days. The script skips collection when Global Privacy Control or Do
Not Track is enabled.

The network and hosting provider necessarily process an IP address long enough
to deliver the request. Before deployment, request logging must be disabled or
minimized, retention and processor terms must be reviewed, and the public
privacy notice must remain reachable from every landing page.

## Swiss and EU assessment

The Swiss FDPIC says website operators should provide a comprehensible,
prominently displayed privacy statement describing the data, purpose,
recipients, retention, choices, and contact details. Its current cookie
guidance emphasizes data-minimal settings and user control:

- [FDPIC privacy statements on the internet](https://www.edoeb.admin.ch/en/privacy-statements-on-the-internet)
- [FDPIC factsheet on cookies and similar technologies](https://www.edoeb.admin.ch/en/factsheet-cookies)

For EU visitors, the European Commission identifies IP addresses as personal
data. Truly irreversible anonymous information falls outside the GDPR, while
pseudonymous data remains personal:

- [European Commission: what is personal data?](https://commission.europa.eu/law/law-topic/data-protection/data-protection-explained_en)

The EU cookie guidance requires consent for analytics cookies and similar
device storage, while strictly necessary cookies are exempt:

- [Your Europe: cookies and online privacy](https://europa.eu/youreurope/business/growing/digitalising/online-privacy/index_en.htm)

This counter uses no cookie or other browser storage and does not read a
tracking identifier from the device. On that limited implementation, a cookie
consent banner is not the relevant control. The transient processing of the
request IP still needs a GDPR lawful basis where the GDPR applies. The
project's proposed basis is legitimate interest in coarse service reach, but
only after documenting the necessity and balancing test, keeping the
implementation least intrusive, honoring privacy signals, and giving clear
notice:

- [European Commission: legitimate interests](https://commission.europa.eu/law/law-topic/data-protection/information-business-and-organisations/legal-grounds-processing-data_en)
- [EDPB guide to processing data lawfully](https://www.edpb.europa.eu/sme/be-compliant/process-personal-data-lawfully_en)

## Banner conclusion and deployment gate

The project should not add a consent banner for this exact counter solely to
count page requests, because it stores no information on the device and uses
no tracking identifier. This is a cautious implementation conclusion, not a
guarantee that every national authority or deployment configuration will reach
the same result.

Do not enable the counter if any of these conditions is false:

- the endpoint is first-party and accepts only the exact public origin;
- no cookie, storage ID, fingerprint, referrer, full URL, IP, or user agent is
  stored;
- infrastructure request logs are disabled or minimized;
- only aggregate daily page views are retained, for no more than 93 days;
- Global Privacy Control and Do Not Track are honored;
- the privacy notice remains accurate and easy to reach;
- the legitimate-interest necessity and balancing record is approved by the
  controller;
- local legal advice is obtained if targeting, hosting, or national
  implementation changes introduce uncertainty.

If a future version needs unique visitors, attribution, funnels, geography,
device profiles, or cross-session recognition, this conclusion no longer
applies. Reassess consent, lawful basis, processor terms, retention, and notice
before implementing it.
