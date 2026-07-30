# Community launch kit

These drafts match stable Tagvico v3.2.6. Check each community's current
self-promotion rules immediately before posting, publish one substantial post
at a time, and stay available to answer replies. Do not cross-post identical
copy.

## What to validate with this launch

The goal is not raw impressions. Look for evidence that Paperless users can:

1. understand Tagvico's role without mistaking it for a Paperless replacement;
2. complete setup and verify Paperless plus one model provider;
3. ask a useful archive question and inspect its cited source;
4. review a proposed write before approving it; and
5. explain the next workflow problem they would trust Tagvico to handle.

Use privacy-safe aggregate traffic only. Do not collect document content,
private endpoints, account identifiers, or permanent installation identifiers.

## r/selfhosted New Project Megathread

Projects younger than three months belong in the current weekly New Project
Megathread, not in a standalone post. Use a top-level comment with the
community's requested fields:

**Project Name:** Tagvico

**Repo/Website Link:**

- https://github.com/arturict/tagvico-ai
- https://tagvico.arturf.ch/

**Description:** I built Tagvico because finding a document is often only the
start of the work. An invoice creates a payment, a letter creates a deadline,
and a household document often needs to be checked or shared with someone else.

Tagvico connects to an existing Paperless-ngx archive. It answers questions
with visible document sources, proposes structured metadata and follow-up
actions, and keeps every document write behind an explicit approval card.
Paperless remains the system of record.

Stable v3.2.6 includes guided connection verification, source-backed answers,
durable conversations and approvals, metadata restoration, recovery queues,
and a responsive interface. New installations start in Review first mode with
scheduled scans paused.

**Deployment:** Tagvico is MIT licensed and distributed as a Docker image with
a Compose example and versioned installation documentation. Pin the immutable
v3.2.6 image, connect an existing Paperless-ngx instance, and choose local
Ollama or an explicitly configured hosted provider.

Tagvico does not operate a document-processing cloud service, but a hosted
provider you choose may receive the content required for that request.

**AI Involvement:** Tagvico is explicitly an AI product. Models provide archive
answers and metadata or action proposals within the visible source and approval
boundaries. I also use AI coding and review tools during development. Releases
are checked with typed contracts, security boundaries, 201 automated tests,
real-Paperless acceptance, multiarchitecture container tests, and human review.

I would value blunt feedback about setup friction and the first action you
would trust after finding a document.

## r/Paperlessngx

**Title:** Tagvico v3.2.6: a review-first action and research layer for Paperless-ngx

I maintain Tagvico, an independent self-hosted companion for Paperless-ngx.
Paperless remains the document system of record. Tagvico adds source-backed
archive questions, reviewable metadata proposals, exact restoration, and
follow-up actions without granting an assistant unsupervised write access.

The current setup verifies Paperless permissions, authenticates the selected
model provider, loads its live model catalog, and checks the exact model before
creating the owner account. New installations begin in Review first mode with
scheduled scans paused.

The supported paths include local Ollama, OpenRouter, OpenAI-compatible
gateways, OpenAI, GitHub Copilot, OpenCode Go, Ollama Cloud, and experimental
ChatGPT subscription access. Provider behavior and data handling remain the
operator's explicit choice.

Website and documentation: https://tagvico.arturf.ch/

Repository and Compose example: https://github.com/arturict/tagvico-ai

I would especially value Paperless-specific feedback: which post-retrieval
task should Tagvico handle, and what evidence would you need before approving a
proposed change?

## Show HN

**Title:** Show HN: Tagvico, a self-hosted action center for Paperless-ngx

Tagvico connects to an existing Paperless-ngx archive and turns retrieval into
reviewable work. It answers archive questions with visible sources, proposes
metadata and follow-up actions, and requires explicit approval before document
writes.

Paperless remains the system of record. Tagvico is TypeScript, Docker, SQLite,
and MIT licensed. It supports local models and explicitly configured hosted
providers instead of requiring a Tagvico-operated AI service.

The current stable release is v3.2.6:

https://tagvico.arturf.ch/

https://github.com/arturict/tagvico-ai

I am looking for feedback from people running real document archives:
what should happen after you find the right document?

## Provider communities

Adapt this only when a real provider-specific result is available. Do not imply
provider endorsement.

> I am testing **[provider/model]** in Tagvico for source-backed Paperless-ngx
> questions and structured metadata proposals. The useful question is not
> generic prose quality but whether the answer cites the right document and the
> proposed fields remain reviewable and accurate. If you use this model for
> document workflows, I would value sanitized failure cases.
>
> Project: https://github.com/arturict/tagvico-ai

## Response prompts

When someone shows interest, ask only one focused follow-up:

- What is the first task you do after finding the document?
- Which Paperless version and deployment style are you using?
- Did setup fail at Paperless, provider authentication, or model verification?
- What would you need to see before approving the proposed write?

Move reproducible bugs to GitHub after removing credentials, private URLs,
document contents, names, and account identifiers.

## Visual asset checklist

- Record 60 to 90 seconds on a representative v3.2.6 installation.
- Use synthetic documents throughout.
- Show question, visible source, proposed action, approval, and Paperless result.
- Inspect every final frame for credentials, endpoints, names, document content,
  email addresses, account identifiers, and private URLs.
- Export one short video and two captioned stills. Avoid a large animated GIF
  that makes the repository page slow.
