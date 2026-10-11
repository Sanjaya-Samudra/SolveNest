import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Download,
  FileText,
  Loader2,
  Paperclip,
  RefreshCw,
  Send,
  ShieldCheck,
  Trash2,
  Upload,
} from 'lucide-react'
import {
  buildExpertAssignmentRoute,
  EXPERT_ASSIGNMENT_TABS,
  EXPERT_FILE_SECTIONS,
  formatAssignmentDue,
  formatAssignmentStamp,
  formatAssignmentTime,
  formatFileSize,
} from '../../expert/assignmentState.js'
import { useAssignmentRealtime, useAssignmentWorkspace, useQaDeliveryWorkflow } from '../../expert/assignmentData.js'
import { fetchExpertFileAccess } from '../../expert/expertApi.js'
import { ExpertAssignmentsSkeletons, qaLabel } from './ExpertAssignments.jsx'
import { goExpert } from './ExpertAppShell.jsx'
import './expert-assignments.css'

const ACTION_ERROR_COPY = {
  QA_FILES_REQUIRED: 'Add at least one file to the submission package first.',
  DELIVERY_FILES_REQUIRED: 'Add at least one file to the submission package first.',
  QA_ALREADY_PENDING: 'This assignment is already in quality review.',
  QA_ALREADY_APPROVED: 'Quality review is already approved — prepare the delivery.',
  QA_APPROVAL_REQUIRED: 'Quality review must approve this work before delivery.',
  QA_FEEDBACK_OPEN: 'Resolve every feedback item before resubmitting.',
  QA_NOT_PENDING: 'No quality review is currently pending.',
  QA_IN_REVIEW: 'Quality review is in progress — this stays locked until the review finishes.',
  ASSIGNMENT_CLOSED: 'This assignment is closed. Start a revision to reopen it.',
  ASSIGNMENT_NOT_DELIVERED: 'This assignment has not been delivered yet.',
  WORK_STATE_LOCKED: 'The work state cannot change in the current stage.',
  WORK_STATE_INVALID: 'That change is not available in the current stage.',
  MESSAGE_INVALID: 'Messages must be between 1 and 4000 characters.',
  UPDATE_INVALID: 'Progress updates must be between 1 and 4000 characters.',
  FILE_UPLOAD_REJECTED: 'This file type is not supported.',
  FILE_TOO_LARGE: 'File exceeds the 100 MB limit.',
  FILE_IMMUTABLE: 'Files provided with the assignment cannot be removed.',
  RATE_LIMITED: 'Too many requests — wait a moment and try again.',
  EXPERT_LOAD_FAILED: 'The workspace could not be loaded. Try again.',
  NETWORK_ERROR: 'Network error — check your connection and try again.',
}

function errorText(error) {
  if (!error) return null
  return ACTION_ERROR_COPY[error.code] || error.serverMessage || 'Something went wrong. Try again.'
}

export function AssignmentWorkspaceHeader({ assignment, loading, onBack }) {
  return (
    <header className="exp-a-ws-head">
      <button type="button" className="exp-a-back" onClick={onBack}>
        <ArrowLeft size={15} />
        Assignments
      </button>
      {loading || !assignment ? (
        <div className="exp-a-ws-head-skeleton">
          <span />
          <span />
          <span />
        </div>
      ) : (
        <div className="exp-a-ws-title">
          <p className="exp-overline">
            {[assignment.reference, assignment.domain || assignment.type].filter(Boolean).join(' · ') || 'ASSIGNMENT'}
          </p>
          <h1>{assignment.title}</h1>
          <div className="exp-a-ws-meta">
            <span className="exp-state-chip" data-state={assignment.workState}>{assignment.display.label}</span>
            <span className="exp-a-deadline" data-tone={assignment.deadlineState.tone}>
              <CalendarClock size={14} />
              {assignment.deadlineState.detail}
            </span>
            <span className="exp-a-updated">Updated {formatAssignmentTime(assignment.updatedAt)}</span>
          </div>
        </div>
      )}
      {assignment && (
        <ol className="exp-journey exp-a-ws-journey" aria-label="Assignment journey">
          {assignment.stage.steps.map((step) => (
            <li key={step.key} data-status={step.status}>
              <span className="exp-journey-node">
                {step.status === 'complete' ? <CheckCircle2 size={14} /> : <span className="exp-a-journey-dot" />}
              </span>
              <em>{step.label}</em>
            </li>
          ))}
        </ol>
      )}
    </header>
  )
}

export function AssignmentAttentionBar({ assignment, qaState, revisionActive, onGoTab }) {
  const attention = assignment?.attention
  if (revisionActive) {
    return (
      <div className="exp-a-attn exp-a-attn--bar" data-level="warn">
        <span className="exp-a-attn-badge">REVISION IN PROGRESS</span>
        <div>
          <strong>Revision in progress</strong>
          <p>Work has reopened for a revision. Resubmit through quality review before delivering again.</p>
        </div>
        <button type="button" className="exp-a-attn-cta" onClick={() => onGoTab('work')}>
          Open work log
          <ArrowRight size={14} />
        </button>
      </div>
    )
  }
  if (!attention || attention.level === 'none') return null
  const ctaByState = {
    waiting_clarification: { tab: 'messages', label: 'Respond in messages' },
    changes_requested: { tab: 'qa', label: 'Review QA feedback' },
    ready_for_qa: { tab: 'qa', label: 'Submit for QA' },
    ready_to_deliver: { tab: 'qa', label: 'Prepare delivery' },
    qa_review: { tab: 'qa', label: 'View QA status' },
    assigned: { tab: 'requirements', label: 'Review requirements' },
    needs_review: { tab: 'requirements', label: 'Review requirements' },
    working: { tab: 'work', label: 'Open work log' },
  }
  const fallbackByDeadline = {
    overdue: { tab: 'work', label: 'Open work log' },
    due_soon: { tab: 'work', label: 'Open work log' },
  }
  const cta = ctaByState[assignment.workState] || fallbackByDeadline[assignment.deadlineState?.key] || null
  return (
    <div className="exp-a-attn exp-a-attn--bar" data-level={attention.level}>
      <span className="exp-a-attn-badge">{attention.badge}</span>
      <div>
        <strong>{attention.reason}</strong>
        <p>{attention.detail}</p>
      </div>
      {cta && (
        <button type="button" className="exp-a-attn-cta" onClick={() => onGoTab(cta.tab)}>
          {cta.label}
          <ArrowRight size={14} />
        </button>
      )}
    </div>
  )
}

function WorkspaceTabs({ tab, onGoTab, badges }) {
  return (
    <nav className="exp-tabs exp-a-ws-tabs" aria-label="Assignment workspace sections">
      {EXPERT_ASSIGNMENT_TABS.map((item) => (
        <button
          type="button"
          key={item.key}
          className={`exp-tab ${tab === item.key ? 'is-active' : ''}`}
          onClick={() => onGoTab(item.key)}
        >
          {item.label}
          {badges[item.key] ? <b>{badges[item.key]}</b> : null}
        </button>
      ))}
    </nav>
  )
}

export function AssignmentOverviewPanel({ assignment, qa, delivery, revision, onGoTab }) {
  if (!assignment) return <PanelSkeleton />
  const counts = assignment.workspace?.counts || {}
  const attention = assignment.attention
  const qaState = qa?.state || assignment.workspace?.qa?.state
  const deliveryState = delivery?.state || assignment.workspace?.delivery?.state
  const deliveryVersion = delivery?.version || assignment.workspace?.delivery?.version || 0
  const primaryCta = {
    assigned: { tab: 'requirements', label: 'Review requirements' },
    needs_review: { tab: 'requirements', label: 'Review requirements' },
    working: { tab: 'work', label: 'Continue work' },
    waiting_clarification: { tab: 'messages', label: 'Respond in messages' },
    ready_for_qa: { tab: 'qa', label: 'Submit for QA' },
    qa_review: { tab: 'qa', label: 'View QA status' },
    changes_requested: { tab: 'qa', label: 'Review QA feedback' },
    ready_to_deliver: { tab: 'qa', label: 'Prepare delivery' },
    delivered: { tab: 'qa', label: 'View delivery receipt' },
  }[assignment.workState] || { tab: 'work', label: 'Open work log' }

  return (
    <div className="exp-a-overview">
      <section className="exp-a-card" data-attn={attention.level}>
        <div className="exp-a-card-head">
          <span className="exp-state-chip" data-state={assignment.workState}>{assignment.display.label}</span>
          {attention.needsAttention && (
            <span className="exp-a-row-badge" data-level={attention.level}>{attention.badge}</span>
          )}
        </div>
        <p className="exp-a-card-lead">{attention.detail || `Next: ${assignment.next.label}.`}</p>
        <div className="exp-a-card-actions">
          <button type="button" className="exp-button" onClick={() => onGoTab(primaryCta.tab)}>
            {primaryCta.label}
            <ArrowRight size={15} />
          </button>
          <span className="exp-a-due-pill" data-tone={assignment.deadlineState.tone}>
            <CalendarClock size={14} />
            {formatAssignmentDue(assignment.deadline, { completed: assignment.display.closed })}
          </span>
        </div>
        <div className="exp-a-stat-grid exp-a-stat-grid--wide">
          <div><span>Work updates</span><strong>{counts.updates || 0}</strong></div>
          <div><span>Messages</span><strong>{counts.messages || 0}{counts.unreadMessages ? ` · ${counts.unreadMessages} new` : ''}</strong></div>
          <div><span>Files</span><strong>{counts.files || 0}</strong></div>
          <div><span>Open feedback</span><strong>{counts.openFeedback || 0}</strong></div>
        </div>
      </section>

      <section className="exp-a-card">
        <div className="exp-a-card-head"><h4>Latest activity</h4></div>
        {assignment.latest ? (
          <p className="exp-a-latest">
            <span>{assignment.latest.text}</span>
            <time>{formatAssignmentTime(assignment.latest.at)}</time>
          </p>
        ) : (
          <p className="exp-a-muted">No activity recorded yet.</p>
        )}
      </section>

      <section className="exp-a-card">
        <div className="exp-a-card-head">
          <h4>Quality review & delivery</h4>
          <button type="button" className="exp-a-link" onClick={() => onGoTab('qa')}>Open</button>
        </div>
        <dl className="exp-a-facts exp-a-facts--grid">
          <div>
            <dt>Quality review</dt>
            <dd>{qaLabel(qaState)}</dd>
          </div>
          <div>
            <dt>Delivery</dt>
            <dd>
              {deliveryState === 'delivered'
                ? `Delivered · package v${deliveryVersion}`
                : 'Not delivered yet'}
            </dd>
          </div>
          <div>
            <dt>Revision</dt>
            <dd>{revision?.active || assignment.workspace?.revision?.active ? 'In progress' : 'None'}</dd>
          </div>
          <div>
            <dt>Deadline</dt>
            <dd>{assignment.deadlineState.detail}</dd>
          </div>
        </dl>
      </section>

      <section className="exp-a-card exp-a-full">
        <div className="exp-a-card-head"><h4>Assignment details</h4></div>
        <dl className="exp-a-facts exp-a-facts--grid">
          <div>
            <dt>Reference</dt>
            <dd>{assignment.reference || '—'}</dd>
          </div>
          <div>
            <dt>Domain</dt>
            <dd>{assignment.domain || assignment.type || '—'}</dd>
          </div>
          <div>
            <dt>Deliverable</dt>
            <dd>{assignment.deliverable || '—'}</dd>
          </div>
          <div>
            <dt>Last updated</dt>
            <dd>{formatAssignmentStamp(assignment.updatedAt)}</dd>
          </div>
        </dl>
      </section>
    </div>
  )
}

export function AssignmentRequirementsPanel({ requirements, assignment }) {
  if (!requirements) return <PanelSkeleton />
  const confirmed = requirements.confirmed || []
  const open = requirements.open || []
  return (
    <div className="exp-a-overview">
      <section className="exp-a-card">
        <div className="exp-a-card-head">
          <h4>Deliverable</h4>
          <span className="exp-a-ref">{assignment?.reference}</span>
        </div>
        <p className="exp-a-card-lead">{requirements.deliverable || assignment?.deliverable || 'No deliverable description provided.'}</p>
        <p className="exp-a-muted">
          {requirements.deadline ? `Deadline: ${formatAssignmentStamp(requirements.deadline)}` : 'No fixed deadline provided.'}
        </p>
      </section>

      <section className="exp-a-card">
        <div className="exp-a-card-head">
          <h4>Confirmed requirements</h4>
          <span className="exp-a-count">{confirmed.length}</span>
        </div>
        {confirmed.length === 0 ? (
          <p className="exp-a-muted">No itemized requirements were provided for this assignment.</p>
        ) : (
          <ul className="exp-a-check-list">
            {confirmed.map((item) => (
              <li key={item.id}>
                <CheckCircle2 size={16} aria-hidden="true" />
                <span>{item.text}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="exp-a-card">
        <div className="exp-a-card-head">
          <h4>Open questions</h4>
          <span className="exp-a-count">{open.length}</span>
        </div>
        {open.length === 0 ? (
          <p className="exp-a-muted">No open questions. Raise anything unclear in the Messages tab.</p>
        ) : (
          <ul className="exp-a-open-list">
            {open.map((item) => (
              <li key={item.id}>
                <strong>{item.text}</strong>
                {item.note && <span>{item.note}</span>}
              </li>
            ))}
          </ul>
        )}
        <p className="exp-a-footnote">Requirements are confirmed by SolveNest. Student identity is never shown in this workspace.</p>
      </section>
    </div>
  )
}

export function AssignmentWorkPanel({ work, assignment, qaState, action, onUpdate, onSetState }) {
  const [draft, setDraft] = useState('')
  if (!work) return <PanelSkeleton />
  const state = work.workState || assignment?.workState
  const busy = action.busy && (action.kind === 'update' || action.kind === 'state')
  const transitions = []
  if (qaState !== 'in_review') {
    if (state === 'assigned' || state === 'needs_review') transitions.push({ state: 'working', label: 'Begin work' })
    if (state === 'working') transitions.push({ state: 'waiting_clarification', label: 'I need clarification' })
    if (state === 'waiting_clarification') transitions.push({ state: 'working', label: 'Resume work' })
    if (state === 'changes_requested') transitions.push({ state: 'working', label: 'Start revisions' })
  }

  const submitUpdate = async (event) => {
    event.preventDefault()
    const text = draft.trim()
    if (!text) return
    const outcome = await onUpdate(text)
    if (outcome.ok) setDraft('')
  }

  return (
    <div className="exp-a-overview exp-a-overview--split">
      <section className="exp-a-card">
        <div className="exp-a-card-head">
          <h4>Work state</h4>
          <span className="exp-state-chip" data-state={state}>{workStateLabel(state)}</span>
        </div>
        <p className="exp-a-muted">
          {qaState === 'in_review'
            ? 'Quality review is in progress. Work states stay locked until the review finishes.'
            : transitions.length
              ? 'Update the work state as you progress — SolveNest sees every change.'
              : 'No state changes are available at this stage.'}
        </p>
        {transitions.length > 0 && (
          <div className="exp-a-card-actions">
            {transitions.map((item) => (
              <button
                type="button"
                key={item.state}
                className="exp-button exp-button--secondary"
                disabled={busy}
                onClick={() => onSetState(item.state)}
              >
                {busy ? <Loader2 className="exp-a-spin" size={14} /> : null}
                {item.label}
              </button>
            ))}
          </div>
        )}
        {action.error && (action.kind === 'state' || action.kind === 'update') && (
          <p className="exp-a-inline-error" role="alert">{errorText(action.error)}</p>
        )}
      </section>

      <section className="exp-a-card">
        <div className="exp-a-card-head">
          <h4>Add progress update</h4>
        </div>
        <form className="exp-a-composer" onSubmit={submitUpdate}>
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="What did you complete, and what is next?"
            rows={3}
            maxLength={4000}
            aria-label="Progress update"
          />
          <div className="exp-a-composer-foot">
            <span>{draft.length > 3600 ? `${draft.length}/4000` : ''}</span>
            <button type="submit" className="exp-button" disabled={busy || !draft.trim()}>
              {busy && action.kind === 'update' ? <Loader2 className="exp-a-spin" size={15} /> : <Send size={15} />}
              Post update
            </button>
          </div>
        </form>
      </section>

      <section className="exp-a-card exp-a-full">
        <div className="exp-a-card-head">
          <h4>Work log</h4>
          <span className="exp-a-count">{(work.updates || []).length}</span>
        </div>
        {(work.updates || []).length === 0 ? (
          <p className="exp-a-muted">No updates yet. Post your first progress update above.</p>
        ) : (
          <ul className="exp-a-timeline">
            {work.updates.map((update) => (
              <li key={update.id}>
                <span className="exp-a-timeline-dot" aria-hidden="true" />
                <div>
                  <p>{update.body}</p>
                  <time>{formatAssignmentTime(update.createdAt)}</time>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

export function AssignmentMessagesPanel({ messages, unread, busy, error, onSend, onRead }) {
  const [draft, setDraft] = useState('')
  useEffect(() => {
    if (unread > 0 && !busy) onRead?.()
  }, [unread, busy, onRead])

  const submit = async (event) => {
    event.preventDefault()
    const text = draft.trim()
    if (!text || busy) return
    const outcome = await onSend(text)
    if (outcome.ok) setDraft('')
  }

  return (
    <div className="exp-a-messages">
      <section className="exp-a-card exp-a-thread">
        <div className="exp-a-card-head">
          <h4>Assignment messages</h4>
          <span className="exp-a-count">{messages.length}</span>
        </div>
        {messages.length === 0 ? (
          <p className="exp-a-muted">No messages yet. Use this thread to coordinate with SolveNest on this assignment.</p>
        ) : (
          <div className="exp-a-msg-list">
            {messages.map((message) => (
              <article className="exp-a-msg" data-from={message.from} key={message.id}>
                <header>
                  <strong>{message.author}</strong>
                  <span>{message.role}</span>
                  <time>{formatAssignmentTime(message.createdAt)}</time>
                </header>
                <p>{message.body}</p>
              </article>
            ))}
          </div>
        )}
        {error && <p className="exp-a-inline-error" role="alert">{errorText(error)}</p>}
      </section>

      <section className="exp-a-card">
        <div className="exp-a-card-head"><h4>Reply</h4></div>
        <form className="exp-a-composer" onSubmit={submit}>
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Write a message to SolveNest…"
            rows={3}
            maxLength={4000}
            aria-label="Message"
          />
          <div className="exp-a-composer-foot">
            <span>{draft.length > 3600 ? `${draft.length}/4000` : ''}</span>
            <button type="submit" className="exp-button" disabled={busy || !draft.trim()}>
              {busy ? <Loader2 className="exp-a-spin" size={15} /> : <Send size={15} />}
              Send
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}

export function AssignmentFilesPanel({ files, action, closed, onUpload, onRemove, onNotifyError }) {
  const [progress, setProgress] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const busy = action.busy && action.kind === 'upload'

  const handleUpload = async (section, file) => {
    if (!file) return
    setProgress({ section, percent: 0 })
    const outcome = await onUpload(file, section, (percent) => setProgress({ section, percent }))
    setProgress(null)
    if (!outcome.ok && outcome.error) onNotifyError?.(errorText(outcome.error))
  }

  const handleDownload = async (file) => {
    try {
      const payload = await fetchExpertFileAccess(file.id)
      window.open(payload.signedUrl, '_blank', 'noopener')
    } catch {
      onNotifyError?.('This file could not be opened right now.')
    }
  }

  const handleDelete = async (file) => {
    const outcome = await onRemove(file.id)
    setConfirmDelete(null)
    if (!outcome.ok && outcome.error) onNotifyError?.(errorText(outcome.error))
  }

  return (
    <div className="exp-a-files">
      {EXPERT_FILE_SECTIONS.map((section) => {
        const rows = files?.[section.key] || []
        const editable = section.editable && !closed
        const sectionProgress = progress?.section === section.key ? progress.percent : null
        return (
          <section className="exp-a-card" key={section.key}>
            <div className="exp-a-card-head">
              <div>
                <h4>{section.label}</h4>
                <p className="exp-a-muted">{section.hint}</p>
              </div>
              <div className="exp-a-section-actions">
                <span className="exp-a-count">{rows.length}</span>
                {editable && (
                  <label className={`exp-a-upload ${busy ? 'is-busy' : ''}`}>
                    {busy && sectionProgress !== null ? `${sectionProgress}%` : <><Upload size={14} /> Upload</>}
                    <input
                      type="file"
                      disabled={busy}
                      onChange={(event) => {
                        const file = event.target.files?.[0]
                        event.target.value = ''
                        handleUpload(section.key, file)
                      }}
                    />
                  </label>
                )}
              </div>
            </div>
            {rows.length === 0 ? (
              <p className="exp-a-muted">{editable ? 'No files yet.' : 'No files provided here yet.'}</p>
            ) : (
              <ul className="exp-a-file-list">
                {rows.map((file) => (
                  <li key={file.id}>
                    <FileText size={16} aria-hidden="true" />
                    <div className="exp-a-file-main">
                      <strong>{file.name}</strong>
                      <small>
                        {formatFileSize(file.size)}
                        {' · '}
                        {file.uploadedBy === 'expert' ? 'You' : 'SolveNest'}
                        {' · '}
                        {formatAssignmentTime(file.uploadedAt)}
                      </small>
                    </div>
                    <div className="exp-a-file-actions">
                      <button type="button" className="exp-a-icon-btn" onClick={() => handleDownload(file)} aria-label={`Download ${file.name}`}>
                        <Download size={15} />
                      </button>
                      {file.origin === 'expert' && confirmDelete !== file.id && (
                        <button
                          type="button"
                          className="exp-a-icon-btn"
                          onClick={() => setConfirmDelete(file.id)}
                          aria-label={`Remove ${file.name}`}
                          disabled={action.busy}
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                      {file.origin === 'expert' && confirmDelete === file.id && (
                        <span className="exp-a-confirm-inline">
                          <button type="button" className="exp-a-link" onClick={() => handleDelete(file)}>Remove</button>
                          <button type="button" className="exp-a-link" onClick={() => setConfirmDelete(null)}>Cancel</button>
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {busy && sectionProgress !== null && (
              <div className="exp-a-progress" aria-hidden="true">
                <span style={{ width: `${sectionProgress}%` }} />
              </div>
            )}
          </section>
        )
      })}
      {action.error && action.kind === 'upload' && (
        <p className="exp-a-inline-error" role="alert">{errorText(action.error)}</p>
      )}
      {closed && (
        <p className="exp-a-footnote">This assignment is delivered — file changes unlock when a revision starts.</p>
      )}
    </div>
  )
}

export function AssignmentQaDeliveryPanel({ flow, onSubmit, onResolve, onResubmit, onDeliver, onBeginRevision }) {
  const [note, setNote] = useState('')
  const [confirming, setConfirming] = useState(null)
  if (flow.loading && !flow.qa) return <PanelSkeleton />

  const qa = flow.qa || { state: 'not_submitted', cycle: 0, feedback: [] }
  const delivery = flow.delivery || { state: 'not_delivered', version: 0 }
  const revisionActive = Boolean(flow.revision?.active)
  const submitted = flow.submissionFiles || []
  const busy = flow.action.busy
  const actionError = flow.action.error ? errorText(flow.action.error) : null
  const finish = (promise) => promise.finally(() => setConfirming(null))

  const infoNote = (
    <p className="exp-a-footnote">
      SolveNest quality review checks the submission package against the confirmed requirements. Delivery unlocks only after approval — this workspace never skips review.
    </p>
  )

  if (revisionActive || (qa.state === 'not_submitted' && delivery.state !== 'delivered')) {
    return (
      <div className="exp-a-overview">
        {revisionActive && (
          <section className="exp-a-card" data-attn="warn">
            <div className="exp-a-card-head">
              <h4>Revision in progress</h4>
              <span className="exp-a-row-badge" data-level="warn">REVISION</span>
            </div>
            <p className="exp-a-card-lead">A revision reopened this assignment. Update the package and pass quality review again before delivering.</p>
          </section>
        )}
        <section className="exp-a-card exp-a-full">
          <div className="exp-a-card-head">
            <h4>Submit for quality review</h4>
            <span className="exp-a-count">Cycle {qa.cycle + 1}</span>
          </div>
          <p className="exp-a-muted">
            {submitted.length === 0
              ? 'Add at least one file to the submission package (Files tab) before submitting.'
              : `Submission package: ${submitted.length} file${submitted.length === 1 ? '' : 's'}. Quality review starts as soon as you submit.`}
          </p>
          <form
            className="exp-a-composer"
            onSubmit={(event) => {
              event.preventDefault()
              finish(onSubmit(note))
            }}
          >
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Note for the reviewer (optional)"
              rows={2}
              maxLength={2000}
              aria-label="Note for the reviewer"
            />
            <div className="exp-a-composer-foot">
              <span />
              {confirming === 'submit' ? (
                <span className="exp-a-confirm-group">
                  <button type="button" className="exp-button exp-button--secondary" onClick={() => setConfirming(null)} disabled={busy}>Cancel</button>
                  <button type="submit" className="exp-button" disabled={busy}>
                    {busy ? <Loader2 className="exp-a-spin" size={15} /> : <ShieldCheck size={15} />}
                    Confirm submit
                  </button>
                </span>
              ) : (
                <button type="button" className="exp-button" disabled={busy || submitted.length === 0} onClick={() => setConfirming('submit')}>
                  Submit for QA
                  <ArrowRight size={15} />
                </button>
              )}
            </div>
          </form>
          {actionError && <p className="exp-a-inline-error" role="alert">{actionError}</p>}
          {infoNote}
        </section>
      </div>
    )
  }

  if (qa.state === 'in_review') {
    return (
      <div className="exp-a-overview">
        <section className="exp-a-card exp-a-full" data-attn="info">
          <div className="exp-a-card-head">
            <h4>In quality review</h4>
            <span className="exp-a-row-badge" data-level="info">IN REVIEW</span>
          </div>
          <p className="exp-a-card-lead">
            {`Cycle ${qa.cycle} was submitted ${formatAssignmentTime(qa.submittedAt)}. SolveNest QA is reviewing the submission package.`}
          </p>
          <dl className="exp-a-facts exp-a-facts--grid">
            <div>
              <dt>Submitted</dt>
              <dd>{formatAssignmentStamp(qa.submittedAt)}</dd>
            </div>
            <div>
              <dt>Package</dt>
              <dd>{submitted.length} file{submitted.length === 1 ? '' : 's'}</dd>
            </div>
            <div>
              <dt>Delivery</dt>
              <dd>Locked until approval</dd>
            </div>
            <div>
              <dt>Next</dt>
              <dd>Wait for the review outcome</dd>
            </div>
          </dl>
          {infoNote}
        </section>
      </div>
    )
  }

  if (qa.state === 'changes_requested') {
    const feedback = flow.feedback
    return (
      <div className="exp-a-overview">
        <section className="exp-a-card" data-attn="critical">
          <div className="exp-a-card-head">
            <h4>Quality review feedback</h4>
            <span className="exp-a-row-badge" data-level="critical">CHANGES REQUESTED</span>
          </div>
          <p className="exp-a-card-lead">
            {feedback.filter((item) => item.state !== 'resolved').length} open item{feedback.filter((item) => item.state !== 'resolved').length === 1 ? '' : 's'} — resolve each one, then resubmit for quality review.
          </p>
        </section>
        <ul className="exp-a-feedback">
          {feedback.map((item) => (
            <li key={item.id} data-resolved={item.state === 'resolved' ? 'true' : 'false'}>
              <div className="exp-a-feedback-head">
                <strong>{item.title}</strong>
                <span className={`exp-a-severity ${item.severity === 'major' ? 'is-major' : ''}`}>{item.severity}</span>
              </div>
              <p>{item.body}</p>
              <div className="exp-a-feedback-foot">
                <time>{formatAssignmentTime(item.createdAt)}</time>
                {item.state === 'resolved' ? (
                  <span className="exp-a-resolved"><CheckCircle2 size={14} /> Resolved</span>
                ) : (
                  <button
                    type="button"
                    className="exp-button exp-button--secondary exp-button--sm"
                    disabled={busy}
                    onClick={() => onResolve(item.id)}
                  >
                    {busy && flow.action.kind === 'resolve' ? <Loader2 className="exp-a-spin" size={14} /> : null}
                    Mark resolved
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
        <section className="exp-a-card">
          <div className="exp-a-card-head"><h4>Resubmit for review</h4></div>
          <p className="exp-a-muted">
            {flow.allResolved
              ? 'All feedback is resolved. Resubmit the package when the fixes are in place.'
              : 'Resolve every feedback item to unlock resubmission.'}
          </p>
          <form
            className="exp-a-composer"
            onSubmit={(event) => {
              event.preventDefault()
              finish(onResubmit(note))
            }}
          >
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="What changed since the last cycle? (optional)"
              rows={2}
              maxLength={2000}
              aria-label="Resubmission note"
            />
            <div className="exp-a-composer-foot">
              <span />
              {confirming === 'resubmit' ? (
                <span className="exp-a-confirm-group">
                  <button type="button" className="exp-button exp-button--secondary" onClick={() => setConfirming(null)} disabled={busy}>Cancel</button>
                  <button type="submit" className="exp-button" disabled={busy || !flow.allResolved}>
                    {busy ? <Loader2 className="exp-a-spin" size={15} /> : <RefreshCw size={15} />}
                    Confirm resubmit
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  className="exp-button"
                  disabled={busy || !flow.allResolved || submitted.length === 0}
                  onClick={() => setConfirming('resubmit')}
                >
                  Resubmit for QA
                  <ArrowRight size={15} />
                </button>
              )}
            </div>
          </form>
          {actionError && <p className="exp-a-inline-error" role="alert">{actionError}</p>}
        </section>
      </div>
    )
  }

  if (qa.state === 'approved' && delivery.state !== 'delivered') {
    return (
      <div className="exp-a-overview">
        <section className="exp-a-card" data-attn="warn">
          <div className="exp-a-card-head">
            <h4>Approved — prepare delivery</h4>
            <span className="exp-a-row-badge" data-level="warn">QA APPROVED</span>
          </div>
          <p className="exp-a-card-lead">
            Cycle {qa.cycle} passed quality review {qa.reviewedAt ? `on ${formatAssignmentStamp(qa.reviewedAt)}` : ''}. Submit the delivery package to complete this assignment.
          </p>
        </section>
        <section className="exp-a-card exp-a-full">
          <div className="exp-a-card-head">
            <h4>Delivery package</h4>
            <span className="exp-a-count">{submitted.length}</span>
          </div>
          <ul className="exp-a-package-list">
            {submitted.map((file) => (
              <li key={file.id}>
                <Paperclip size={14} />
                {file.name}
                <small>{formatFileSize(file.size)}</small>
              </li>
            ))}
          </ul>
          <form
            className="exp-a-composer"
            onSubmit={(event) => {
              event.preventDefault()
              finish(onDeliver(note))
            }}
          >
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Delivery note for the recipient (optional)"
              rows={2}
              maxLength={2000}
              aria-label="Delivery note"
            />
            <div className="exp-a-composer-foot">
              <span />
              {confirming === 'deliver' ? (
                <span className="exp-a-confirm-group">
                  <button type="button" className="exp-button exp-button--secondary" onClick={() => setConfirming(null)} disabled={busy}>Cancel</button>
                  <button type="submit" className="exp-button" disabled={busy}>
                    {busy ? <Loader2 className="exp-a-spin" size={15} /> : <ShieldCheck size={15} />}
                    Confirm delivery
                  </button>
                </span>
              ) : (
                <button type="button" className="exp-button" disabled={busy || submitted.length === 0} onClick={() => setConfirming('deliver')}>
                  Submit delivery
                  <ArrowRight size={15} />
                </button>
              )}
            </div>
          </form>
          {actionError && <p className="exp-a-inline-error" role="alert">{actionError}</p>}
        </section>
      </div>
    )
  }

  const deliveryFiles = submitted.filter((file) => (delivery.fileIds || []).includes(file.id))
  return (
    <div className="exp-a-overview">
      <section className="exp-a-card" data-attn="none">
        <div className="exp-a-card-head">
          <h4>Delivered</h4>
          <span className="exp-a-row-badge" data-level="ok">PACKAGE V{delivery.version}</span>
        </div>
        <p className="exp-a-card-lead">
          {`Package v${delivery.version} delivered ${formatAssignmentTime(delivery.deliveredAt)}.`}
          {delivery.note ? ` “${delivery.note}”` : ''}
        </p>
        <dl className="exp-a-facts exp-a-facts--grid">
          <div>
            <dt>Delivered</dt>
            <dd>{formatAssignmentStamp(delivery.deliveredAt)}</dd>
          </div>
          <div>
            <dt>Quality review</dt>
            <dd>{qaLabel(qa.state)}</dd>
          </div>
          <div>
            <dt>Package</dt>
            <dd>{deliveryFiles.length || delivery.fileIds?.length || 0} file{(deliveryFiles.length || delivery.fileIds?.length || 0) === 1 ? '' : 's'}</dd>
          </div>
          <div>
            <dt>Cycles</dt>
            <dd>{qa.cycle}</dd>
          </div>
        </dl>
        {deliveryFiles.length > 0 && (
          <ul className="exp-a-package-list">
            {deliveryFiles.map((file) => (
              <li key={file.id}>
                <Paperclip size={14} />
                {file.name}
                <small>{formatFileSize(file.size)}</small>
              </li>
            ))}
          </ul>
        )}
        <div className="exp-a-card-actions">
          {confirming === 'revision' ? (
            <span className="exp-a-confirm-group">
              <button type="button" className="exp-button exp-button--secondary" onClick={() => setConfirming(null)} disabled={busy}>Cancel</button>
              <button type="button" className="exp-button" disabled={busy} onClick={() => finish(onBeginRevision())}>
                {busy ? <Loader2 className="exp-a-spin" size={15} /> : <RefreshCw size={15} />}
                Confirm revision
              </button>
            </span>
          ) : (
            <button type="button" className="exp-button exp-button--secondary" disabled={busy} onClick={() => setConfirming('revision')}>
              <RefreshCw size={15} />
              Start a revision
            </button>
          )}
        </div>
        {actionError && <p className="exp-a-inline-error" role="alert">{actionError}</p>}
        <p className="exp-a-footnote">Revisions reopen the assignment: work resumes, quality review runs again, and a new package version is delivered.</p>
      </section>
    </div>
  )
}

function workStateLabel(state) {
  const labels = {
    assigned: 'Assigned',
    needs_review: 'Needs review',
    working: 'Working',
    waiting_clarification: 'Waiting for clarification',
    ready_for_qa: 'Ready for QA',
    qa_review: 'QA review',
    changes_requested: 'Changes requested',
    ready_to_deliver: 'Ready to deliver',
    delivered: 'Delivered',
  }
  return labels[state] || 'Assigned'
}

function PanelSkeleton() {
  return (
    <div className="exp-a-panel-skeleton" aria-hidden="true">
      <span />
      <span />
      <span />
      <span />
      <span />
    </div>
  )
}

function ErrorScreen({ onRetry, onBack }) {
  return (
    <div className="exp-empty">
      <span className="exp-empty-icon" aria-hidden="true"><Clock3 size={22} /></span>
      <p className="exp-empty-title">Could not open this assignment</p>
      <p className="exp-empty-body">The workspace data failed to load. Try again, or return to the ledger.</p>
      <div className="exp-a-card-actions">
        <button type="button" className="exp-button" onClick={onRetry}>Try again</button>
        <button type="button" className="exp-button exp-button--ghost" onClick={onBack}>Back to assignments</button>
      </div>
    </div>
  )
}

export function ExpertAssignmentWorkspace({ assignmentId, initialTab = 'overview' }) {
  const workspace = useAssignmentWorkspace(assignmentId, initialTab)
  const [toast, setToast] = useState(null)
  const lastReload = useRef(0)
  const { setTab } = workspace

  const qaFlow = useQaDeliveryWorkflow(assignmentId, { onChanged: () => workspace.reload() })

  useEffect(() => {
    setTab(initialTab)
  }, [initialTab, setTab])

  useEffect(() => {
    if (!toast) return undefined
    const timer = window.setTimeout(() => setToast(null), 3400)
    return () => window.clearTimeout(timer)
  }, [toast])

  const notify = useCallback((title, body) => setToast({ title, body }), [])

  const softReload = useCallback(() => {
    const stamp = Date.now()
    if (stamp - lastReload.current < 500) return
    lastReload.current = stamp
    workspace.reload()
    qaFlow.reload()
  }, [workspace, qaFlow])

  useAssignmentRealtime({
    onAssignmentChanged: softReload,
    onMessage: () => workspace.reload(),
    onQaUpdate: () => {
      qaFlow.reload()
      workspace.reload()
    },
  })

  const goTab = (tab) => goExpert(buildExpertAssignmentRoute({ assignmentId, tab }))
  const assignment = workspace.data.overview
  const failed = Boolean(workspace.error) && !assignment

  const perform = async (outcome, title, body) => {
    if (outcome.ok) {
      if (title) notify(title, body || null)
      return true
    }
    if (outcome.error) notify('ACTION FAILED', errorText(outcome.error))
    return false
  }

  const counts = assignment?.workspace?.counts || {}
  const badges = {
    messages: counts.unreadMessages || 0,
    files: 0,
    qa: qaFlow.openFeedbackCount || 0,
  }

  return (
    <div className="exp-section exp-a-ws">
      <AssignmentWorkspaceHeader
        assignment={assignment}
        loading={workspace.loading && !assignment}
        onBack={() => goExpert('/expert/assignments')}
      />

      {failed && <ErrorScreen onRetry={workspace.retry} onBack={() => goExpert('/expert/assignments')} />}

      {workspace.loading && !assignment && !failed && <ExpertAssignmentsSkeletons rows={4} />}

      {assignment && (
        <>
          <AssignmentAttentionBar
            assignment={assignment}
            qaState={qaFlow.qa?.state || assignment.workspace?.qa?.state}
            revisionActive={Boolean(qaFlow.revision?.active)}
            onGoTab={goTab}
          />
          <WorkspaceTabs tab={workspace.tab} onGoTab={goTab} badges={badges} />

          <div className="exp-a-ws-panel">
            {workspace.tab === 'overview' && (
              <AssignmentOverviewPanel
                assignment={assignment}
                qa={qaFlow.qa}
                delivery={qaFlow.delivery}
                revision={qaFlow.revision}
                onGoTab={goTab}
              />
            )}
            {workspace.tab === 'requirements' && (
              <AssignmentRequirementsPanel requirements={workspace.data.requirements} assignment={assignment} />
            )}
            {workspace.tab === 'work' && (
              <AssignmentWorkPanel
                work={workspace.data.work}
                assignment={assignment}
                qaState={qaFlow.qa?.state || assignment.workspace?.qa?.state}
                action={workspace.action}
                onUpdate={async (body) => {
                  const ok = await perform(
                    await workspace.actions.addUpdate(body),
                    'UPDATE POSTED',
                    'Your progress update is on the record.',
                  )
                  return { ok }
                }}
                onSetState={async (state) => {
                  await perform(
                    await workspace.actions.setWorkState(state),
                    'WORK STATE UPDATED',
                    `Assignment marked as ${workStateLabel(state).toLowerCase()}.`,
                  )
                }}
              />
            )}
            {workspace.tab === 'messages' && (
              <AssignmentMessagesPanel
                messages={workspace.data.messages?.messages || []}
                unread={workspace.data.messages?.unread || 0}
                busy={workspace.action.busy && workspace.action.kind === 'message'}
                error={workspace.action.kind === 'message' ? workspace.action.error : null}
                onSend={async (body) => {
                  const ok = await perform(
                    await workspace.actions.sendMessage(body),
                    'MESSAGE SENT',
                    'SolveNest received your message.',
                  )
                  return { ok }
                }}
                onRead={workspace.actions.markMessagesRead}
              />
            )}
            {workspace.tab === 'files' && (
              <AssignmentFilesPanel
                files={workspace.data.files}
                action={workspace.action}
                closed={assignment.workState === 'delivered' && !assignment.workspace?.revision?.active}
                onUpload={workspace.actions.uploadFile}
                onRemove={workspace.actions.removeFile}
                onNotifyError={(text) => notify('ACTION FAILED', text)}
              />
            )}
            {workspace.tab === 'qa' && (
              <AssignmentQaDeliveryPanel
                flow={qaFlow}
                onSubmit={(note) => qaFlow.actions.submit(note).then((outcome) => {
                  perform(outcome, 'SUBMITTED FOR QA', 'Quality review has started on your package.')
                  return outcome
                })}
                onResolve={(feedbackId) => qaFlow.actions.resolveFeedback(feedbackId).then((outcome) => {
                  perform(outcome, 'FEEDBACK RESOLVED', 'The feedback item is marked resolved.')
                  return outcome
                })}
                onResubmit={(note) => qaFlow.actions.resubmit(note).then((outcome) => {
                  perform(outcome, 'RESUBMITTED FOR QA', 'Quality review has started on the new cycle.')
                  return outcome
                })}
                onDeliver={(note) => qaFlow.actions.deliver(note).then((outcome) => {
                  perform(outcome, 'DELIVERY SUBMITTED', 'Your package has been delivered.')
                  return outcome
                })}
                onBeginRevision={() => qaFlow.actions.beginRevision().then((outcome) => {
                  perform(outcome, 'REVISION STARTED', 'Work has reopened for the revision cycle.')
                  return outcome
                })}
              />
            )}
          </div>
        </>
      )}

      {toast && (
        <div className="exp-toast" role="status">
          <strong>{toast.title}</strong>
          <small>{toast.body}</small>
        </div>
      )}
    </div>
  )
}
