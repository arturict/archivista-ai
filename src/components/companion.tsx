'use client';

import { FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  DefaultChatTransport,
  getToolName,
  isToolUIPart,
  type UIMessage
} from 'ai';
import { useChat } from '@ai-sdk/react';
import {
  Check,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  Clipboard,
  FileSearch,
  ListTree,
  LoaderCircle,
  Menu,
  MessageSquarePlus,
  Pencil,
  RotateCcw,
  Search,
  Send,
  ShieldCheck,
  Square,
  Trash2,
  X
} from 'lucide-react';
import {
  companionToolActivity,
  sanitizeCompanionText,
  type CompanionToolActivity as CompanionToolActivityModel
} from '@root/contracts/companion';
import {
  Message,
  MessageAction,
  MessageActions,
  MessageContent,
  MessageResponse
} from '@/components/ai-elements/message';
import { CompanionModelPicker } from '@/components/companion-model-picker';

type Approval = { id: string; action_type: string; payload: Record<string, unknown>; status: string };
type SessionSummary = {
  id: string;
  title: string;
  preview?: string;
  message_count?: number;
  updated_at: string;
};

function approvalValue(value: unknown) {
  if (value === null) return 'None';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return 'Unable to display';
  }
}

function approvalCopy(approval: Approval) {
  const payload = approval.payload || {};
  const patch = payload.patch && typeof payload.patch === 'object'
    ? payload.patch as Record<string, unknown>
    : {};
  if (approval.action_type === 'paperless.tag.create') {
    return {
      title: `Create tag “${String(payload.name || 'New tag')}”`,
      meta: 'Paperless tag',
      details: [String(payload.reason || '')].filter(Boolean)
    };
  }
  if (approval.action_type === 'paperless.tag.update') {
    return {
      title: `Update tag “${String(payload.tagName || `#${payload.tagId}`)}”`,
      meta: `${Number(payload.documentCount) || 0} linked documents`,
      details: [
        ...Object.entries(patch).map(([key, value]) => `${key}: ${String(value)}`),
        String(payload.reason || '')
      ].filter(Boolean)
    };
  }
  if (approval.action_type === 'paperless.tag.delete') {
    return {
      title: `Delete tag “${String(payload.tagName || `#${payload.tagId}`)}”`,
      meta: `${Number(payload.documentCount) || 0} linked documents`,
      details: [String(payload.reason || '')].filter(Boolean)
    };
  }
  if (approval.action_type === 'paperless.patch') {
    return {
      title: `Update ${String(payload.documentTitle || `document #${payload.documentId}`)}`,
      meta: `Document #${String(payload.documentId || '')}`,
      details: [
        ...Object.entries(patch).map(([key, value]) => `${key}: ${approvalValue(value)}`),
        String(payload.reason || '')
      ].filter(Boolean)
    };
  }
  if (approval.action_type === 'action.create') {
    return {
      title: String(payload.title || 'New action'),
      meta: payload.paperlessDocumentId ? `Document #${payload.paperlessDocumentId}` : 'Action',
      details: [String(payload.summary || '')].filter(Boolean)
    };
  }
  return {
    title: 'Update an action',
    meta: 'Action',
    details: Object.keys(patch).length ? [`Fields: ${Object.keys(patch).join(', ')}`] : []
  };
}

const suggestions = [
  {
    icon: FileSearch,
    title: 'Find something',
    prompt: 'Find my most recent insurance documents.'
  },
  {
    icon: CircleAlert,
    title: 'Check what matters',
    prompt: 'Which open actions or deadlines need my attention?'
  },
  {
    icon: ShieldCheck,
    title: 'Understand a document',
    prompt: 'Summarize document #42 and tell me what I need to do.'
  }
];

function relativeDate(value: string, renderedAt: number) {
  const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(value)
    ? `${value.replace(' ', 'T')}Z`
    : value;
  const timestamp = new Date(normalized).getTime();
  if (!Number.isFinite(timestamp)) return '';
  const minutes = Math.round((timestamp - renderedAt) / 60_000);
  const formatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  if (Math.abs(minutes) < 60) return formatter.format(minutes, 'minute');
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return formatter.format(hours, 'hour');
  const days = Math.round(hours / 24);
  return formatter.format(days, 'day');
}

function ToolActivityCard({ activity }: { activity: CompanionToolActivityModel }) {
  const Icon = activity.status === 'running'
    ? LoaderCircle
    : activity.status === 'succeeded'
      ? CheckCircle2
      : activity.status === 'failed'
        ? CircleAlert
        : ShieldCheck;
  const query = String(activity.input?.query || '').trim();
  const documents = activity.result?.documents || [];
  const tags = activity.result?.tags || [];
  const hasDetails = Boolean(query || documents.length || tags.length || activity.result?.count !== undefined);

  return <details className={`companion-tool is-${activity.status}`} open={activity.status === 'failed'}>
    <summary>
      <Icon className={activity.status === 'running' ? 'is-spinning' : undefined} aria-hidden="true" />
      <span>
        <strong>{activity.label}</strong>
        <small>{activity.detail}</small>
      </span>
      <span className="companion-tool-status">
        {activity.status === 'running'
          ? 'Running'
          : activity.status === 'succeeded'
            ? 'Done'
            : activity.status === 'failed'
              ? 'Failed'
              : 'Waiting'}
      </span>
      {hasDetails ? <ChevronRight className="companion-tool-chevron" aria-hidden="true" /> : null}
    </summary>
    {hasDetails ? <div className="companion-tool-details">
      {query ? <p><span>Search</span>{query}</p> : null}
      {activity.result?.count !== undefined ? <p><span>Result</span>{activity.result.count} item{activity.result.count === 1 ? '' : 's'}</p> : null}
      {documents.length ? <ul>
        {documents.map((document) => <li key={document.id}>
          <a className="companion-document-id" href={`/documents/${document.id}`} target="_blank" rel="noreferrer" aria-label={`Open source document ${document.id}`}>#{document.id}</a>
          <strong><a href={`/documents/${document.id}`} target="_blank" rel="noreferrer">{document.title}</a></strong>
          {document.created ? <small>{document.created}</small> : null}
        </li>)}
      </ul> : null}
      {tags.length ? <ul>
        {tags.map((tag) => <li key={tag.id}>
          <span className="companion-document-id">#{tag.id}</span>
          <strong>{tag.name}</strong>
          {tag.documentCount !== undefined ? <small>{tag.documentCount} document{tag.documentCount === 1 ? '' : 's'}</small> : null}
        </li>)}
      </ul> : null}
      <small className="companion-tool-privacy">Only safe metadata is shown here. Document text stays inside the selected model runtime.</small>
    </div> : null}
  </details>;
}

function ToolActivity({ part }: { part: UIMessage['parts'][number] }) {
  const activity = activityFromPart(part);
  if (!activity) return null;
  return <ToolActivityCard activity={activity} />;
}

function activityFromPart(part: UIMessage['parts'][number]): CompanionToolActivityModel | null {
  if (!isToolUIPart(part)) return storedActivity(part);
  return companionToolActivity(
    getToolName(part),
    part.state,
    'input' in part ? part.input : undefined,
    'output' in part ? part.output : undefined
  );
}

function storedActivity(part: UIMessage['parts'][number]): CompanionToolActivityModel | null {
  if (part.type !== 'data-companion-activity' || !('data' in part)) return null;
  const activity = part.data;
  if (!activity || typeof activity !== 'object') return null;
  const candidate = activity as Record<string, unknown>;
  if (typeof candidate.label !== 'string' || typeof candidate.detail !== 'string') return null;
  if (!['running', 'succeeded', 'failed', 'waiting'].includes(String(candidate.status))) return null;
  return {
    toolName: typeof candidate.toolName === 'string' ? candidate.toolName : 'legacy',
    ...candidate
  } as CompanionToolActivityModel;
}

export function Companion({
  sessionId,
  initialMessages,
  initialApprovals,
  initialSessions,
  canApprove,
  renderedAt,
  showFirstRun = false
}: {
  sessionId: string;
  initialMessages: UIMessage[];
  initialApprovals: Approval[];
  initialSessions: SessionSummary[];
  canApprove: boolean;
  renderedAt: number;
  showFirstRun?: boolean;
}) {
  const router = useRouter();
  const [approvals, setApprovals] = useState(initialApprovals);
  const [sessions, setSessions] = useState(initialSessions);
  const [input, setInput] = useState('');
  const [notice, setNotice] = useState('');
  const [decisionBusy, setDecisionBusy] = useState('');
  const [sessionBusy, setSessionBusy] = useState(false);
  const [sessionSearch, setSessionSearch] = useState('');
  const [editingSession, setEditingSession] = useState('');
  const [titleDraft, setTitleDraft] = useState('');
  const [confirmDelete, setConfirmDelete] = useState('');
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [sessionsOpen, setSessionsOpen] = useState(false);
  const [copiedMessage, setCopiedMessage] = useState('');
  const [referenceTime, setReferenceTime] = useState(renderedAt);
  const endRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const {
    messages,
    sendMessage,
    regenerate,
    stop,
    status,
    error,
    clearError
  } = useChat({
    id: sessionId,
    messages: initialMessages,
    transport: new DefaultChatTransport({ api: '/api/companion', body: { sessionId } })
  });
  const isWorking = status === 'streaming' || status === 'submitted';
  const currentSession = sessions.find((session) => session.id === sessionId);
  const filteredSessions = useMemo(() => {
    const query = sessionSearch.trim().toLowerCase();
    return query
      ? sessions.filter((session) => `${session.title} ${session.preview || ''}`.toLowerCase().includes(query))
      : sessions;
  }, [sessionSearch, sessions]);
  const researchActivity = useMemo(
    () => messages.flatMap((message) => message.parts.map(activityFromPart).filter(
      (activity): activity is CompanionToolActivityModel => Boolean(activity)
    )),
    [messages]
  );

  useEffect(() => setSessions(initialSessions), [initialSessions]);
  useEffect(() => {
    setReferenceTime(Date.now());
    const timer = window.setInterval(() => setReferenceTime(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: isWorking ? 'smooth' : 'instant', block: 'end' });
  }, [isWorking, messages]);

  const refreshApprovals = async () => {
    try {
      const response = await fetch('/api/approvals', { cache: 'no-store' });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || 'Could not refresh approvals');
      setApprovals(Array.isArray(body.approvals) ? body.approvals : []);
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : 'Could not refresh approvals');
    }
  };
  const refreshSessions = async () => {
    try {
      const response = await fetch('/api/companion/sessions', { cache: 'no-store' });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || 'Could not refresh conversations');
      setSessions(Array.isArray(body.sessions) ? body.sessions : []);
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : 'Could not refresh conversations');
    }
  };
  useEffect(() => {
    if (status === 'ready') {
      void refreshApprovals();
      void refreshSessions();
    }
  }, [status]);

  const submitText = (text: string) => {
    const normalized = text.trim();
    if (!normalized || status !== 'ready') return;
    setInput('');
    setNotice('');
    clearError();
    if (textareaRef.current) textareaRef.current.style.height = '';
    void sendMessage({ text: normalized });
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    submitText(input);
  };
  const handleComposerKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  };
  const decide = async (id: string, decision: 'approved' | 'rejected') => {
    setNotice('');
    setDecisionBusy(id);
    try {
      const response = await fetch(`/api/approvals/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision })
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || 'Could not decide approval');
      await refreshApprovals();
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : 'Could not decide approval');
    } finally {
      setDecisionBusy('');
    }
  };
  const newChat = async () => {
    setSessionBusy(true);
    setNotice('');
    try {
      const response = await fetch('/api/companion/sessions', { method: 'POST' });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || 'Could not create a conversation');
      router.push(`/companion?chat=${encodeURIComponent(body.sessionId)}`);
      router.refresh();
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : 'Could not create a conversation');
    } finally {
      setSessionBusy(false);
    }
  };
  const renameChat = async (id: string) => {
    const title = titleDraft.trim();
    if (!title) return;
    setSessionBusy(true);
    setNotice('');
    try {
      const response = await fetch(`/api/companion/sessions/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title })
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || 'Could not rename the conversation');
      setEditingSession('');
      await refreshSessions();
      router.refresh();
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : 'Could not rename the conversation');
    } finally {
      setSessionBusy(false);
    }
  };
  const deleteChat = async (id: string) => {
    setSessionBusy(true);
    setNotice('');
    try {
      const response = await fetch(`/api/companion/sessions/${encodeURIComponent(id)}`, { method: 'DELETE' });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || 'Could not delete the conversation');
      setConfirmDelete('');
      if (id === sessionId) {
        setSessionSearch('');
        const replacement = sessions.find((session) => session.id !== id);
        if (replacement) router.push(`/companion?chat=${encodeURIComponent(replacement.id)}`);
        else await newChat();
      } else {
        await refreshSessions();
      }
      router.refresh();
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : 'Could not delete the conversation');
    } finally {
      setSessionBusy(false);
    }
  };
  const copyMessage = async (message: UIMessage) => {
    const text = message.parts
      .filter((part): part is Extract<UIMessage['parts'][number], { type: 'text' }> => part.type === 'text')
      .map((part) => sanitizeCompanionText(part.text))
      .join('\n');
    try {
      await navigator.clipboard.writeText(text);
      setCopiedMessage(message.id);
      window.setTimeout(() => setCopiedMessage(''), 1_500);
    } catch {
      setNotice('Could not copy this answer.');
    }
  };

  return <div className={`companion-studio${inspectorOpen ? ' has-inspector' : ''}`}>
    <aside className={`companion-sidebar panel${sessionsOpen ? ' is-sessions-open' : ''}`} aria-label="Conversations">
      <div className="companion-sidebar-head">
        <div>
          <button
            type="button"
            className="companion-product-mark"
            onClick={() => setSessionsOpen((value) => !value)}
            aria-label="Toggle conversations"
            aria-expanded={sessionsOpen}
          ><Menu aria-hidden="true" /></button>
          <span><strong>Ask Tagvico</strong><small>Your Paperless copilot</small></span>
        </div>
        <button className="companion-icon-button is-accent" type="button" onClick={() => void newChat()} disabled={sessionBusy} aria-label="New chat">
          <MessageSquarePlus aria-hidden="true" />
        </button>
      </div>
      <label className="companion-session-search">
        <Search aria-hidden="true" />
        <input value={sessionSearch} onChange={(event) => setSessionSearch(event.target.value)} placeholder="Search chats" />
      </label>
      <nav>
        {filteredSessions.map((session) => <div className={`companion-session${session.id === sessionId ? ' is-active' : ''}`} key={session.id}>
          {editingSession === session.id ? <form className="companion-session-edit" onSubmit={(event) => { event.preventDefault(); void renameChat(session.id); }}>
            <input autoFocus maxLength={72} value={titleDraft} onChange={(event) => setTitleDraft(event.target.value)} aria-label="Conversation title" />
            <button type="submit" disabled={sessionBusy || !titleDraft.trim()} aria-label="Save title"><Check /></button>
            <button type="button" onClick={() => setEditingSession('')} aria-label="Cancel rename"><X /></button>
          </form> : <>
            <button type="button" className="companion-session-open" onClick={() => router.push(`/companion?chat=${encodeURIComponent(session.id)}`)}>
              <strong>{session.title || 'New conversation'}</strong>
              <small>{session.preview || `${Number(session.message_count) || 0} messages`} · {relativeDate(session.updated_at, referenceTime)}</small>
            </button>
            <div className="companion-session-actions">
              <button type="button" onClick={() => { setEditingSession(session.id); setTitleDraft(session.title || 'New conversation'); }} aria-label={`Rename ${session.title || 'conversation'}`}><Pencil /></button>
              <button type="button" onClick={() => setConfirmDelete(session.id)} aria-label={`Delete ${session.title || 'conversation'}`}><Trash2 /></button>
            </div>
          </>}
          {confirmDelete === session.id ? <div className="companion-delete-confirm">
            <span>Delete this chat?</span>
            <button type="button" onClick={() => void deleteChat(session.id)} disabled={sessionBusy}>Delete</button>
            <button type="button" onClick={() => setConfirmDelete('')}>Cancel</button>
          </div> : null}
        </div>)}
        {!filteredSessions.length ? <p className="companion-no-sessions">No chats match your search.</p> : null}
      </nav>
      <div className="companion-sidebar-foot">
        <ShieldCheck aria-hidden="true" />
        <span><strong>Approval-first</strong><small>Research is read-only. Changes always wait for you.</small></span>
      </div>
    </aside>

    <section className="companion-chat panel">
      <header className="companion-chat-head">
        <button
          type="button"
          className="companion-sessions-mobile-toggle companion-icon-button"
          onClick={() => setSessionsOpen(true)}
          aria-label="Open conversations"
          aria-expanded={sessionsOpen}
        ><Menu aria-hidden="true" /></button>
        <div>
          <strong>{currentSession?.title || 'New conversation'}</strong>
          <small>{isWorking ? 'Working with your selected model…' : 'Ready to research your Paperless library'}</small>
        </div>
        <button type="button" className="companion-approval-toggle" onClick={() => setInspectorOpen((value) => !value)} aria-expanded={inspectorOpen}>
          <ListTree aria-hidden="true" />
          {researchActivity.length
            ? `${researchActivity.length} research step${researchActivity.length === 1 ? '' : 's'}`
            : approvals.length
              ? `${approvals.length} approval${approvals.length === 1 ? '' : 's'}`
              : 'Research trail'}
        </button>
      </header>

      <div className="companion-messages" aria-live="polite">
        {!messages.length ? <div className={`companion-empty${showFirstRun ? ' is-first-run' : ''}`}>
          <span className="companion-empty-mark"><FileSearch aria-hidden="true" /></span>
          <p className="eyebrow">{showFirstRun ? 'Your first five minutes' : 'Grounded in your documents'}</p>
          <h2>{showFirstRun ? 'Start with one real question.' : 'What do you want to know?'}</h2>
          <p>{showFirstRun
            ? 'Your connections are ready. Ask a read-only question, open the cited Paperless source, then request an action. Tagvico will wait for approval before changing anything.'
            : 'Ask naturally. Tagvico will show every Paperless search and document read it uses, then cite the matching document IDs.'}</p>
          {showFirstRun ? <ol className="companion-first-run-steps">
            <li><span>1</span><strong>Ask</strong><small>Start with “Find my most recent documents.”</small></li>
            <li><span>2</span><strong>Verify</strong><small>Open a cited source from the research trail.</small></li>
            <li><span>3</span><strong>Act safely</strong><small>Request an action, review it, then approve or reject.</small></li>
          </ol> : null}
          <div className="companion-suggestions">
            {suggestions.map(({ icon: Icon, title, prompt }) => <button type="button" key={title} onClick={() => submitText(prompt)}>
              <Icon aria-hidden="true" />
              <span><strong>{title}</strong><small>{prompt}</small></span>
              <ChevronRight aria-hidden="true" />
            </button>)}
          </div>
        </div> : messages.map((message, messageIndex) => <Message key={message.id} from={message.role}>
          <MessageContent>
            {message.parts.map((part, index) => {
              if (part.type === 'text') return message.role === 'assistant'
                ? <MessageResponse key={index} isAnimating={isWorking && messageIndex === messages.length - 1}>{sanitizeCompanionText(part.text)}</MessageResponse>
                : <span key={index}>{part.text}</span>;
              if (isToolUIPart(part)) return <ToolActivity key={index} part={part} />;
              const activity = storedActivity(part);
              return activity ? <ToolActivityCard key={index} activity={activity} /> : null;
            })}
          </MessageContent>
          {message.role === 'assistant' && message.parts.some((part) => part.type === 'text') ? <MessageActions className="companion-message-actions">
            <MessageAction label="Copy answer" tooltip="Copy answer" onClick={() => void copyMessage(message)}>
              {copiedMessage === message.id ? <Check /> : <Clipboard />}
            </MessageAction>
            {messageIndex === messages.length - 1 && status === 'ready' ? <MessageAction label="Try again" tooltip="Try again" onClick={() => void regenerate()}>
              <RotateCcw />
            </MessageAction> : null}
          </MessageActions> : null}
        </Message>)}
        {status === 'submitted' ? <div className="companion-thinking"><LoaderCircle className="is-spinning" /><span>Planning the right research steps…</span></div> : null}
        <div ref={endRef} />
      </div>

      {(error || notice) ? <div className="companion-notice" role="alert">
        <CircleAlert aria-hidden="true" />
        <span>{error?.message || notice}</span>
        <button type="button" onClick={() => { clearError(); setNotice(''); }} aria-label="Dismiss error"><X /></button>
      </div> : null}
      <form className="companion-composer" onSubmit={submit}>
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(event) => {
            setInput(event.target.value);
            event.currentTarget.style.height = '0';
            event.currentTarget.style.height = `${Math.min(event.currentTarget.scrollHeight, 180)}px`;
          }}
          onKeyDown={handleComposerKeyDown}
          placeholder="Ask about a document, deadline, person, amount…"
          aria-label="Message"
          rows={1}
        />
        <div className="companion-composer-bar">
          <CompanionModelPicker sessionId={sessionId} />
          <span className="companion-composer-hint">Enter to send · Shift+Enter for a new line</span>
          {isWorking ? <button className="companion-send is-stop" type="button" onClick={() => void stop()} aria-label="Stop response">
            <Square aria-hidden="true" />
          </button> : <button className="companion-send" type="submit" disabled={!input.trim()} aria-label="Send message">
            <Send aria-hidden="true" />
          </button>}
        </div>
      </form>
    </section>

    {inspectorOpen ? <aside className="companion-approvals companion-research panel" aria-label="Research trail and pending approvals">
      <header>
        <div><span className="eyebrow">Visible by default</span><h2>Research trail</h2></div>
        <button className="companion-icon-button" type="button" onClick={() => setInspectorOpen(false)} aria-label="Close research trail"><X /></button>
      </header>
      <p className="muted">Every Paperless search and document read used for this answer appears here.</p>
      <div className="companion-research-steps">
        {researchActivity.length
          ? researchActivity.map((activity, index) => <ToolActivityCard key={`${activity.toolName}-${index}`} activity={activity} />)
          : <div className="companion-research-empty">
            <FileSearch aria-hidden="true" />
            <strong>No research yet</strong>
            <span>Ask a question and the steps will appear here as they run.</span>
          </div>}
      </div>
      {approvals.length ? <div className="companion-approval-section">
        <div className="companion-approval-section-head">
          <span className="eyebrow">Nothing changes silently</span>
          <strong>{approvals.length} pending approval{approvals.length === 1 ? '' : 's'}</strong>
        </div>
        {approvals.map((approval) => {
          const copy = approvalCopy(approval);
          return <article className="approval companion-approval-card" key={approval.id}>
          <span className="pill suggested">approval required</span>
          <h3>{copy.title}</h3>
          <p>{copy.meta}</p>
          {copy.details.length ? <ul className="companion-approval-details">
            {copy.details.map((detail) => <li key={detail}>{detail}</li>)}
          </ul> : null}
          {canApprove ? <div className="approval-actions">
            <button type="button" className="button primary" disabled={!!decisionBusy} onClick={() => void decide(approval.id, 'approved')}>Approve</button>
            <button type="button" className="button danger" disabled={!!decisionBusy} onClick={() => void decide(approval.id, 'rejected')}>Reject</button>
          </div> : <p className="muted">Your role cannot decide this proposal.</p>}
        </article>;
        })}
      </div> : null}
    </aside> : null}
  </div>;
}
