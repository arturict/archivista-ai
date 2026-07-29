---
layout: home

hero:
  name: "Tagvico v3.2"
  text: "A calmer workspace for Paperless-ngx"
  tagline: File documents, research your archive, organize tags and keep every sensitive change visible.
  image:
    src: /tagvico-icon.png
    alt: Tagvico AI
  actions:
    - theme: brand
      text: Install v3.2.5
      link: /installation
    - theme: alt
      text: Explore features
      link: /features
    - theme: alt
      text: Choose a provider
      link: /providers

features:
  - icon: 🗂️
    title: Documents to useful work
    details: Process documents, find the original, track deadlines and keep restore history in one workspace.
  - icon: ✅
    title: Ask Tagvico
    details: Ask about documents and obligations while every Paperless search, document read and proposed write stays visible.
  - icon: 🔌
    title: Your model, your boundary
    details: Tagvico owns the safe harness. Use Vercel AI SDK providers such as OpenCode Go or an optional read-only Codex SDK adapter.
  - icon: 📈
    title: Visible operations
    details: Keep the established metadata automation, review queue, processing history, OCR recovery, retry controls, and restoration tools.
  - icon: 💬
    title: Optional Telegram access
    details: Give allowlisted family members cited search, uploads, action lists, and approve/reject controls through their own Paperless tokens.
---

## Start here

Tagvico is a self-hosted action layer for an existing Paperless-ngx instance.
It keeps Paperless as the document system of record while adding household
ownership, checklists, deadlines, approval history, and a provider-neutral AI
session runtime. Existing reviewable AI metadata filing remains available.

This page tracks the latest stable v3 patch release. The version menu keeps
older major-version guides available, while [Release notes](./release-notes)
shows exactly what changed in v3.2.

::: tip Production defaults
Pin the immutable `3.2.5` image, back up the data volume before upgrades, and start new installations in
**Review first** mode. Companion writes are always approval-gated regardless
of the metadata processing mode.
:::
