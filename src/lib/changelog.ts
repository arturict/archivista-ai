export type ChangelogEntry = {
  version: string;
  date: string;
  title: string;
  summary: string;
  status: 'unreleased' | 'released';
  groups: Array<{ title: string; items: string[] }>;
};

export const changelogEntries: ChangelogEntry[] = [
  {
    version: '3.2.0',
    date: '26 July 2026',
    title: 'Paper & Pine workspace',
    summary: 'One calmer Tagvico interface, an inspectable research workspace and a clearer path from documents to safe action.',
    status: 'released',
    groups: [
      {
        title: 'One coherent product',
        items: [
          'The app and public landing page now share the light Paper & Pine system: warm paper surfaces, pine navigation, restrained lime accents and calmer information density.',
          'Home, Documents, Ask Tagvico, Organize tags, Activity and Settings replace internal workflow names in the primary navigation.',
          'Home is now the configured-install entry point, while Documents provides a direct route into processed-document search, detail, rescan and restore.',
          'Document tags, provider controls, model rows and secondary copy use stronger contrast, while Home, Documents, Activity and live catalogs load through page-shaped skeletons.'
        ]
      },
      {
        title: 'Ask Tagvico',
        items: [
          'Conversations, answers and the live research trail now form one three-column workspace.',
          'Paperless searches, reads, safe source metadata and result counts stay visible as the selected model works.',
          'Document and tag reads run immediately, while every document or tag mutation becomes a durable approval card before Paperless can change.',
          'Document approvals show the proposed values, and tag deletion stops if the approved name or linked-document count changed.',
          'The model picker groups live models inside collapsible configured providers and shows only reasoning levels supported by the selected model.',
          'Saved reasoning levels remain synchronized, Ollama discovery has one bounded deadline, and explicit document shortcuts never leak internal non-document citation markers.'
        ]
      },
      {
        title: 'Tag organization and Settings',
        items: [
          'Duplicate cleanup now has a dedicated Organize tags workspace with a clear Analyze, Review, Move and Delete sequence.',
          'Every many-to-one proposal shows the source, target, affected documents, confidence and model before approval.',
          'Settings keeps configuration separate from operational cleanup and uses the same field, status and section hierarchy throughout.',
          'Owner-only tag organization is hidden from adult and viewer navigation.'
        ]
      },
      {
        title: 'Landing and upgrade',
        items: [
          'The public site now explains the real workflows, provider boundary, privacy model, FAQ and pinned Docker install without a separate marketing theme.',
          'Version 3.2 remains on the v3 data and documentation line. There is no v4 migration and no beta-theme toggle.'
        ]
      }
    ]
  },
  {
    version: '3.1.2',
    date: '24 July 2026',
    title: 'Chat-only model catalogs',
    summary: 'A focused hotfix that keeps embedding-only provider models out of Ask Tagvico.',
    status: 'released',
    groups: [
      {
        title: 'Ask Tagvico',
        items: [
          'Embedding-only models with colon-, slash-, dash-, dot- or underscore-delimited IDs are no longer offered in chat model pickers.',
          'Ollama IDs such as qwen3-embedding:4b and nomic-embed-text:latest are covered by regression tests.'
        ]
      }
    ]
  },
  {
    version: '3.1.1',
    date: '24 July 2026',
    title: 'Reliable automation and a useful Paperless copilot',
    summary: 'A focused 3.1 patch that completes provider setup, document recovery, and the Ask Tagvico experience.',
    status: 'released',
    groups: [
      {
        title: 'Providers and Ask Tagvico',
        items: [
          'Configured provider catalogs, API keys, ChatGPT and GitHub Copilot authentication now live in one Settings experience.',
          'Ask Tagvico supports persistent conversations, search, rename, model selection, retry, copy and privacy-safe tool activity.',
          'Intent-aware research avoids touching Paperless for greetings and uses bounded count, recent-list and document-read tools only when needed.'
        ]
      },
      {
        title: 'Automation',
        items: [
          'Trigger tags are optional: an empty trigger configuration scans every eligible new document and reports exact scan counts.',
          'The default tag ceiling remains four and every provider is instructed to choose the smallest useful tag set.',
          'Explicit rescans bypass trigger-tag filters without deleting history or restore snapshots.',
          'AI and OCR work retry up to three times before moving a document into the terminal-failure queue.',
          'A Paperless write must succeed before Tagvico records history, metrics or processed state.'
        ]
      },
      {
        title: 'History and recovery',
        items: [
          'Document details show assigned metadata, before/after diffs, custom fields, token usage and the original state.',
          'Bulk rescan, exact restore, orphan validation and deliberate cleanup are available from Activity.',
          'Ignored documents form a permanent skip list and Failed/Ignored counts appear in the sidebar.'
        ]
      }
    ]
  },
  {
    version: '3.1.0',
    date: '23 July 2026',
    title: 'One green Tagvico experience',
    summary: 'A quality release that unifies the app, restores settings parity and makes provider-backed Companion research visible.',
    status: 'released',
    groups: [
      {
        title: 'Unified product',
        items: [
          'Actions, Ask Tagvico, Automation, Review, Activity and Settings now share one responsive Next.js shell.',
          'Recovery and Manual processing live under Automation, with clearer task-oriented navigation.',
          'The Tagvico icon, landing page, app and bundled documentation use the same visual system.'
        ]
      },
      {
        title: 'Models and reliability',
        items: [
          'Companion uses configured, live-discovered provider models and defaults to the document-tagging model.',
          'Paperless research exposes privacy-safe tool activity without revealing OCR text or secrets.',
          'Bounded requests, partial loading states and focused regression checks improve slow-instance behavior.'
        ]
      }
    ]
  },
  {
    version: '3.0.0',
    date: '22 July 2026',
    title: 'Action Center and private Companion',
    summary: 'Tagvico grew from filing automation into a private action center grounded in the Paperless archive.',
    status: 'released',
    groups: [
      {
        title: 'New workflows',
        items: [
          'Durable action cases with owner, priority, due date, checklist and audit trail.',
          'Document-grounded Companion sessions with narrow read tools and approval-gated write proposals.',
          'Household roles and encrypted member-specific Paperless tokens.'
        ]
      }
    ]
  }
];

export const currentChangelogAnnouncement = changelogEntries.find((entry) => entry.version === '3.2.0')!;
