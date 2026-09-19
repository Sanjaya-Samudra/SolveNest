/* =====================================================================
   SolveNest — Student Messages
   /student/messages  ·  "The SolveNest Collaboration Room"

   All CSS + motion live in the <style> block below, scoped under .sn-msgs.
   Data layer: client/src/student/studentMessagesData.js
   ===================================================================== */

import React, {
  useState,
  useRef,
  useEffect,
  useMemo,
  useCallback,
  useLayoutEffect,
} from "react";

import {
  fetchStudentConversations,
  fetchStudentMessages,
  sendStudentMessage,
  markConversationRead,
  uploadConversationFile,
  STAGES,
} from "../../student/studentMessagesData.js";

/* ---------------------------------------------------------------------
   CAPABILITIES — mirror your backend. false = feature is not rendered.
--------------------------------------------------------------------- */
const caps = {
  typingIndicator: false,
  presence: false,
  readReceipts: false,
  messageSearch: false,
  conversationSearch: true,
  reply: false,
  moderation: true,
  pagination: true,
};

/* ---------------------------------------------------------------------
   Time helpers
--------------------------------------------------------------------- */
function formatTime(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function formatShortTimestamp(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'now';
  if (diffMin < 60) return `${diffMin} min`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} h`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay === 1) return 'Yesterday';
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function formatTimestamp(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();
  const time = formatTime(date);
  if (isToday) return time;
  if (isYesterday) return `Yesterday · ${time}`;
  return `${date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} · ${time}`;
}

/* ---------------------------------------------------------------------
   Local moderation HINT only. Backend remains the authority.
--------------------------------------------------------------------- */
function screenMessage(text) {
  if (!caps.moderation || !text) return null;
  const hits = [];
  const email = /\b[\w.+-]+@[\w-]+\.[a-z]{2,}\b/gi;
  const social = /\b(?:whatsapp|telegram|viber|insta(?:gram)?|snapchat|wechat|imo)\b/gi;
  const offPay = /\b(?:bank transfer|paypal|outside solvenest|off ?platform|pay me directly)\b/gi;
  for (const re of [email, social, offPay]) {
    let m;
    while ((m = re.exec(text))) hits.push({ start: m.index, end: m.index + m[0].length });
  }
  return hits.length ? hits.sort((a, b) => a.start - b.start) : null;
}

/* ---------------------------------------------------------------------
   Small helpers
--------------------------------------------------------------------- */
const useMediaQuery = (query) => {
  const [match, setMatch] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false
  );
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = (e) => setMatch(e.matches);
    mq.addEventListener('change', on);
    setMatch(mq.matches);
    return () => mq.removeEventListener('change', on);
  }, [query]);
  return match;
};

const Icon = ({ name, ...rest }) => {
  const p = { width: 16, height: 16, viewBox: '0 0 16 16', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true, ...rest };
  const paths = {
    search: <><circle cx="7" cy="7" r="4.5" /><path d="M10.5 10.5 14 14" /></>,
    send: <><path d="M8 13V3" /><path d="M4 6.5 8 2.8l4 3.7" /></>,
    clip: <path d="M10.8 5.2 6 10a1.7 1.7 0 0 0 2.4 2.4l5-5a3.2 3.2 0 0 0-4.5-4.5l-5.2 5.2a4.7 4.7 0 0 0 6.7 6.7" />,
    back: <><path d="M9.5 3 4.5 8l5 5" /></>,
    info: <><circle cx="8" cy="8" r="6" /><path d="M8 7.2v4M8 5.1v.1" /></>,
    close: <><path d="M4 4l8 8M12 4l-8 8" /></>,
    down: <><path d="M8 3v10" /><path d="M4 9.5 8 13.2l4-3.7" /></>,
    file: <><path d="M4 2h5l3 3v9H4z" /><path d="M9 2v3h3" /></>,
    open: <><path d="M14 10v3a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h3" /><path d="M9 2h5v5" /><path d="M14 2L7 9" /></>,
    refresh: <><path d="M13 8a5 5 0 1 1-1.6-3.6" /><path d="M13 2.5V5h-2.5" /></>,
  };
  return <svg {...p}>{paths[name]}</svg>;
};

/* ---------------------------------------------------------------------
   Task state ribbon
--------------------------------------------------------------------- */
function TaskConversationRibbon({ stageIndex, compact = false }) {
  const prev = stageIndex > 0 ? STAGES[stageIndex - 1] : null;
  const curr = STAGES[stageIndex];
  const next = stageIndex < STAGES.length - 1 ? STAGES[stageIndex + 1] : null;
  return (
    <div className={'sn-ribbon' + (compact ? ' is-compact' : '')} aria-label={`Task stage: ${curr}`}>
      <div className="sn-ribbon__rail" aria-hidden="true">
        <span className="sn-ribbon__seg is-done" />
        <span className="sn-ribbon__node is-done" />
        <span className="sn-ribbon__seg is-done" />
        <span className="sn-ribbon__node is-current" />
        <span className="sn-ribbon__seg" />
        <span className="sn-ribbon__node" />
      </div>
      <div className="sn-ribbon__labels">
        <span className="sn-ribbon__step"><em>Previous</em>{prev || '—'}</span>
        <span className="sn-ribbon__step is-current"><em>Now</em>{curr}</span>
        <span className="sn-ribbon__step is-next"><em>Next</em>{next || 'Complete'}</span>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------
   Conversation row
--------------------------------------------------------------------- */
function ConversationRow({ c, selected, onSelect }) {
  return (
    <li>
      <button
        type="button"
        className={'sn-row' + (selected ? ' is-selected' : '') + (c.unread ? ' is-unread' : '')}
        onClick={() => onSelect(c.id)}
        aria-current={selected ? 'true' : undefined}
      >
        <span className="sn-row__title">{c.taskTitle}</span>
        <span className="sn-row__meta">
          <span className={'sn-state sn-state--' + c.state}>{STAGES[c.stageIndex]}</span>
          <span className="sn-row__who">{c.participant.name}</span>
        </span>
        <span className="sn-row__preview">
          {c.lastIsSystem ? <span className="sn-row__sys">{c.lastPreview}</span> : c.lastPreview}
        </span>
        <span className="sn-row__time">{formatShortTimestamp(c.lastAt)}</span>
        {c.unread > 0 && <span className="sn-row__unread" aria-label={`${c.unread} unread`}>{c.unread}</span>}
        {c.needsStudent && <span className="sn-row__needs" aria-label="Needs your response" />}
      </button>
    </li>
  );
}

/* ---------------------------------------------------------------------
   Message pieces
--------------------------------------------------------------------- */
function Attachment({ a }) {
  return (
    <a className="sn-attach" href="#" onClick={(e) => e.preventDefault()}>
      <Icon name="file" className="sn-attach__icon" />
      <span className="sn-attach__body">
        <span className="sn-attach__name">{a.name}</span>
        <span className="sn-attach__meta">{a.type} · {a.size}</span>
      </span>
      <span className="sn-attach__cta">View</span>
    </a>
  );
}

function SystemEvent({ m }) {
  return (
    <div className="sn-event" role="note">
      <span className="sn-event__rule" aria-hidden="true" />
      <span className="sn-event__body">
        <span className="sn-event__title">{m.title}</span>
        <span className="sn-event__at">{formatTimestamp(m.at)}</span>
        {m.action && (
          <a className="sn-event__action" href={m.action.href} onClick={(e) => e.preventDefault()}>
            {m.action.label}
          </a>
        )}
      </span>
      <span className="sn-event__rule" aria-hidden="true" />
    </div>
  );
}

function Message({ m, grouped }) {
  const mine = m.from === 'student';
  return (
    <article className={'sn-msg sn-msg--' + m.from + (grouped ? ' is-grouped' : '') + (m.pending ? ' is-pending' : '') + (m.failed ? ' is-failed' : '')}>
      {!grouped && !mine && (
        <header className="sn-msg__id">
          <span className="sn-avatar" aria-hidden="true">{m.initials}</span>
          <span className="sn-msg__name">{m.author}</span>
          {m.role && <span className="sn-msg__role">{m.role}</span>}
        </header>
      )}
      <div className="sn-msg__bubble">
        <p className="sn-msg__body">{m.body}</p>
        {m.attachments?.length > 0 && (
          <div className="sn-msg__files">
            {m.attachments.map((a) => <Attachment key={a.id} a={a} />)}
          </div>
        )}
        {mine && <span className="sn-msg__time">{formatTime(m.at)}</span>}
      </div>
      {m.failed && (
        <div className="sn-msg__failbar">
          <span>Message not sent.</span>
          <button type="button">Retry</button>
        </div>
      )}
    </article>
  );
}

/* ---------------------------------------------------------------------
   Task context
--------------------------------------------------------------------- */
function TaskContextBody({ c, onRespond }) {
  const next = c.stageIndex < STAGES.length - 1 ? STAGES[c.stageIndex + 1] : 'Complete';
  return (
    <div className="sn-ctx__body">
      <h3 className="sn-ctx__task">{c.taskTitle}</h3>
      <p className="sn-ctx__ref">{c.taskRef} · {c.subject}</p>
      <div className="sn-ctx__now">
        <div><em>Now</em>{STAGES[c.stageIndex]}</div>
        <div><em>Next</em>{next}</div>
      </div>
      {c.needsStudent && (
        <div className="sn-ctx__needs">
          <p className="sn-ctx__needs-h">You need to respond</p>
          <p className="sn-ctx__needs-b">{c.needsReason}</p>
          <button type="button" className="sn-link" onClick={onRespond}>Reply in this conversation</button>
        </div>
      )}
      <dl className="sn-ctx__kv">
        <div><dt>Deadline</dt><dd>{c.deadline || '—'}</dd></div>
        <div><dt>Plan</dt><dd>{c.plan || '—'}</dd></div>
        <div><dt>Files</dt><dd>{c.fileCount} shared</dd></div>
      </dl>
      {c.files && c.files.length > 0 && (
        <div className="sn-ctx__files">
          <p className="sn-ctx__files-h">Open files</p>
          <ul className="sn-ctx__files-list">
            {c.files.map((f) => (
              <li key={f.id}>
                <a className="sn-ctx__file" href="#" onClick={(e) => e.preventDefault()}>
                  <Icon name="file" width={14} height={14} />
                  <span className="sn-ctx__file-name">{f.name}</span>
                  <span className="sn-ctx__file-meta">{f.type} · {f.size}</span>
                  <Icon name="open" width={12} height={12} />
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="sn-ctx__expert">
        <span className="sn-avatar sn-avatar--lg" aria-hidden="true">{c.participant.initials}</span>
        <div>
          <p className="sn-ctx__expert-name">{c.participant.name}</p>
          <p className="sn-ctx__expert-role">{c.participant.role}{c.participant.expertise ? ` · ${c.participant.expertise}` : ''}</p>
        </div>
      </div>
      <nav className="sn-ctx__links" aria-label="Related pages">
        <a href="#" onClick={(e) => e.preventDefault()}>Open task room</a>
        <a href="#" onClick={(e) => e.preventDefault()}>View files</a>
      </nav>
    </div>
  );
}

/* ---------------------------------------------------------------------
   Composer
--------------------------------------------------------------------- */
function Composer({ conversation, onSend, inputRef }) {
  const [value, setValue] = useState('');
  const [file, setFile] = useState(null);
  const [flag, setFlag] = useState(null);
  const [sending, setSending] = useState(false);
  const taRef = useRef(null);
  const fileRef = useRef(null);
  const readOnly = conversation.state === 'closed';

  useLayoutEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 200) + 'px';
  }, [value]);

  const placeholder = conversation.participant.role === 'Verified Expert'
    ? `Message ${conversation.participant.name.split(' ')[0]}…`
    : 'Reply to SolveNest…';

  const submit = async () => {
    if (readOnly || sending) return;
    const text = value.trim();
    if (!text && !file) return;
    const hits = screenMessage(text);
    if (hits) { setFlag(hits); return; }
    setSending(true);
    try {
      await onSend({ text, file });
      setValue(''); setFile(null); setFlag(null);
    } catch (err) {
      setFlag([{ start: 0, end: 0, error: err.message }]);
    } finally {
      setSending(false);
    }
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); }
  };

  if (readOnly) {
    return (
      <div className="sn-closed">
        <p className="sn-closed__h">Conversation closed</p>
        <p className="sn-closed__b">This conversation stays here for reference.</p>
        <a className="sn-link" href="#" onClick={(e) => e.preventDefault()}>Open completed task</a>
      </div>
    );
  }

  return (
    <div className={'sn-composer' + (flag ? ' is-flagged' : '')}>
      {file && (
        <div className="sn-upload">
          <Icon name="file" />
          <span className="sn-upload__name">{file.name}</span>
          <span className="sn-upload__meta">{(file.size / 1048576).toFixed(1)} MB</span>
          <button type="button" className="sn-iconbtn" onClick={() => setFile(null)} aria-label="Remove attachment"><Icon name="close" /></button>
        </div>
      )}
      {flag && flag[0]?.error && (
        <div className="sn-flag" role="status">
          <p className="sn-flag__h">Could not send</p>
          <p className="sn-flag__b">{flag[0].error}</p>
          <div className="sn-flag__acts">
            <button type="button" className="sn-btn sn-btn--quiet" onClick={() => setFlag(null)}>Dismiss</button>
          </div>
        </div>
      )}
      {flag && !flag[0]?.error && (
        <div className="sn-flag" role="status">
          <p className="sn-flag__h">Keep communication in SolveNest</p>
          <p className="sn-flag__b">This message may contain information that should stay inside SolveNest.</p>
          <div className="sn-flag__acts">
            <button type="button" className="sn-btn sn-btn--quiet" onClick={() => { setFlag(null); taRef.current?.focus(); }}>Edit message</button>
            <button type="button" className="sn-btn sn-btn--quiet">Request review</button>
          </div>
        </div>
      )}
      <form className="sn-composer__bar" onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <button type="button" className="sn-iconbtn sn-iconbtn--lg" aria-label="Attach a file" onClick={() => fileRef.current?.click()}>
          <Icon name="clip" width={18} height={18} />
        </button>
        <input ref={fileRef} type="file" hidden accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.zip"
               onChange={(e) => setFile(e.target.files?.[0] || null)} />
        <textarea
          ref={(el) => { taRef.current = el; if (inputRef) inputRef.current = el; }}
          className="sn-composer__input"
          rows={1}
          value={value}
          placeholder={placeholder}
          aria-label="Write a message"
          onChange={(e) => { setValue(e.target.value); if (flag) setFlag(null); }}
          onKeyDown={onKeyDown}
        />
        <button type="submit" className="sn-send" aria-label="Send message" disabled={sending || (!value.trim() && !file)}>
          {sending ? <span className="sn-send-spinner" /> : <Icon name="send" width={18} height={18} />}
        </button>
      </form>
      <p className="sn-composer__hint">PDF, Word, images or ZIP · Enter sends, Shift + Enter adds a line</p>
    </div>
  );
}

/* ---------------------------------------------------------------------
   Loading / Error states
--------------------------------------------------------------------- */
function NavSkeleton() {
  return <div className="sn-nav-skeleton">{Array.from({ length: 4 }, (_, i) => <div key={i} className="sn-nav-skeleton-row"><span /><span /><span /></div>)}</div>;
}

function ThreadSkeleton() {
  return <div className="sn-thread-skeleton">{Array.from({ length: 5 }, (_, i) => <div key={i} className={'sn-msg-skeleton' + (i % 3 === 0 ? ' is-right' : '')}><span /><span /></div>)}</div>;
}

function NavError({ onRetry, access }) {
  return (
    <div className="sn-empty">
      <p className="sn-empty__h">{access ? 'Sign in required' : 'Could not load conversations'}</p>
      <p className="sn-empty__b">{access ? 'Your session has expired.' : 'Something went wrong loading your conversations.'}</p>
      <button className="sn-link" onClick={access ? () => { window.history.pushState({}, '', '/login'); window.dispatchEvent(new PopStateEvent('popstate')); } : onRetry}>
        {access ? 'Sign in' : 'Retry'}
      </button>
    </div>
  );
}

/* =====================================================================
   PAGE
===================================================================== */
export function StudentMessagesPage() {
  const [conversations, setConversations] = useState([]);
  const [convLoading, setConvLoading] = useState(true);
  const [convError, setConvError] = useState(null);
  const [threads, setThreads] = useState({});
  const [threadLoading, setThreadLoading] = useState(false);
  const [threadError, setThreadError] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [mobileView, setMobileView] = useState('list');
  const [atBottom, setAtBottom] = useState(true);

  const isMobile = useMediaQuery('(max-width: 767px)');
  const isWide = useMediaQuery('(min-width: 1380px)');

  const scrollRef = useRef(null);
  const composerRef = useRef(null);
  const threadHeadingRef = useRef(null);
  const loadConvController = useRef(null);
  const loadMsgController = useRef(null);

  /* ── Fetch conversations ──────────────────────────────────────────── */
  const loadConversations = useCallback(() => {
    loadConvController.current?.abort();
    const controller = new AbortController();
    loadConvController.current = controller;
    setConvLoading(true);
    setConvError(null);
    fetchStudentConversations({ signal: controller.signal })
      .then((list) => { if (!controller.signal.aborted) { setConversations(list); setConvLoading(false); } })
      .catch((err) => { if (!controller.signal.aborted && err.name !== 'AbortError') { setConvError(err); setConvLoading(false); } });
  }, []);

  useEffect(() => { loadConversations(); return () => loadConvController.current?.abort(); }, [loadConversations]);

  /* ── Fetch messages for selected conversation ─────────────────────── */
  const loadMessages = useCallback((convId) => {
    loadMsgController.current?.abort();
    if (!convId) { setThreads((t) => { const n = { ...t }; delete n.__loading; return n; }); return; }
    const controller = new AbortController();
    loadMsgController.current = controller;
    setThreadLoading(true);
    setThreadError(null);
    fetchStudentMessages(convId, { signal: controller.signal })
      .then(({ messages }) => {
        if (controller.signal.aborted) return;
        setThreads((t) => ({ ...t, [convId]: messages }));
        setThreadLoading(false);
      })
      .catch((err) => {
        if (!controller.signal.aborted && err.name !== 'AbortError') {
          setThreadError(err);
          setThreadLoading(false);
        }
      });
  }, []);

  useEffect(() => { loadMessages(selectedId); return () => loadMsgController.current?.abort(); }, [selectedId, loadMessages]);

  /* ── Select conversation ──────────────────────────────────────────── */
  const selected = conversations.find((c) => c.id === selectedId) || null;
  const messages = selected ? threads[selected.id] || [] : [];

  const selectConversation = useCallback((id) => {
    setSelectedId(id);
    if (isMobile) setMobileView('thread');
    setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, unread: 0 } : c)));
    markConversationRead(id).catch(() => {});
  }, [isMobile]);

  /* ── Send message ─────────────────────────────────────────────────── */
  const send = useCallback(async ({ text, file }) => {
    if (!selectedId) return;
    const optimistic = {
      id: 'tmp_' + Date.now(),
      kind: 'message',
      from: 'student',
      author: 'You',
      at: new Date(),
      body: text,
      pending: true,
      attachments: file ? [{ id: 'tmp_f', name: file.name, type: (file.name.split('.').pop() || '').toUpperCase(), size: (file.size / 1048576).toFixed(1) + ' MB' }] : [],
    };
    setThreads((t) => ({ ...t, [selectedId]: [...(t[selectedId] || []), optimistic] }));
    requestAnimationFrame(() => {
      const el = scrollRef.current;
      if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    });

    let sentFileId = null;
    if (file) {
      try { const uploaded = await uploadConversationFile(selectedId, file); sentFileId = uploaded.id; } catch {}
    }

    const real = await sendStudentMessage(selectedId, { text, fileId: sentFileId });
    setThreads((t) => ({
      ...t,
      [selectedId]: (t[selectedId] || []).map((m) => (m.id === optimistic.id ? { ...real, pending: false } : m)),
    }));
    setConversations((prev) => prev.map((c) => c.id === selectedId ? { ...c, lastAt: new Date(), lastPreview: text, lastIsSystem: false } : c));
  }, [selectedId]);

  /* ── Filtered list ────────────────────────────────────────────────── */
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return conversations.filter((c) => {
      if (filter === 'unread' && !c.unread) return false;
      if (filter === 'needs' && !c.needsStudent) return false;
      if (!q) return true;
      return c.taskTitle.toLowerCase().includes(q) || c.taskRef.toLowerCase().includes(q) || c.participant.name.toLowerCase().includes(q);
    });
  }, [conversations, filter, query]);

  const unreadConvos = conversations.filter((c) => c.unread > 0).length;

  /* ── Scroll handling ──────────────────────────────────────────────── */
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const unread = el.querySelector('[data-unread-marker]');
    if (unread) unread.scrollIntoView({ block: 'center' });
    else { el.scrollTo({ top: el.scrollHeight }); }
  }, [selectedId, messages.length]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 80);
  };

  useEffect(() => {
    if (isMobile && mobileView === 'thread') threadHeadingRef.current?.focus();
  }, [isMobile, mobileView]);

  /* ── Render ───────────────────────────────────────────────────────── */
  const showRail = isWide && selected;

  return (
    <div className="sn-msgs" data-mobile-view={isMobile ? mobileView : undefined}>
      <style>{CSS}</style>

      {/* LEFT — conversations */}
      <nav className="sn-nav" aria-label="Task conversations">
        <div className="sn-nav__head">
          <h1 className="sn-nav__title">Messages</h1>
          {unreadConvos > 0 && <p className="sn-nav__count">{unreadConvos} unread</p>}
        </div>
        {caps.conversationSearch && (
          <div className="sn-search">
            <Icon name="search" />
            <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search conversations…" aria-label="Search" />
          </div>
        )}
        <div className="sn-filters" role="tablist" aria-label="Filter">
          {[['all', 'All'], ['needs', 'Needs you'], ['unread', 'Unread']].map(([k, label]) => (
            <button key={k} role="tab" aria-selected={filter === k} className={'sn-filter' + (filter === k ? ' is-on' : '')} onClick={() => setFilter(k)}>{label}</button>
          ))}
        </div>
        <div className="sn-nav__scroll">
          {convError && <NavError onRetry={loadConversations} access={convError.message === 'STUDENT_ACCESS_REQUIRED'} />}
          {convLoading && !convError && <NavSkeleton />}
          {!convLoading && !convError && filtered.length === 0 && query && (
            <div className="sn-empty">
              <p className="sn-empty__h">No matching conversations</p>
              <button className="sn-link" onClick={() => setQuery('')}>Clear search</button>
            </div>
          )}
          {!convLoading && !convError && filtered.length === 0 && !query && (
            <div className="sn-empty">
              <p className="sn-empty__h">No conversations yet</p>
              <p className="sn-empty__b">Conversations appear here once communication opens for your tasks.</p>
            </div>
          )}
          <ul className="sn-rows">
            {filtered.map((c) => (
              <ConversationRow key={c.id} c={c} selected={c.id === selectedId} onSelect={selectConversation} />
            ))}
          </ul>
        </div>
      </nav>

      {/* CENTER — thread */}
      <main className="sn-thread" aria-label="Conversation">
        {!selected ? (
          <div className="sn-blank">
            <p className="sn-blank__h">Select a conversation</p>
            <p className="sn-blank__b">Choose a task conversation to continue.</p>
          </div>
        ) : (
          <>
            <header className="sn-thead">
              {isMobile && (
                <button className="sn-iconbtn" onClick={() => setMobileView('list')} aria-label="Back">
                  <Icon name="back" width={18} height={18} />
                </button>
              )}
              <div className="sn-thead__main">
                <h2 className="sn-thead__task" tabIndex={-1} ref={threadHeadingRef}>{selected.taskTitle}</h2>
                <p className="sn-thead__ref">{selected.taskRef} · {selected.subject}</p>
                <p className="sn-thead__who">
                  <span className="sn-avatar sn-avatar--sm" aria-hidden="true">{selected.participant.initials}</span>
                  {selected.participant.name}
                  <span className="sn-thead__role">{selected.participant.role}</span>
                </p>
              </div>
              {!isWide && (
                <button className="sn-btn sn-btn--quiet" onClick={() => setDrawerOpen(true)}>
                  <Icon name="info" /> Details
                </button>
              )}
            </header>

            <TaskConversationRibbon stageIndex={selected.stageIndex} compact={isMobile} />

            <div className="sn-history" ref={scrollRef} onScroll={onScroll}>
              {threadLoading && <ThreadSkeleton />}
              {threadError && (
                <div className="sn-empty">
                  <p className="sn-empty__h">Could not load messages</p>
                  <button className="sn-link" onClick={() => loadMessages(selectedId)}>Retry</button>
                </div>
              )}
              {!threadLoading && !threadError && messages.map((m, i) => {
                if (m.kind === 'date') return <div key={m.id} className="sn-datesep">{m.label}</div>;
                if (m.kind === 'unread') return <div key={m.id} className="sn-newmark" data-unread-marker="true"><span>New messages</span></div>;
                if (m.kind === 'event') return <SystemEvent key={m.id} m={m} />;
                const prev = messages[i - 1];
                const grouped = prev && prev.kind === 'message' && prev.from === m.from;
                return <Message key={m.id} m={m} grouped={grouped} />;
              })}
            </div>

            <Composer conversation={selected} onSend={send} inputRef={composerRef} />
          </>
        )}
      </main>

      {/* RIGHT — context rail */}
      {showRail && (
        <aside className="sn-ctx" aria-label="Task context">
          <p className="sn-ctx__label">Task context</p>
          <TaskContextBody c={selected} onRespond={() => composerRef.current?.focus()} />
        </aside>
      )}

      {/* Drawer */}
      {!isWide && selected && (
        <>
          <div className={'sn-scrim' + (drawerOpen ? ' is-open' : '')} onClick={() => setDrawerOpen(false)} />
          <aside className={'sn-drawer' + (drawerOpen ? ' is-open' : '')} aria-label="Task context" aria-hidden={!drawerOpen}>
            <div className="sn-drawer__head">
              <p className="sn-ctx__label">Task context</p>
              <button className="sn-iconbtn" onClick={() => setDrawerOpen(false)} aria-label="Close"><Icon name="close" /></button>
            </div>
            <div className="sn-drawer__scroll">
              <TaskContextBody c={selected} onRespond={() => { setDrawerOpen(false); composerRef.current?.focus(); }} />
            </div>
          </aside>
        </>
      )}
    </div>
  );
}

/* =====================================================================
   STYLES
===================================================================== */
const CSS = `
.sn-msgs{
  --sn-accent:#4A3AC8;
  --sn-accent-soft:#EEEBFB;
  --sn-ink:#15151C;
  --sn-ink-2:#4A4A58;
  --sn-ink-3:#7B7B8A;
  --sn-line:#E4E3EC;
  --sn-line-soft:#EFEEF4;
  --sn-surface:#FFFFFF;
  --sn-canvas:#FAFAFC;
  --sn-expert:#F3F3F7;
  --sn-warn:#8A5A12;
  --sn-warn-bg:#FDF6E8;
  --sn-shell-offset:72px;
  display:grid;
  grid-template-columns:320px minmax(0,1fr);
  height:calc(100vh - var(--sn-shell-offset));
  min-height:520px;
  color:var(--sn-ink);
  font-size:14px;
  line-height:1.5;
  background:var(--sn-surface);
  border-top:1px solid var(--sn-line-soft);
  overflow:hidden;
}
@media (min-width:1380px){ .sn-msgs{ grid-template-columns:330px minmax(0,1fr) 300px; } }
.sn-msgs *,.sn-msgs *::before,.sn-msgs *::after{ box-sizing:border-box; }
.sn-msgs button{ font:inherit; color:inherit; background:none; border:0; cursor:pointer; }
.sn-msgs :focus-visible{ outline:2px solid var(--sn-accent); outline-offset:2px; border-radius:4px; }

.sn-link{ color:var(--sn-accent); font-size:13px; font-weight:600; padding:0; text-decoration:none; background:none; border:0; cursor:pointer; }
.sn-link:hover{ text-decoration:underline; }
.sn-btn{ display:inline-flex; align-items:center; gap:6px; height:32px; padding:0 12px; border-radius:7px; font-size:13px; font-weight:600; }
.sn-btn--quiet{ border:1px solid var(--sn-line); color:var(--sn-ink-2); background:var(--sn-surface); }
.sn-btn--quiet:hover{ background:var(--sn-canvas); }
.sn-iconbtn{ display:inline-flex; align-items:center; justify-content:center; width:30px; height:30px; border-radius:7px; color:var(--sn-ink-3); flex:none; }
.sn-iconbtn:hover{ background:var(--sn-line-soft); color:var(--sn-ink); }
.sn-iconbtn--lg{ width:36px; height:36px; }
.sn-avatar{ display:inline-flex; align-items:center; justify-content:center; width:26px; height:26px; border-radius:50%; background:var(--sn-accent-soft); color:var(--sn-accent); font-size:11px; font-weight:700; letter-spacing:.02em; flex:none; }
.sn-avatar--sm{ width:20px; height:20px; font-size:10px; }
.sn-avatar--lg{ width:38px; height:38px; font-size:13px; }

.sn-nav{ display:flex; flex-direction:column; min-height:0; border-right:1px solid var(--sn-line); background:var(--sn-surface); }
.sn-nav__head{ padding:18px 20px 10px; }
.sn-nav__title{ margin:0; font-size:19px; font-weight:650; letter-spacing:-.01em; }
.sn-nav__count{ margin:2px 0 0; font-size:12.5px; color:var(--sn-ink-3); }
.sn-search{ display:flex; align-items:center; gap:8px; margin:4px 16px 12px; padding:0 10px; height:34px; border:1px solid var(--sn-line); border-radius:8px; color:var(--sn-ink-3); transition:border-color .15s ease; }
.sn-search:focus-within{ border-color:var(--sn-accent); }
.sn-search input{ flex:1; min-width:0; border:0; outline:none; background:none; font-size:13px; color:var(--sn-ink); }
.sn-filters{ display:flex; gap:2px; padding:0 16px 8px; }
.sn-filter{ padding:5px 10px; border-radius:6px; font-size:12px; font-weight:600; color:var(--sn-ink-3); }
.sn-filter:hover{ background:var(--sn-line-soft); }
.sn-filter.is-on{ background:var(--sn-accent-soft); color:var(--sn-accent); }
.sn-nav__scroll{ flex:1; min-height:0; overflow-y:auto; border-top:1px solid var(--sn-line-soft); }
.sn-rows{ list-style:none; margin:0; padding:0; }
.sn-row{ position:relative; display:grid; width:100%; text-align:left; grid-template-columns:minmax(0,1fr) auto; gap:2px 8px; padding:12px 16px; border-bottom:1px solid var(--sn-line-soft); transition:background .12s ease; }
.sn-row:hover{ background:var(--sn-canvas); }
.sn-row::before{ content:""; position:absolute; left:0; top:0; bottom:0; width:2px; background:var(--sn-accent); opacity:0; transition:opacity .15s ease; }
.sn-row.is-selected{ background:var(--sn-canvas); }
.sn-row.is-selected::before{ opacity:1; }
.sn-row__title{ grid-column:1; font-size:14px; font-weight:560; line-height:1.35; color:var(--sn-ink); overflow:hidden; text-overflow:ellipsis; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; }
.sn-row.is-unread .sn-row__title{ font-weight:700; }
.sn-row__meta{ grid-column:1; display:flex; align-items:center; gap:6px; font-size:11.5px; color:var(--sn-ink-3); min-width:0; }
.sn-row__who{ overflow:hidden; white-space:nowrap; text-overflow:ellipsis; }
.sn-row__preview{ grid-column:1; margin-top:2px; font-size:12.5px; color:var(--sn-ink-2); overflow:hidden; text-overflow:ellipsis; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; }
.sn-row__sys{ font-style:italic; color:var(--sn-ink-3); }
.sn-row__time{ grid-column:2; grid-row:1; font-size:11px; color:var(--sn-ink-3); white-space:nowrap; }
.sn-row__unread{ grid-column:2; grid-row:3; justify-self:end; min-width:18px; height:18px; padding:0 5px; display:inline-flex; align-items:center; justify-content:center; border-radius:9px; background:var(--sn-accent); color:#fff; font-size:10px; font-weight:700; }
.sn-row__needs{ grid-column:2; grid-row:2; justify-self:end; width:6px; height:6px; border-radius:50%; background:var(--sn-warn); }
.sn-state{ display:inline-flex; align-items:center; gap:4px; font-size:11px; font-weight:600; color:var(--sn-ink-2); white-space:nowrap; }
.sn-state::before{ content:""; width:5px; height:5px; border-radius:50%; background:var(--sn-accent); }
.sn-state--waiting_expert::before{ background:#C9A227; }
.sn-state--closed::before{ background:#B6B6C2; }
.sn-state--closed{ color:var(--sn-ink-3); }

.sn-thread{ display:flex; flex-direction:column; min-width:0; min-height:0; background:var(--sn-canvas); }
.sn-thead{ display:flex; align-items:flex-start; gap:10px; padding:12px 18px 10px; background:var(--sn-surface); border-bottom:1px solid var(--sn-line-soft); }
.sn-thead__main{ flex:1; min-width:0; }
.sn-thead__task{ margin:0; font-size:16px; font-weight:640; letter-spacing:-.012em; line-height:1.3; overflow-wrap:anywhere; }
.sn-thead__task:focus{ outline:none; }
.sn-thead__ref{ margin:1px 0 0; font-size:12px; color:var(--sn-ink-3); }
.sn-thead__who{ display:flex; align-items:center; gap:6px; margin:6px 0 0; font-size:12.5px; color:var(--sn-ink-2); }
.sn-thead__role{ font-size:11px; font-weight:600; color:var(--sn-accent); background:var(--sn-accent-soft); padding:1px 6px; border-radius:4px; }

.sn-ribbon{ padding:10px 18px 10px; background:var(--sn-surface); border-bottom:1px solid var(--sn-line); }
.sn-ribbon__rail{ display:flex; align-items:center; gap:0; }
.sn-ribbon__seg{ flex:1; height:1.5px; background:var(--sn-line); }
.sn-ribbon__seg.is-done{ background:var(--sn-accent); opacity:.4; }
.sn-ribbon__node{ width:6px; height:6px; border-radius:50%; background:var(--sn-line); }
.sn-ribbon__node.is-done{ background:var(--sn-accent); opacity:.45; }
.sn-ribbon__node.is-current{ width:8px; height:8px; background:var(--sn-accent); box-shadow:0 0 0 3px var(--sn-accent-soft); }
.sn-ribbon__labels{ display:flex; margin-top:6px; }
.sn-ribbon__step{ flex:1; display:flex; flex-direction:column; font-size:12px; color:var(--sn-ink-3); }
.sn-ribbon__step em{ font-style:normal; font-size:10px; letter-spacing:.04em; text-transform:uppercase; color:#9A9AA8; margin-bottom:1px; }
.sn-ribbon__step.is-current{ color:var(--sn-accent); font-weight:640; align-items:center; text-align:center; }
.sn-ribbon__step.is-next{ align-items:flex-end; text-align:right; }
.sn-ribbon.is-compact{ padding:8px 14px 8px; }
.sn-ribbon.is-compact .sn-ribbon__labels{ font-size:11px; }

.sn-history{ flex:1; min-height:0; overflow-y:auto; overscroll-behavior:contain; padding:12px 18px 16px; scroll-behavior:smooth; }
.sn-datesep{ text-align:center; font-size:11px; color:var(--sn-ink-3); margin:14px 0 10px; }
.sn-newmark{ display:flex; align-items:center; gap:10px; margin:14px 0 10px; }
.sn-newmark::before,.sn-newmark::after{ content:""; flex:1; height:1px; background:var(--sn-accent); opacity:.28; }
.sn-newmark span{ font-size:10px; font-weight:700; letter-spacing:.05em; color:var(--sn-accent); }
.sn-event{ display:flex; align-items:center; gap:10px; margin:14px 0; }
.sn-event__rule{ flex:1; height:1px; background:var(--sn-line); }
.sn-event__body{ display:flex; align-items:baseline; gap:6px; flex-wrap:wrap; justify-content:center; max-width:70%; text-align:center; }
.sn-event__title{ font-size:11.5px; font-weight:650; color:var(--sn-ink-2); }
.sn-event__at{ font-size:11px; color:var(--sn-ink-3); }
.sn-event__action{ font-size:11.5px; font-weight:650; color:var(--sn-accent); text-decoration:none; }

.sn-msg{ display:flex; flex-direction:column; margin-top:12px; animation:sn-enter .2s ease both; }
.sn-msg.is-grouped{ margin-top:3px; }
@keyframes sn-enter{ from{ opacity:0; transform:translateY(4px); } to{ opacity:1; transform:none; } }
.sn-msg--student{ align-items:flex-end; }
.sn-msg__id{ display:flex; align-items:center; gap:6px; margin-bottom:4px; }
.sn-msg__name{ font-size:12px; font-weight:650; }
.sn-msg__role{ font-size:11px; color:var(--sn-ink-3); }
.sn-msg__bubble{ position:relative; max-width:55%; padding:8px 11px 6px; border-radius:10px; background:var(--sn-expert); border:1px solid transparent; }
.sn-msg--expert .sn-msg__bubble,.sn-msg--system_person .sn-msg__bubble{ border-top-left-radius:4px; }
.sn-msg--system_person .sn-msg__bubble{ background:var(--sn-surface); border-color:var(--sn-line); }
.sn-msg--student .sn-msg__bubble{ background:var(--sn-accent-soft); border-top-right-radius:4px; }
.sn-msg.is-grouped .sn-msg__bubble{ border-radius:10px; }
.sn-msg.is-pending .sn-msg__bubble{ opacity:.6; }
.sn-msg.is-failed .sn-msg__bubble{ border-color:#E0B4B4; }
.sn-msg__body{ margin:0; font-size:14px; line-height:1.5; white-space:pre-wrap; overflow-wrap:anywhere; }
.sn-msg__time{ display:block; margin-top:3px; font-size:10px; color:var(--sn-ink-3); text-align:right; opacity:.7; }
.sn-msg__files{ margin-top:6px; display:flex; flex-direction:column; gap:5px; }
.sn-msg__failbar{ display:flex; align-items:center; gap:8px; margin-top:3px; font-size:11px; color:#A33; }
.sn-msg__failbar button{ font-weight:650; text-decoration:underline; }
.sn-attach{ display:flex; align-items:center; gap:8px; padding:6px 9px; text-decoration:none; background:var(--sn-surface); border:1px solid var(--sn-line); border-radius:7px; color:inherit; transition:border-color .12s ease; }
.sn-attach:hover{ border-color:var(--sn-accent); }
.sn-attach__icon{ color:var(--sn-ink-3); flex:none; }
.sn-attach__body{ display:flex; flex-direction:column; min-width:0; flex:1; }
.sn-attach__name{ font-size:12px; font-weight:600; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; }
.sn-attach__meta{ font-size:10.5px; color:var(--sn-ink-3); }
.sn-attach__cta{ font-size:11.5px; font-weight:650; color:var(--sn-accent); flex:none; }

.sn-composer{ border-top:1px solid var(--sn-line); background:var(--sn-surface); padding:10px 18px 12px; }
.sn-upload{ display:flex; align-items:center; gap:8px; margin-bottom:6px; padding:6px 9px; background:var(--sn-canvas); border-left:2px solid var(--sn-accent); border-radius:0 6px 6px 0; font-size:12px; color:var(--sn-ink-2); }
.sn-upload__name{ flex:1; min-width:0; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; }
.sn-upload__meta{ color:var(--sn-ink-3); flex:none; }
.sn-flag{ margin-bottom:8px; padding:8px 10px; border-radius:8px; background:var(--sn-warn-bg); border:1px solid #F0E4CB; animation:sn-enter .2s ease both; }
.sn-flag__h{ margin:0; font-size:12.5px; font-weight:700; color:var(--sn-warn); }
.sn-flag__b{ margin:2px 0 8px; font-size:12px; color:var(--sn-ink-2); }
.sn-flag__acts{ display:flex; gap:6px; }
.sn-composer__bar{ display:flex; align-items:flex-end; gap:6px; padding:7px 7px 7px 5px; border:1px solid var(--sn-line); border-radius:10px; background:var(--sn-surface); transition:border-color .15s ease, box-shadow .15s ease; }
.sn-composer__bar:focus-within{ border-color:var(--sn-accent); box-shadow:0 0 0 3px var(--sn-accent-soft); }
.sn-composer.is-flagged .sn-composer__bar{ border-color:#D9B770; box-shadow:0 0 0 3px #F7EDD8; }
.sn-composer__input{ flex:1; min-width:0; min-height:34px; max-height:180px; resize:none; border:0; outline:none; background:none; font:inherit; font-size:14px; line-height:1.5; padding:6px 2px; color:var(--sn-ink); }
.sn-send{ display:inline-flex; align-items:center; justify-content:center; width:34px; height:34px; border-radius:8px; background:var(--sn-accent); color:#fff; flex:none; transition:opacity .15s ease, transform .12s ease; }
.sn-send:disabled{ opacity:.3; cursor:not-allowed; }
.sn-send:not(:disabled):active{ transform:scale(.94); }
.sn-send-spinner{ width:14px; height:14px; border:2px solid rgba(255,255,255,.3); border-top-color:#fff; border-radius:50%; animation:sn-spin .6s linear infinite; }
@keyframes sn-spin{ to{ transform:rotate(360deg); } }
.sn-composer__hint{ margin:5px 2px 0; font-size:10.5px; color:var(--sn-ink-3); }
.sn-closed{ border-top:1px solid var(--sn-line); background:var(--sn-surface); padding:16px 18px; }
.sn-closed__h{ margin:0; font-size:13px; font-weight:700; }
.sn-closed__b{ margin:2px 0 6px; font-size:12.5px; color:var(--sn-ink-3); }

.sn-empty{ padding:32px 20px; text-align:center; }
.sn-empty__h{ margin:0; font-size:14px; font-weight:650; }
.sn-empty__b{ margin:4px 0 8px; font-size:12.5px; color:var(--sn-ink-3); line-height:1.5; }
.sn-blank{ margin:auto; text-align:center; padding:36px; }
.sn-blank__h{ margin:0; font-size:15px; font-weight:650; }
.sn-blank__b{ margin:3px 0 0; font-size:13px; color:var(--sn-ink-3); }

.sn-ctx{ display:flex; flex-direction:column; min-height:0; overflow-y:auto; border-left:1px solid var(--sn-line); background:var(--sn-surface); padding:14px 16px 20px; }
.sn-ctx__label{ margin:0 0 8px; font-size:10px; font-weight:700; letter-spacing:.06em; text-transform:uppercase; color:#9A9AA8; }
.sn-ctx__task{ margin:0; font-size:14px; font-weight:650; line-height:1.35; overflow-wrap:anywhere; }
.sn-ctx__ref{ margin:2px 0 12px; font-size:11.5px; color:var(--sn-ink-3); }
.sn-ctx__now{ display:flex; gap:16px; padding:10px 0; border-top:1px solid var(--sn-line-soft); border-bottom:1px solid var(--sn-line-soft); font-size:12.5px; font-weight:600; }
.sn-ctx__now em{ display:block; font-style:normal; font-size:10px; font-weight:700; letter-spacing:.05em; text-transform:uppercase; color:#9A9AA8; margin-bottom:1px; }
.sn-ctx__now div:first-child{ color:var(--sn-accent); }
.sn-ctx__needs{ margin-top:12px; padding:10px 11px; border-radius:8px; background:var(--sn-warn-bg); border:1px solid #F0E4CB; }
.sn-ctx__needs-h{ margin:0; font-size:12px; font-weight:700; color:var(--sn-warn); }
.sn-ctx__needs-b{ margin:3px 0 6px; font-size:12px; color:var(--sn-ink-2); line-height:1.4; }
.sn-ctx__kv{ margin:14px 0 0; }
.sn-ctx__kv div{ display:flex; justify-content:space-between; gap:10px; padding:6px 0; border-bottom:1px solid var(--sn-line-soft); font-size:12px; }
.sn-ctx__kv dt{ color:var(--sn-ink-3); }
.sn-ctx__kv dd{ margin:0; font-weight:600; text-align:right; overflow-wrap:anywhere; }
.sn-ctx__files{ margin-top:12px; }
.sn-ctx__files-h{ margin:0 0 6px; font-size:10px; font-weight:700; letter-spacing:.06em; text-transform:uppercase; color:#9A9AA8; }
.sn-ctx__files-list{ list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:3px; }
.sn-ctx__file{ display:flex; align-items:center; gap:6px; padding:5px 7px; text-decoration:none; color:var(--sn-ink); border-radius:5px; transition:background .12s ease; font-size:12px; }
.sn-ctx__file:hover{ background:var(--sn-canvas); }
.sn-ctx__file-name{ flex:1; min-width:0; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; font-weight:500; }
.sn-ctx__file-meta{ color:var(--sn-ink-3); font-size:10.5px; flex:none; }
.sn-ctx__expert{ display:flex; align-items:center; gap:10px; margin-top:14px; }
.sn-ctx__expert-name{ margin:0; font-size:13px; font-weight:650; }
.sn-ctx__expert-role{ margin:1px 0 0; font-size:11px; color:var(--sn-ink-3); }
.sn-ctx__links{ display:flex; flex-direction:column; gap:6px; margin-top:16px; padding-top:12px; border-top:1px solid var(--sn-line-soft); }
.sn-ctx__links a{ font-size:12.5px; font-weight:600; color:var(--sn-accent); text-decoration:none; }
.sn-ctx__links a:hover{ text-decoration:underline; }

.sn-scrim{ position:fixed; inset:0; background:rgba(20,20,28,.32); opacity:0; pointer-events:none; transition:opacity .22s ease; z-index:40; }
.sn-scrim.is-open{ opacity:1; pointer-events:auto; }
.sn-drawer{ position:fixed; top:0; right:0; bottom:0; width:min(340px,86vw); z-index:41; display:flex; flex-direction:column; background:var(--sn-surface); border-left:1px solid var(--sn-line); transform:translateX(100%); transition:transform .26s cubic-bezier(.2,.7,.3,1); }
.sn-drawer.is-open{ transform:none; }
.sn-drawer__head{ display:flex; align-items:center; justify-content:space-between; padding:12px 14px 6px; }
.sn-drawer__head .sn-ctx__label{ margin:0; }
.sn-drawer__scroll{ flex:1; overflow-y:auto; padding:0 14px 20px; }

.sn-nav-skeleton{ padding:8px 16px; }
.sn-nav-skeleton-row{ display:flex; flex-direction:column; gap:6px; padding:12px 0; border-bottom:1px solid var(--sn-line-soft); }
.sn-nav-skeleton-row span{ display:block; height:10px; background:var(--sn-line); border-radius:4px; animation:sn-pulse 1.5s ease-in-out infinite; }
.sn-nav-skeleton-row span:first-child{ width:70%; }
.sn-nav-skeleton-row span:nth-child(2){ width:50%; }
.sn-nav-skeleton-row span:last-child{ width:40%; }
.sn-thread-skeleton{ display:flex; flex-direction:column; gap:12px; padding:16px 18px; }
.sn-msg-skeleton{ display:flex; flex-direction:column; gap:4px; max-width:55%; }
.sn-msg-skeleton.is-right{ align-self:flex-end; }
.sn-msg-skeleton span{ display:block; height:12px; background:var(--sn-line); border-radius:4px; animation:sn-pulse 1.5s ease-in-out infinite; }
.sn-msg-skeleton span:first-child{ width:90%; }
.sn-msg-skeleton span:last-child{ width:60%; }
@keyframes sn-pulse{ 0%,100%{ opacity:.4; } 50%{ opacity:.8; } }

@media (max-width:1379px) and (min-width:768px){ .sn-msgs{ grid-template-columns:288px minmax(0,1fr); } }
@media (max-width:767px){
  .sn-msgs{ grid-template-columns:1fr; position:relative; }
  .sn-nav,.sn-thread{ grid-column:1; grid-row:1; }
  .sn-nav{ border-right:0; }
  .sn-msgs[data-mobile-view="list"] .sn-thread{ display:none; }
  .sn-msgs[data-mobile-view="thread"] .sn-nav{ display:none; }
  .sn-msgs[data-mobile-view="thread"] .sn-thread{ animation:sn-slide-in .26s cubic-bezier(.2,.7,.3,1) both; }
  @keyframes sn-slide-in{ from{ opacity:.4; transform:translateX(12px); } to{ opacity:1; transform:none; } }
  .sn-row{ padding:12px 14px; min-height:72px; }
  .sn-thead{ padding:8px 12px; align-items:center; }
  .sn-thead__task{ font-size:15px; -webkit-line-clamp:1; display:-webkit-box; -webkit-box-orient:vertical; overflow:hidden; }
  .sn-thead__ref,.sn-thead__who{ display:none; }
  .sn-history{ padding:10px 12px 14px; }
  .sn-msg__bubble{ max-width:75%; }
  .sn-composer{ padding:8px 12px calc(10px + env(safe-area-inset-bottom)); position:sticky; bottom:0; }
  .sn-drawer{ top:auto; left:0; width:100%; height:85vh; border-left:0; border-top-left-radius:14px; border-top-right-radius:14px; transform:translateY(100%); }
  .sn-drawer.is-open{ transform:none; }
}
@media (prefers-reduced-motion:reduce){ .sn-msgs *{ animation-duration:.01ms !important; transition-duration:.01ms !important; } }
`;
