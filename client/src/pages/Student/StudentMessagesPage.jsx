/* =====================================================================
   SolveNest — Student Messages
   /student/messages  ·  "The SolveNest Collaboration Room"

   Single-file React component. All CSS + motion live in the <style>
   block below, scoped under .sn-msgs so nothing leaks into the shell.

   INTEGRATION NOTES (read before wiring):
   - Everything in MOCK below is placeholder shape only. Replace with
     your real conversation/message/task API. Field names are chosen to
     be renamed in one place.
   - Capability flags live in `caps`. Every optional feature (typing,
     read receipts, edit, delete, reactions, presence, message search,
     archive) is OFF by default and the UI simply does not render it.
     Do not flip a flag on unless the backend genuinely supports it.
   - Contact-sharing moderation is backend-authoritative. The local
     `screenMessage()` is a *hint* only; it never blocks alone.
   - Height: uses --sn-shell-offset (top bar + shell padding). Set it
     from your shell instead of guessing. No blind 100vh.
   ===================================================================== */

import React, {
  useState,
  useRef,
  useEffect,
  useMemo,
  useCallback,
  useLayoutEffect,
} from "react";

/* ---------------------------------------------------------------------
   CAPABILITIES — mirror your backend. false = feature is not rendered.
--------------------------------------------------------------------- */
const caps = {
  realtime: true,
  typingIndicator: false,
  presence: false,
  readReceipts: true,
  messageEdit: false,
  messageDelete: false,
  reactions: false,
  messageSearch: false,
  conversationSearch: true,
  archive: false,
  reply: false,
  moderation: true,
  pagination: true,
};

/* ---------------------------------------------------------------------
   Real-time helpers
--------------------------------------------------------------------- */
function timeAgo(date) {
  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin} min`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} h`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay === 1) return "Yesterday";
  if (diffDay < 7) return `${diffDay} days`;
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function formatTime(date) {
  return date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function formatTimestamp(date) {
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();
  const time = formatTime(date);
  if (isToday) return time;
  if (isYesterday) return `Yesterday · ${time}`;
  return `${date.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} · ${time}`;
}

function formatShortTimestamp(date) {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "now";
  if (diffMin < 60) return `${diffMin} min`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} h`;
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

/* ---------------------------------------------------------------------
   MOCK DATA — replace wholesale
--------------------------------------------------------------------- */
const STAGES = ["Requested", "Assigned", "In Progress", "Quality Review", "Delivered"];

const now = Date.now();
const min = (m) => new Date(now - m * 60000);
const hr = (h) => new Date(now - h * 3600000);
const day = (d) => new Date(now - d * 86400000);

const MOCK = {
  conversations: [
    {
      id: "c_2042",
      taskId: "t_2042",
      taskTitle: "Research Report",
      taskRef: "SN-2042",
      subject: "Information Systems",
      stageIndex: 2,
      state: "active",
      needsStudent: true,
      needsReason: "SolveNest needs clarification about the citation requirement.",
      unread: 2,
      participant: { name: "Amara P.", role: "Verified Expert", initials: "AP", avatar: null, expertise: "Information Systems" },
      lastAt: min(12),
      lastPreview: "Can you confirm whether the rubric requires APA 7 or Harvard?",
      lastIsSystem: false,
      deadline: "24 Sep, 23:59",
      plan: "Standard · 2 revisions",
      fileCount: 3,
      files: [
        { id: "f1", name: "rubric-v2.pdf", type: "PDF", size: "1.4 MB", uploadedBy: "You", uploadedAt: day(1) },
        { id: "f2", name: "research-brief.docx", type: "Word", size: "890 KB", uploadedBy: "You", uploadedAt: day(2) },
        { id: "f3", name: "outline-draft.pdf", type: "PDF", size: "2.1 MB", uploadedBy: "Amara P.", uploadedAt: hr(3) },
      ],
    },
    {
      id: "c_2039",
      taskId: "t_2039",
      taskTitle: "Database Normalisation Assignment",
      taskRef: "SN-2039",
      subject: "Data Management",
      stageIndex: 3,
      state: "waiting_expert",
      needsStudent: false,
      unread: 0,
      participant: { name: "Nuwan D.", role: "Verified Expert", initials: "ND", avatar: null, expertise: "Databases" },
      lastAt: hr(2),
      lastPreview: "Quality review started",
      lastIsSystem: true,
      deadline: "21 Sep, 17:00",
      plan: "Standard · 1 revision",
      fileCount: 2,
      files: [
        { id: "f4", name: "assignment-spec.pdf", type: "PDF", size: "1.2 MB", uploadedBy: "You", uploadedAt: day(3) },
        { id: "f5", name: "sample-dataset.xlsx", type: "Excel", size: "340 KB", uploadedBy: "Nuwan D.", uploadedAt: day(1) },
      ],
    },
    {
      id: "c_1988",
      taskId: "t_1988",
      taskTitle: "Statistics Problem Set — Regression & Residual Analysis Coursework",
      taskRef: "SN-1988",
      subject: "Applied Statistics",
      stageIndex: 4,
      state: "closed",
      needsStudent: false,
      unread: 0,
      participant: { name: "SolveNest Support", role: "SolveNest", initials: "SN", avatar: null, expertise: null },
      lastAt: day(7),
      lastPreview: "Delivery available",
      lastIsSystem: true,
      deadline: "12 Sep, 09:00",
      plan: "Standard",
      fileCount: 5,
      files: [
        { id: "f6", name: "final-delivery.pdf", type: "PDF", size: "4.8 MB", uploadedBy: "SolveNest", uploadedAt: day(7) },
        { id: "f7", name: "appendix-data.csv", type: "CSV", size: "120 KB", uploadedBy: "SolveNest", uploadedAt: day(7) },
        { id: "f8", name: "rubric-markscheme.pdf", type: "PDF", size: "980 KB", uploadedBy: "You", uploadedAt: day(10) },
      ],
    },
  ],

  messages: {
    c_2042: [
      { id: "m1", kind: "date", label: "Yesterday" },
      { id: "m2", kind: "event", event: "EXPERT_ASSIGNED", title: "Expert assigned", at: day(1) },
      {
        id: "m3", kind: "message", from: "expert", author: "Amara P.", role: "Verified Expert", initials: "AP",
        at: new Date(now - 86400000 + 3600000 * 9 + 60000 * 20),
        body: "Hi Don — I've read through the brief. I'll start with the literature scan and share an outline before I draft anything.",
      },
      {
        id: "m4", kind: "message", from: "expert", author: "Amara P.", role: "Verified Expert", initials: "AP",
        at: new Date(now - 86400000 + 3600000 * 9 + 60000 * 21),
        body: "One thing I want to get right up front: the referencing style.",
      },
      {
        id: "m5", kind: "message", from: "student", author: "You", at: new Date(now - 86400000 + 3600000 * 9 + 60000 * 44), status: "read",
        body: "Sounds good. I've attached the rubric the lecturer gave us.",
        attachments: [{ id: "f1", name: "rubric-v2.pdf", type: "PDF", size: "1.4 MB" }],
      },
      { id: "m6", kind: "event", event: "FILE_ADDED", title: "File added to task", at: new Date(now - 86400000 + 3600000 * 9 + 60000 * 44) },
      { id: "m7", kind: "date", label: "Today" },
      {
        id: "m8", kind: "message", from: "expert", author: "Amara P.", role: "Verified Expert", initials: "AP",
        at: new Date(now - 3600000 * 2 + 60000 * 2),
        body: "Evidence review is done. Twelve sources, four of them primary. I'll fold them into the argument section next.",
      },
      { id: "m9", kind: "event", event: "PROGRESS_UPDATED", title: "Progress updated — evidence review completed", at: new Date(now - 3600000 * 2 + 60000 * 6) },
      { id: "m10", kind: "unread" },
      {
        id: "m11", kind: "message", from: "expert", author: "Amara P.", role: "Verified Expert", initials: "AP",
        at: new Date(now - 3600000 * 1 + 60000 * 22),
        body: "Can you confirm whether the rubric requires APA 7 or Harvard? Page 2 says APA, the marking grid says Harvard.",
        needsResponse: true,
      },
      {
        id: "m12", kind: "message", from: "system_person", author: "SolveNest", role: "Support", initials: "SN",
        at: new Date(now - 3600000 * 1 + 60000 * 19),
        body: "We've flagged this to your lecturer's brief as an open clarification. Answer here and the Expert will see it straight away.",
      },
      { id: "m13", kind: "event", event: "QUALITY_REVIEW", title: "Quality review started", at: new Date(now - 3600000 * 1 + 60000 * 18), action: { label: "View plan", href: "#" } },
    ],
    c_2039: [
      { id: "n1", kind: "date", label: "Today" },
      { id: "n2", kind: "message", from: "expert", author: "Nuwan D.", role: "Verified Expert", initials: "ND", at: new Date(now - 3600000 * 2 + 60000 * 5), body: "Draft is with internal checking now. Nothing needed from you at this stage." },
      { id: "n3", kind: "event", event: "QUALITY_REVIEW", title: "Quality review started", at: new Date(now - 3600000 * 2 + 60000 * 4) },
    ],
    c_1988: [
      { id: "s1", kind: "date", label: "12 Sep" },
      { id: "s2", kind: "message", from: "system_person", author: "SolveNest", role: "Support", initials: "SN", at: new Date(day(7).getTime() + 3600000 * 8 + 60000 * 58), body: "Your completed work is ready in Files & Deliveries." },
      { id: "s3", kind: "event", event: "DELIVERY", title: "Delivery available", at: new Date(day(7).getTime() + 3600000 * 9), action: { label: "Open delivery", href: "#" } },
    ],
  },
};

/* ---------------------------------------------------------------------
   Auto-close: conversations with no activity for 2 days get closed.
   This is a hint only; the backend remains the authority.
--------------------------------------------------------------------- */
function autoCloseConversations(conversations) {
  const TWO_DAYS = 2 * 86400000;
  const nowTs = Date.now();
  return conversations.map((c) => {
    if (c.state === "closed") return c;
    const lastActivity = c.lastAt instanceof Date ? c.lastAt.getTime() : new Date(c.lastAt).getTime();
    if (nowTs - lastActivity > TWO_DAYS) {
      return { ...c, state: "closed", needsStudent: false };
    }
    return c;
  });
}

/* ---------------------------------------------------------------------
   Local moderation HINT only. Backend remains the authority.
   Deliberately conservative: bare numbers, equations, page refs, dates,
   citations and code must NOT trip this.
--------------------------------------------------------------------- */
function screenMessage(text) {
  if (!caps.moderation || !text) return null;
  const hits = [];
  const email = /\b[\w.+-]+@[\w-]+\.[a-z]{2,}\b/gi;
  const phone = /(?:\+?\d[\d\s-]{8,14}\d)/g;
  const social = /\b(?:whatsapp|telegram|viber|insta(?:gram)?|snapchat|wechat|imo)\b/gi;
  const offPay = /\b(?:bank transfer|paypal|直接|outside solvenest|off ?platform|pay me directly)\b/gi;

  for (const re of [email, social, offPay]) {
    let m;
    while ((m = re.exec(text))) hits.push({ start: m.index, end: m.index + m[0].length });
  }
  let m;
  while ((m = phone.exec(text))) {
    const raw = m[0].replace(/\D/g, "");
    if (raw.length >= 9 && raw.length <= 13) hits.push({ start: m.index, end: m.index + m[0].length });
  }
  return hits.length ? hits.sort((a, b) => a.start - b.start) : null;
}

/* ---------------------------------------------------------------------
   Small helpers
--------------------------------------------------------------------- */
const useMediaQuery = (query) => {
  const [match, setMatch] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia(query).matches : false
  );
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = (e) => setMatch(e.matches);
    mq.addEventListener("change", on);
    setMatch(mq.matches);
    return () => mq.removeEventListener("change", on);
  }, [query]);
  return match;
};

const Icon = ({ name, ...rest }) => {
  const p = { width: 16, height: 16, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true, ...rest };
  const paths = {
    search: <><circle cx="7" cy="7" r="4.5" /><path d="M10.5 10.5 14 14" /></>,
    send: <><path d="M8 13V3" /><path d="M4 6.5 8 2.8l4 3.7" /></>,
    clip: <path d="M10.8 5.2 6 10a1.7 1.7 0 0 0 2.4 2.4l5-5a3.2 3.2 0 0 0-4.5-4.5l-5.2 5.2a4.7 4.7 0 0 0 6.7 6.7" />,
    back: <><path d="M9.5 3 4.5 8l5 5" /></>,
    info: <><circle cx="8" cy="8" r="6" /><path d="M8 7.2v4M8 5.1v.1" /></>,
    close: <><path d="M4 4l8 8M12 4l-8 8" /></>,
    down: <><path d="M8 3v10" /><path d="M4 9.5 8 13.2l4-3.7" /></>,
    file: <><path d="M4 2h5l3 3v9H4z" /><path d="M9 2v3h3" /></>,
    retry: <><path d="M13 8a5 5 0 1 1-1.6-3.6" /><path d="M13 2.5V5h-2.5" /></>,
    dot: <circle cx="8" cy="8" r="3" fill="currentColor" stroke="none" />,
    folder: <><path d="M2 4v9a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1H8L6.5 3H3a1 1 0 0 0-1 1z" /></>,
    open: <><path d="M14 10v3a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h3" /><path d="M9 2h5v5" /><path d="M14 2L7 9" /></>,
  };
  return <svg {...p}>{paths[name]}</svg>;
};

/* ---------------------------------------------------------------------
   Task state ribbon — previous / current / next only
--------------------------------------------------------------------- */
function TaskConversationRibbon({ stageIndex, compact = false, advanced }) {
  const prev = stageIndex > 0 ? STAGES[stageIndex - 1] : null;
  const curr = STAGES[stageIndex];
  const next = stageIndex < STAGES.length - 1 ? STAGES[stageIndex + 1] : null;

  return (
    <div className={"sn-ribbon" + (compact ? " is-compact" : "") + (advanced ? " is-advanced" : "")} aria-label={`Task stage: ${curr}`}>
      <div className="sn-ribbon__rail" aria-hidden="true">
        <span className="sn-ribbon__seg is-done" />
        <span className="sn-ribbon__node is-done" />
        <span className="sn-ribbon__seg is-done" />
        <span className="sn-ribbon__node is-current" />
        <span className="sn-ribbon__seg" />
        <span className="sn-ribbon__node" />
      </div>
      <div className="sn-ribbon__labels">
        <span className="sn-ribbon__step">
          <em>Previous</em>{prev || "—"}
        </span>
        <span className="sn-ribbon__step is-current">
          <em>Now</em>{curr}
        </span>
        <span className="sn-ribbon__step is-next">
          <em>Next</em>{next || "Complete"}
        </span>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------
   Conversation navigator row
--------------------------------------------------------------------- */
function ConversationRow({ c, selected, onSelect }) {
  return (
    <li>
      <button
        type="button"
        className={"sn-row" + (selected ? " is-selected" : "") + (c.unread ? " is-unread" : "")}
        onClick={() => onSelect(c.id)}
        aria-current={selected ? "true" : undefined}
      >
        <span className="sn-row__title">{c.taskTitle}</span>
        <span className="sn-row__meta">
          <span className={"sn-state sn-state--" + c.state}>{STAGES[c.stageIndex]}</span>
          <span className="sn-row__who">{c.participant.name} · {c.participant.role}</span>
        </span>
        <span className="sn-row__preview">
          {c.lastIsSystem ? <span className="sn-row__sys">{c.lastPreview}</span> : c.lastPreview}
        </span>
        <span className="sn-row__time">{formatShortTimestamp(c.lastAt instanceof Date ? c.lastAt : new Date(c.lastAt))}</span>
        {c.unread > 0 && <span className="sn-row__unread" aria-label={`${c.unread} unread messages`}>{c.unread}</span>}
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
  const time = m.at instanceof Date ? m.at : new Date(m.at);
  return (
    <div className="sn-event" role="note">
      <span className="sn-event__rule" aria-hidden="true" />
      <span className="sn-event__body">
        <span className="sn-event__title">{m.title}</span>
        <span className="sn-event__at">{formatTimestamp(time)}</span>
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
  const mine = m.from === "student";
  const time = m.at instanceof Date ? m.at : new Date(m.at);
  return (
    <article className={"sn-msg sn-msg--" + m.from + (grouped ? " is-grouped" : "") + (m.pending ? " is-pending" : "") + (m.failed ? " is-failed" : "")}>
      {!grouped && !mine && (
        <header className="sn-msg__id">
          <span className="sn-avatar" aria-hidden="true">{m.initials}</span>
          <span className="sn-msg__name">{m.author}</span>
          <span className="sn-msg__role">{m.role}</span>
        </header>
      )}
      <div className="sn-msg__bubble">
        <p className="sn-msg__body">{m.body}</p>
        {m.attachments?.length > 0 && (
          <div className="sn-msg__files">
            {m.attachments.map((a) => <Attachment key={a.id} a={a} />)}
          </div>
        )}
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
   Task context — used by the rail, the drawer and the mobile sheet
--------------------------------------------------------------------- */
function TaskContextBody({ c, onRespond }) {
  const next = c.stageIndex < STAGES.length - 1 ? STAGES[c.stageIndex + 1] : "Complete";
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
        <div><dt>Deadline</dt><dd>{c.deadline}</dd></div>
        <div><dt>Plan</dt><dd>{c.plan}</dd></div>
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
          <p className="sn-ctx__expert-role">{c.participant.role}{c.participant.expertise ? ` · ${c.participant.expertise}` : ""}</p>
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
function Composer({ conversation, replyTo, onClearReply, onSend, inputRef }) {
  const [value, setValue] = useState("");
  const [file, setFile] = useState(null);
  const [flag, setFlag] = useState(null);
  const taRef = useRef(null);
  const fileRef = useRef(null);
  const readOnly = conversation.state === "closed";

  useLayoutEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 200) + "px";
  }, [value]);

  const placeholder =
    conversation.participant.role === "Verified Expert"
      ? `Message ${conversation.participant.name.split(" ")[0]}…`
      : "Reply to SolveNest…";

  const submit = () => {
    if (readOnly) return;
    const text = value.trim();
    if (!text && !file) return;
    const hits = screenMessage(text);
    if (hits) { setFlag(hits); return; }
    onSend({ text, file });
    setValue(""); setFile(null); setFlag(null); onClearReply();
  };

  const onKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); }
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
    <div className={"sn-composer" + (flag ? " is-flagged" : "")}>
      {replyTo && (
        <div className="sn-quote">
          <span className="sn-quote__who">{replyTo.author}</span>
          <span className="sn-quote__text">{replyTo.body}</span>
          <button type="button" className="sn-iconbtn" onClick={onClearReply} aria-label="Cancel reply"><Icon name="close" /></button>
        </div>
      )}

      {file && (
        <div className="sn-upload">
          <Icon name="file" />
          <span className="sn-upload__name">{file.name}</span>
          <span className="sn-upload__meta">{(file.size / 1048576).toFixed(1)} MB</span>
          <button type="button" className="sn-iconbtn" onClick={() => setFile(null)} aria-label="Remove attachment"><Icon name="close" /></button>
        </div>
      )}

      {flag && (
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
        <button type="submit" className="sn-send" aria-label="Send message" disabled={!value.trim() && !file}>
          <Icon name="send" width={18} height={18} />
        </button>
      </form>
      <p className="sn-composer__hint">PDF, Word, images or ZIP · Enter sends, Shift + Enter adds a line</p>
    </div>
  );
}

/* =====================================================================
   PAGE
===================================================================== */
export function StudentMessagesPage() {
  const [conversations, setConversations] = useState(() => autoCloseConversations(MOCK.conversations));
  const [threads, setThreads] = useState(MOCK.messages);
  const [selectedId, setSelectedId] = useState("c_2042");
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [mobileView, setMobileView] = useState("list"); // list | thread
  const [replyTo, setReplyTo] = useState(null);
  const [atBottom, setAtBottom] = useState(true);
  const [newBelow, setNewBelow] = useState(0);
  const [offline, setOffline] = useState(false);

  const isMobile = useMediaQuery("(max-width: 767px)");
  const isWide = useMediaQuery("(min-width: 1380px)");

  const scrollRef = useRef(null);
  const composerRef = useRef(null);
  const threadHeadingRef = useRef(null);

  const selected = conversations.find((c) => c.id === selectedId) || null;
  const messages = selected ? threads[selected.id] || [] : [];

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return conversations.filter((c) => {
      if (filter === "unread" && !c.unread) return false;
      if (filter === "needs" && !c.needsStudent) return false;
      if (!q) return true;
      return (
        c.taskTitle.toLowerCase().includes(q) ||
        c.taskRef.toLowerCase().includes(q) ||
        c.participant.name.toLowerCase().includes(q)
      );
    });
  }, [conversations, filter, query]);

  const unreadConvos = conversations.filter((c) => c.unread > 0).length;

  /* scroll handling ------------------------------------------------- */
  const scrollToBottom = useCallback((behavior = "auto") => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior });
    setNewBelow(0);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const unread = el.querySelector("[data-unread-marker]");
    if (unread) unread.scrollIntoView({ block: "center" });
    else scrollToBottom();
  }, [selectedId, scrollToBottom]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    setAtBottom(near);
    if (near) setNewBelow(0);
  };

  /* select ----------------------------------------------------------- */
  const selectConversation = (id) => {
    setSelectedId(id);
    setReplyTo(null);
    if (isMobile) setMobileView("thread");
    setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, unread: 0 } : c)));
  };

  useEffect(() => {
    if (isMobile && mobileView === "thread") threadHeadingRef.current?.focus();
  }, [isMobile, mobileView]);

  /* send ------------------------------------------------------------- */
  const send = ({ text, file }) => {
    const id = "tmp_" + Date.now();
    const optimistic = {
      id, kind: "message", from: "student", author: "You",
      at: new Date(),
      body: text, pending: true,
      attachments: file ? [{ id: id + "_f", name: file.name, type: (file.name.split(".").pop() || "").toUpperCase(), size: (file.size / 1048576).toFixed(1) + " MB" }] : undefined,
    };
    setThreads((t) => ({ ...t, [selectedId]: [...(t[selectedId] || []), optimistic] }));
    setConversations((prev) => prev.map((c) => c.id === selectedId ? { ...c, lastAt: new Date(), lastPreview: text, lastIsSystem: false } : c));
    requestAnimationFrame(() => scrollToBottom("smooth"));
    setTimeout(() => {
      setThreads((t) => ({
        ...t,
        [selectedId]: t[selectedId].map((m) => (m.id === id ? { ...m, pending: false, status: "Sent" } : m)),
      }));
    }, 900);
  };

  /* ------------------------------------------------------------------ */
  const showRail = isWide && selected;

  return (
    <div className="sn-msgs" data-mobile-view={isMobile ? mobileView : undefined}>
      <style>{CSS}</style>

      {/* ============ LEFT — conversation navigator ============ */}
      <nav className="sn-nav" aria-label="Task conversations">
        <div className="sn-nav__head">
          <h1 className="sn-nav__title">Messages</h1>
          {unreadConvos > 0 && (
            <p className="sn-nav__count">{unreadConvos} unread {unreadConvos === 1 ? "conversation" : "conversations"}</p>
          )}
        </div>

        {caps.conversationSearch && (
          <div className="sn-search">
            <Icon name="search" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search conversations…"
              aria-label="Search by task title, reference or participant"
            />
          </div>
        )}

        <div className="sn-filters" role="tablist" aria-label="Filter conversations">
          {[["all", "All"], ["needs", "Needs you"], ["unread", "Unread"]].map(([k, label]) => (
            <button
              key={k}
              role="tab"
              aria-selected={filter === k}
              className={"sn-filter" + (filter === k ? " is-on" : "")}
              onClick={() => setFilter(k)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="sn-nav__scroll">
          {filtered.length === 0 && query && (
            <div className="sn-empty">
              <p className="sn-empty__h">No matching conversations</p>
              <p className="sn-empty__b">Try another task title, reference or participant.</p>
              <button className="sn-link" onClick={() => setQuery("")}>Clear search</button>
            </div>
          )}
          {filtered.length === 0 && !query && (
            <div className="sn-empty">
              <p className="sn-empty__h">No conversations yet</p>
              <p className="sn-empty__b">Task conversations appear here once communication opens for your SolveNest tasks.</p>
              <a className="sn-link" href="#" onClick={(e) => e.preventDefault()}>View my tasks</a>
            </div>
          )}
          <ul className="sn-rows">
            {filtered.map((c) => (
              <ConversationRow key={c.id} c={c} selected={c.id === selectedId} onSelect={selectConversation} />
            ))}
          </ul>
        </div>
      </nav>

      {/* ============ CENTER — conversation workspace ============ */}
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
                <button className="sn-iconbtn" onClick={() => setMobileView("list")} aria-label="Back to conversations">
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
                  <Icon name="info" /> Task details
                </button>
              )}
            </header>

            <TaskConversationRibbon stageIndex={selected.stageIndex} compact={isMobile} />

            {offline && (
              <div className="sn-conn" role="status">
                <span>Connection interrupted.</span> New messages may be delayed.
              </div>
            )}

            <div className="sn-history" ref={scrollRef} onScroll={onScroll}>
              {caps.pagination && (
                <div className="sn-loadmore">
                  <button type="button" className="sn-link">Load earlier messages</button>
                </div>
              )}

              {messages.map((m, i) => {
                if (m.kind === "date") return <div key={m.id} className="sn-datesep">{m.label}</div>;
                if (m.kind === "unread") return (
                  <div key={m.id} className="sn-newmark" data-unread-marker="true"><span>New messages</span></div>
                );
                if (m.kind === "event") return <SystemEvent key={m.id} m={m} />;
                const prev = messages[i - 1];
                const grouped = prev && prev.kind === "message" && prev.from === m.from && prev.author === m.author;
                return <Message key={m.id} m={m} grouped={grouped} />;
              })}
            </div>

            {!atBottom && newBelow > 0 && (
              <button className="sn-jump" onClick={() => scrollToBottom("smooth")}>
                {newBelow} new {newBelow === 1 ? "message" : "messages"} <Icon name="down" width={14} height={14} />
              </button>
            )}

            <Composer
              conversation={selected}
              replyTo={replyTo}
              onClearReply={() => setReplyTo(null)}
              onSend={send}
              inputRef={composerRef}
            />
          </>
        )}
      </main>

      {/* ============ RIGHT — task context rail (wide desktop) ============ */}
      {showRail && (
        <aside className="sn-ctx" aria-label="Task context">
          <p className="sn-ctx__label">Task context</p>
          <TaskContextBody c={selected} onRespond={() => composerRef.current?.focus()} />
        </aside>
      )}

      {/* ============ Drawer / bottom sheet ============ */}
      {!isWide && selected && (
        <>
          <div className={"sn-scrim" + (drawerOpen ? " is-open" : "")} onClick={() => setDrawerOpen(false)} />
          <aside className={"sn-drawer" + (drawerOpen ? " is-open" : "")} aria-label="Task context" aria-hidden={!drawerOpen}>
            <div className="sn-drawer__head">
              <p className="sn-ctx__label">Task context</p>
              <button className="sn-iconbtn" onClick={() => setDrawerOpen(false)} aria-label="Close task details"><Icon name="close" /></button>
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
   STYLES — everything, including motion.
   Tokens fall back to sensible values but defer to your shell's vars.
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
  font-size:15px;
  line-height:1.55;
  background:var(--sn-surface);
  border-top:1px solid var(--sn-line-soft);
  overflow:hidden;
}
@media (min-width:1380px){
  .sn-msgs{ grid-template-columns:330px minmax(0,1fr) 300px; }
}
.sn-msgs *,.sn-msgs *::before,.sn-msgs *::after{ box-sizing:border-box; }
.sn-msgs button{ font:inherit; color:inherit; background:none; border:0; cursor:pointer; }
.sn-msgs :focus-visible{ outline:2px solid var(--sn-accent); outline-offset:2px; border-radius:4px; }

/* ---------- shared bits ---------- */
.sn-link{ color:var(--sn-accent); font-size:13px; font-weight:600; padding:0; text-decoration:none; background:none; border:0; cursor:pointer; }
.sn-link:hover{ text-decoration:underline; }
.sn-btn{ display:inline-flex; align-items:center; gap:6px; height:32px; padding:0 12px;
  border-radius:7px; font-size:13px; font-weight:600; }
.sn-btn--quiet{ border:1px solid var(--sn-line); color:var(--sn-ink-2); background:var(--sn-surface); }
.sn-btn--quiet:hover{ background:var(--sn-canvas); }
.sn-iconbtn{ display:inline-flex; align-items:center; justify-content:center; width:30px; height:30px;
  border-radius:7px; color:var(--sn-ink-3); flex:none; }
.sn-iconbtn:hover{ background:var(--sn-line-soft); color:var(--sn-ink); }
.sn-iconbtn--lg{ width:36px; height:36px; }
.sn-avatar{ display:inline-flex; align-items:center; justify-content:center; width:26px; height:26px;
  border-radius:50%; background:var(--sn-accent-soft); color:var(--sn-accent);
  font-size:11px; font-weight:700; letter-spacing:.02em; flex:none; }
.sn-avatar--sm{ width:20px; height:20px; font-size:10px; }
.sn-avatar--lg{ width:38px; height:38px; font-size:13px; }

/* ---------- LEFT nav ---------- */
.sn-nav{ display:flex; flex-direction:column; min-height:0; border-right:1px solid var(--sn-line); background:var(--sn-surface); }
.sn-nav__head{ padding:18px 20px 10px; }
.sn-nav__title{ margin:0; font-size:19px; font-weight:650; letter-spacing:-.01em; }
.sn-nav__count{ margin:2px 0 0; font-size:12.5px; color:var(--sn-ink-3); }
.sn-search{ display:flex; align-items:center; gap:8px; margin:4px 16px 12px; padding:0 10px;
  height:34px; border:1px solid var(--sn-line); border-radius:8px; color:var(--sn-ink-3);
  transition:border-color .15s ease; }
.sn-search:focus-within{ border-color:var(--sn-accent); }
.sn-search input{ flex:1; min-width:0; border:0; outline:none; background:none; font-size:13.5px; color:var(--sn-ink); }
.sn-filters{ display:flex; gap:2px; padding:0 16px 8px; }
.sn-filter{ padding:5px 10px; border-radius:6px; font-size:12.5px; font-weight:600; color:var(--sn-ink-3); }
.sn-filter:hover{ background:var(--sn-line-soft); }
.sn-filter.is-on{ background:var(--sn-accent-soft); color:var(--sn-accent); }
.sn-nav__scroll{ flex:1; min-height:0; overflow-y:auto; border-top:1px solid var(--sn-line-soft); }
.sn-rows{ list-style:none; margin:0; padding:0; }

.sn-row{ position:relative; display:grid; width:100%; text-align:left;
  grid-template-columns:minmax(0,1fr) auto; gap:2px 8px;
  padding:13px 18px 13px 20px; border-bottom:1px solid var(--sn-line-soft);
  transition:background .12s ease; }
.sn-row:hover{ background:var(--sn-canvas); }
.sn-row::before{ content:""; position:absolute; left:0; top:0; bottom:0; width:2px;
  background:var(--sn-accent); opacity:0; transition:opacity .15s ease; }
.sn-row.is-selected{ background:var(--sn-canvas); }
.sn-row.is-selected::before{ opacity:1; }
.sn-row__title{ grid-column:1; font-size:14.5px; font-weight:560; line-height:1.35; color:var(--sn-ink);
  overflow:hidden; text-overflow:ellipsis; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; }
.sn-row.is-unread .sn-row__title{ font-weight:700; }
.sn-row__meta{ grid-column:1; display:flex; align-items:center; gap:7px; font-size:12px; color:var(--sn-ink-3);
  min-width:0; }
.sn-row__who{ overflow:hidden; white-space:nowrap; text-overflow:ellipsis; }
.sn-row__preview{ grid-column:1; margin-top:3px; font-size:13px; color:var(--sn-ink-2);
  overflow:hidden; text-overflow:ellipsis; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; }
.sn-row__sys{ font-style:italic; color:var(--sn-ink-3); }
.sn-row__time{ grid-column:2; grid-row:1; font-size:11.5px; color:var(--sn-ink-3); white-space:nowrap; }
.sn-row__unread{ grid-column:2; grid-row:3; justify-self:end; min-width:18px; height:18px; padding:0 5px;
  display:inline-flex; align-items:center; justify-content:center; border-radius:9px;
  background:var(--sn-accent); color:#fff; font-size:11px; font-weight:700; }
.sn-row__needs{ grid-column:2; grid-row:2; justify-self:end; width:6px; height:6px; border-radius:50%;
  background:var(--sn-warn); }
.sn-state{ display:inline-flex; align-items:center; gap:5px; font-size:11.5px; font-weight:600; color:var(--sn-ink-2); white-space:nowrap; }
.sn-state::before{ content:""; width:5px; height:5px; border-radius:50%; background:var(--sn-accent); }
.sn-state--waiting_expert::before{ background:#C9A227; }
.sn-state--closed::before{ background:#B6B6C2; }
.sn-state--closed{ color:var(--sn-ink-3); }

/* ---------- CENTER ---------- */
.sn-thread{ display:flex; flex-direction:column; min-width:0; min-height:0; background:var(--sn-canvas); }
.sn-thead{ display:flex; align-items:flex-start; gap:10px; padding:14px 22px 12px;
  background:var(--sn-surface); border-bottom:1px solid var(--sn-line-soft); }
.sn-thead__main{ flex:1; min-width:0; }
.sn-thead__task{ margin:0; font-size:18px; font-weight:640; letter-spacing:-.012em; line-height:1.3;
  overflow-wrap:anywhere; }
.sn-thead__task:focus{ outline:none; }
.sn-thead__ref{ margin:1px 0 0; font-size:12.5px; color:var(--sn-ink-3); }
.sn-thead__who{ display:flex; align-items:center; gap:7px; margin:8px 0 0; font-size:13px; color:var(--sn-ink-2); }
.sn-thead__role{ font-size:11.5px; font-weight:600; color:var(--sn-accent);
  background:var(--sn-accent-soft); padding:1px 7px; border-radius:5px; }

/* ---------- ribbon ---------- */
.sn-ribbon{ padding:11px 22px 12px; background:var(--sn-surface); border-bottom:1px solid var(--sn-line); }
.sn-ribbon__rail{ display:flex; align-items:center; gap:0; }
.sn-ribbon__seg{ flex:1; height:1.5px; background:var(--sn-line); }
.sn-ribbon__seg.is-done{ background:var(--sn-accent); opacity:.4; }
.sn-ribbon__node{ width:7px; height:7px; border-radius:50%; background:var(--sn-line);
  transition:transform .28s cubic-bezier(.2,.7,.3,1), background .28s ease; }
.sn-ribbon__node.is-done{ background:var(--sn-accent); opacity:.45; }
.sn-ribbon__node.is-current{ width:9px; height:9px; background:var(--sn-accent);
  box-shadow:0 0 0 3px var(--sn-accent-soft); }
.sn-ribbon.is-advanced .sn-ribbon__node.is-current{ animation:sn-advance .5s cubic-bezier(.2,.7,.3,1); }
@keyframes sn-advance{ 0%{ transform:translateX(-14px) scale(.7); } 100%{ transform:none; } }
.sn-ribbon__labels{ display:flex; }
.sn-ribbon__step{ flex:1; display:flex; flex-direction:column; font-size:12.5px; color:var(--sn-ink-3); }
.sn-ribbon__step em{ font-style:normal; font-size:10.5px; letter-spacing:.04em; text-transform:uppercase;
  color:#9A9AA8; margin-bottom:1px; }
.sn-ribbon__step.is-current{ color:var(--sn-accent); font-weight:640; align-items:center; text-align:center; }
.sn-ribbon__step.is-next{ align-items:flex-end; text-align:right; }
.sn-ribbon.is-compact{ padding:8px 16px 9px; }
.sn-ribbon.is-compact .sn-ribbon__labels{ font-size:11.5px; }

/* ---------- connection notice ---------- */
.sn-conn{ padding:7px 22px; background:var(--sn-warn-bg); color:var(--sn-warn);
  font-size:12.5px; border-bottom:1px solid #F0E4CB; }
.sn-conn span{ font-weight:650; }

/* ---------- history ---------- */
.sn-history{ flex:1; min-height:0; overflow-y:auto; overscroll-behavior:contain;
  padding:14px 22px 20px; scroll-behavior:smooth; }
.sn-loadmore{ display:flex; justify-content:center; padding:4px 0 14px; }
.sn-datesep{ text-align:center; font-size:11.5px; color:var(--sn-ink-3); margin:16px 0 12px; }

.sn-newmark{ display:flex; align-items:center; gap:10px; margin:16px 0 12px; }
.sn-newmark::before,.sn-newmark::after{ content:""; flex:1; height:1px; background:var(--sn-accent); opacity:.28; }
.sn-newmark span{ font-size:11px; font-weight:700; letter-spacing:.05em; color:var(--sn-accent); }

.sn-event{ display:flex; align-items:center; gap:12px; margin:16px 0; }
.sn-event__rule{ flex:1; height:1px; background:var(--sn-line); }
.sn-event__body{ display:flex; align-items:baseline; gap:8px; flex-wrap:wrap; justify-content:center;
  max-width:70%; text-align:center; }
.sn-event__title{ font-size:12px; font-weight:650; color:var(--sn-ink-2); }
.sn-event__at{ font-size:11.5px; color:var(--sn-ink-3); }
.sn-event__action{ font-size:12px; font-weight:650; color:var(--sn-accent); text-decoration:none; }
.sn-event__action:hover{ text-decoration:underline; }

.sn-msg{ display:flex; flex-direction:column; margin-top:14px;
  animation:sn-enter .22s cubic-bezier(.2,.7,.3,1) both; }
.sn-msg.is-grouped{ margin-top:4px; }
@keyframes sn-enter{ from{ opacity:0; transform:translateY(6px); } to{ opacity:1; transform:none; } }
.sn-msg--student{ align-items:flex-end; }
.sn-msg__id{ display:flex; align-items:center; gap:8px; margin-bottom:5px; }
.sn-msg__name{ font-size:13px; font-weight:650; }
.sn-msg__role{ font-size:11.5px; color:var(--sn-ink-3); }
.sn-msg__bubble{ position:relative; max-width:70%; padding:10px 13px 8px;
  border-radius:12px; background:var(--sn-expert); border:1px solid transparent; }
.sn-msg--expert .sn-msg__bubble,.sn-msg--system_person .sn-msg__bubble{ border-top-left-radius:5px; }
.sn-msg--system_person .sn-msg__bubble{ background:var(--sn-surface); border-color:var(--sn-line); }
.sn-msg--student .sn-msg__bubble{ background:var(--sn-accent-soft); border-top-right-radius:5px; }
.sn-msg.is-grouped .sn-msg__bubble{ border-radius:12px; }
.sn-msg.is-pending .sn-msg__bubble{ opacity:.6; }
.sn-msg.is-failed .sn-msg__bubble{ border-color:#E0B4B4; }
.sn-msg__body{ margin:0; font-size:15px; line-height:1.55; white-space:pre-wrap; overflow-wrap:anywhere; }
.sn-msg__files{ margin-top:8px; display:flex; flex-direction:column; gap:6px; }
.sn-msg__failbar{ display:flex; align-items:center; gap:10px; margin-top:4px; font-size:11.5px; color:#A33; }
.sn-msg__failbar button{ font-weight:650; text-decoration:underline; }

.sn-attach{ display:flex; align-items:center; gap:9px; padding:7px 10px; text-decoration:none;
  background:var(--sn-surface); border:1px solid var(--sn-line); border-radius:8px; color:inherit;
  transition:border-color .12s ease; }
.sn-attach:hover{ border-color:var(--sn-accent); }
.sn-attach__icon{ color:var(--sn-ink-3); flex:none; }
.sn-attach__body{ display:flex; flex-direction:column; min-width:0; flex:1; }
.sn-attach__name{ font-size:13px; font-weight:600; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; }
.sn-attach__meta{ font-size:11px; color:var(--sn-ink-3); }
.sn-attach__cta{ font-size:12px; font-weight:650; color:var(--sn-accent); flex:none; }

.sn-jump{ position:absolute; left:50%; bottom:132px; transform:translateX(-50%);
  display:inline-flex; align-items:center; gap:6px; padding:6px 13px; border-radius:16px;
  background:var(--sn-ink); color:#fff; font-size:12.5px; font-weight:600;
  animation:sn-enter .2s ease both; z-index:3; }

/* ---------- composer ---------- */
.sn-composer{ border-top:1px solid var(--sn-line); background:var(--sn-surface); padding:12px 22px 14px; }
.sn-quote,.sn-upload{ display:flex; align-items:center; gap:9px; margin-bottom:8px; padding:7px 10px;
  background:var(--sn-canvas); border-left:2px solid var(--sn-accent); border-radius:0 7px 7px 0;
  font-size:12.5px; color:var(--sn-ink-2); }
.sn-quote__who{ font-weight:650; flex:none; }
.sn-quote__text,.sn-upload__name{ flex:1; min-width:0; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; }
.sn-upload__meta{ color:var(--sn-ink-3); flex:none; }

.sn-flag{ margin-bottom:9px; padding:10px 12px; border-radius:9px;
  background:var(--sn-warn-bg); border:1px solid #F0E4CB;
  animation:sn-enter .2s ease both; }
.sn-flag__h{ margin:0; font-size:13px; font-weight:700; color:var(--sn-warn); }
.sn-flag__b{ margin:3px 0 9px; font-size:12.5px; color:var(--sn-ink-2); }
.sn-flag__acts{ display:flex; gap:8px; }

.sn-composer__bar{ display:flex; align-items:flex-end; gap:8px; padding:8px 8px 8px 6px;
  border:1px solid var(--sn-line); border-radius:12px; background:var(--sn-surface);
  transition:border-color .15s ease, box-shadow .15s ease; }
.sn-composer__bar:focus-within{ border-color:var(--sn-accent); box-shadow:0 0 0 3px var(--sn-accent-soft); }
.sn-composer.is-flagged .sn-composer__bar{ border-color:#D9B770; box-shadow:0 0 0 3px #F7EDD8; }
.sn-composer__input{ flex:1; min-width:0; min-height:36px; max-height:200px; resize:none; border:0;
  outline:none; background:none; font:inherit; font-size:15px; line-height:1.5; padding:8px 2px; color:var(--sn-ink); }
.sn-send{ display:inline-flex; align-items:center; justify-content:center; width:36px; height:36px;
  border-radius:9px; background:var(--sn-accent); color:#fff; flex:none;
  transition:opacity .15s ease, transform .12s ease; }
.sn-send:disabled{ opacity:.3; cursor:not-allowed; }
.sn-send:not(:disabled):active{ transform:scale(.94); }
.sn-composer__hint{ margin:7px 2px 0; font-size:11px; color:var(--sn-ink-3); }

.sn-closed{ border-top:1px solid var(--sn-line); background:var(--sn-surface); padding:18px 22px; }
.sn-closed__h{ margin:0; font-size:13.5px; font-weight:700; }
.sn-closed__b{ margin:2px 0 8px; font-size:13px; color:var(--sn-ink-3); }

/* ---------- empty / blank ---------- */
.sn-empty{ padding:36px 24px; text-align:center; }
.sn-empty__h{ margin:0; font-size:14px; font-weight:650; }
.sn-empty__b{ margin:5px 0 10px; font-size:13px; color:var(--sn-ink-3); line-height:1.5; }
.sn-blank{ margin:auto; text-align:center; padding:40px; }
.sn-blank__h{ margin:0; font-size:15px; font-weight:650; }
.sn-blank__b{ margin:4px 0 0; font-size:13.5px; color:var(--sn-ink-3); }

/* ---------- RIGHT rail ---------- */
.sn-ctx{ display:flex; flex-direction:column; min-height:0; overflow-y:auto;
  border-left:1px solid var(--sn-line); background:var(--sn-surface); padding:16px 18px 24px; }
.sn-ctx__label{ margin:0 0 10px; font-size:10.5px; font-weight:700; letter-spacing:.06em;
  text-transform:uppercase; color:#9A9AA8; }
.sn-ctx__task{ margin:0; font-size:15px; font-weight:650; line-height:1.35; overflow-wrap:anywhere; }
.sn-ctx__ref{ margin:2px 0 14px; font-size:12px; color:var(--sn-ink-3); }
.sn-ctx__now{ display:flex; gap:18px; padding:11px 0; border-top:1px solid var(--sn-line-soft);
  border-bottom:1px solid var(--sn-line-soft); font-size:13px; font-weight:600; }
.sn-ctx__now em{ display:block; font-style:normal; font-size:10.5px; font-weight:700; letter-spacing:.05em;
  text-transform:uppercase; color:#9A9AA8; margin-bottom:2px; }
.sn-ctx__now div:first-child{ color:var(--sn-accent); }
.sn-ctx__needs{ margin-top:14px; padding:11px 12px; border-radius:9px;
  background:var(--sn-warn-bg); border:1px solid #F0E4CB; }
.sn-ctx__needs-h{ margin:0; font-size:12.5px; font-weight:700; color:var(--sn-warn); }
.sn-ctx__needs-b{ margin:4px 0 8px; font-size:12.5px; color:var(--sn-ink-2); line-height:1.45; }
.sn-ctx__kv{ margin:16px 0 0; }
.sn-ctx__kv div{ display:flex; justify-content:space-between; gap:12px; padding:7px 0;
  border-bottom:1px solid var(--sn-line-soft); font-size:12.5px; }
.sn-ctx__kv dt{ color:var(--sn-ink-3); }
.sn-ctx__kv dd{ margin:0; font-weight:600; text-align:right; overflow-wrap:anywhere; }
.sn-ctx__files{ margin-top:14px; }
.sn-ctx__files-h{ margin:0 0 8px; font-size:10.5px; font-weight:700; letter-spacing:.06em;
  text-transform:uppercase; color:#9A9AA8; }
.sn-ctx__files-list{ list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:4px; }
.sn-ctx__file{ display:flex; align-items:center; gap:7px; padding:6px 8px; text-decoration:none;
  color:var(--sn-ink); border-radius:6px; transition:background .12s ease; font-size:12.5px; }
.sn-ctx__file:hover{ background:var(--sn-canvas); }
.sn-ctx__file-name{ flex:1; min-width:0; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; font-weight:500; }
.sn-ctx__file-meta{ color:var(--sn-ink-3); font-size:11px; flex:none; }
.sn-ctx__expert{ display:flex; align-items:center; gap:11px; margin-top:16px; }
.sn-ctx__expert-name{ margin:0; font-size:13.5px; font-weight:650; }
.sn-ctx__expert-role{ margin:1px 0 0; font-size:11.5px; color:var(--sn-ink-3); }
.sn-ctx__links{ display:flex; flex-direction:column; gap:8px; margin-top:18px;
  padding-top:14px; border-top:1px solid var(--sn-line-soft); }
.sn-ctx__links a{ font-size:13px; font-weight:600; color:var(--sn-accent); text-decoration:none; }
.sn-ctx__links a:hover{ text-decoration:underline; }

/* ---------- drawer / sheet ---------- */
.sn-scrim{ position:fixed; inset:0; background:rgba(20,20,28,.32); opacity:0; pointer-events:none;
  transition:opacity .22s ease; z-index:40; }
.sn-scrim.is-open{ opacity:1; pointer-events:auto; }
.sn-drawer{ position:fixed; top:0; right:0; bottom:0; width:min(340px,86vw); z-index:41;
  display:flex; flex-direction:column; background:var(--sn-surface);
  border-left:1px solid var(--sn-line); transform:translateX(100%);
  transition:transform .26s cubic-bezier(.2,.7,.3,1); }
.sn-drawer.is-open{ transform:none; }
.sn-drawer__head{ display:flex; align-items:center; justify-content:space-between;
  padding:14px 16px 8px; }
.sn-drawer__head .sn-ctx__label{ margin:0; }
.sn-drawer__scroll{ flex:1; overflow-y:auto; padding:0 16px 24px; }

/* ---------- tablet ---------- */
@media (max-width:1379px) and (min-width:768px){
  .sn-msgs{ grid-template-columns:288px minmax(0,1fr); }
}

/* ---------- mobile ---------- */
@media (max-width:767px){
  .sn-msgs{ grid-template-columns:1fr; position:relative; }
  .sn-nav,.sn-thread{ grid-column:1; grid-row:1; }
  .sn-nav{ border-right:0; }
  .sn-msgs[data-mobile-view="list"] .sn-thread{ display:none; }
  .sn-msgs[data-mobile-view="thread"] .sn-nav{ display:none; }
  .sn-msgs[data-mobile-view="thread"] .sn-thread{ animation:sn-slide-in .26s cubic-bezier(.2,.7,.3,1) both; }
  @keyframes sn-slide-in{ from{ opacity:.4; transform:translateX(12px); } to{ opacity:1; transform:none; } }

  .sn-row{ padding:14px 16px; min-height:76px; }
  .sn-thead{ padding:10px 14px; align-items:center; }
  .sn-thead__task{ font-size:16px; -webkit-line-clamp:1; display:-webkit-box; -webkit-box-orient:vertical; overflow:hidden; }
  .sn-thead__ref,.sn-thead__who{ display:none; }
  .sn-history{ padding:12px 14px 18px; }
  .sn-msg__bubble{ max-width:86%; }
  .sn-composer{ padding:10px 14px calc(12px + env(safe-area-inset-bottom)); position:sticky; bottom:0; }
  .sn-drawer{ top:auto; left:0; width:100%; height:88vh; border-left:0;
    border-top-left-radius:16px; border-top-right-radius:16px;
    transform:translateY(100%); }
  .sn-drawer.is-open{ transform:none; }
  .sn-jump{ bottom:120px; }
}

/* ---------- reduced motion ---------- */
@media (prefers-reduced-motion:reduce){
  .sn-msgs *{ animation-duration:.01ms !important; transition-duration:.01ms !important; }
  .sn-history{ scroll-behavior:auto; }
}
`;
