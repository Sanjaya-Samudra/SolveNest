import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock,
  CreditCard,
  Download,
  FileText,
  HelpCircle,
  Lock,
  RefreshCw,
  Unlock,
} from 'lucide-react'
import {
  FUNDING_FILTERS,
  HISTORY_FILTERS,
  MILESTONE_STATE_LABELS,
  PAYMENT_STATUS_LABELS,
  fetchPaymentRecord,
  fetchReceipt,
  filterPaymentHistory,
  filterTaskFundingSummaries,
  formatCurrency,
  formatCurrencyShort,
  formatDate,
  formatRelativeTime,
  parsePaymentsUrlState,
  resolveCurrentMilestone,
  resolveOfficialPlanDisplayState,
  resolvePaymentAction,
  resolveStudentFundingState,
  syncPaymentsUrlState,
  useFundingFocus,
  useFundingStructure,
  useOfficialPlan,
  usePaymentCheckout,
  usePaymentHistory,
  usePaymentRealtime,
  usePaymentStatusPolling,
  useScopeChange,
  useTaskFundingNavigator,
} from '../../student/studentPaymentsData.js'

const SECTION_LABELS = {
  plan: 'Official Plan',
  funding: 'Standard Funding',
  milestones: 'Milestone Funding',
  history: 'Payment History',
  'scope-change': 'Scope Change',
}

function EmptyState({ icon, title, body, action }) {
  return (
    <div className="sn-pay-empty" role="status">
      <span className="sn-pay-empty__icon" aria-hidden="true">{icon}</span>
      <p className="sn-pay-empty__title">{title}</p>
      {body ? <p className="sn-pay-empty__body">{body}</p> : null}
      {action}
    </div>
  )
}

function LoadingRows({ count = 4, label = 'Loading…' }) {
  return (
    <div className="sn-pay-loading" role="status" aria-live="polite">
      <span className="sn-visually-hidden">{label}</span>
      {Array.from({ length: count }, (_, i) => (
        <span className="sn-pay-loading__bar" key={i} />
      ))}
    </div>
  )
}

function ErrorBanner({ message, onRetry }) {
  return (
    <div className="sn-pay-error" role="alert">
      <AlertTriangle size={16} aria-hidden="true" />
      <span>{message}</span>
      {onRetry ? (
        <button type="button" className="student-button student-button--secondary student-button--sm" onClick={onRetry}>
          <RefreshCw size={14} aria-hidden="true" />
          Retry
        </button>
      ) : null}
    </div>
  )
}

function StatusPill({ tone = 'muted', children }) {
  return <span className={`sn-pay-pill sn-pay-pill--${tone}`}>{children}</span>
}

function ConfirmDialog({ open, title, body, confirmLabel = 'Confirm', tone = 'primary', busy, onCancel, onConfirm }) {
  const confirmRef = useRef(null)
  useEffect(() => {
    if (open && confirmRef.current) confirmRef.current.focus()
  }, [open])
  if (!open) return null
  return (
    <div className="sn-pay-dialog" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel?.() }}>
      <div className="sn-pay-dialog__panel" role="alertdialog" aria-modal="true" aria-labelledby="sn-pay-dialog-title">
        <h3 id="sn-pay-dialog-title" className="sn-pay-dialog__title">{title}</h3>
        <div className="sn-pay-dialog__body">{body}</div>
        <div className="sn-pay-dialog__actions">
          <button type="button" className="student-button student-button--secondary" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button
            ref={confirmRef}
            type="button"
            className={`student-button student-button--${tone}`}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

function PaymentHelpLink() {
  return (
    <a className="sn-pay-help" href="/student/help?topic=payments">
      <HelpCircle size={14} aria-hidden="true" />
      Need help with funding?
    </a>
  )
}

function StudentFundingFocus({ focus, planState, onAct, busy }) {
  if (!focus) return null
  const fs = resolveStudentFundingState(focus)
  const action = resolvePaymentAction(focus)
  const due = focus.amountDue != null ? focus.amountDue : focus.funding?.amountDue
  const currency = focus.currency || 'LKR'
  const planDisplay = focus.plan ? resolveOfficialPlanDisplayState({ status: focus.plan.status }) : null

  return (
    <section className="sn-pay-focus" aria-label="Funding focus">
      <div className="sn-pay-focus__meta">
        <span className="student-overline">Funding Focus</span>
        <span className="sn-pay-focus__task">{focus.task.title}</span>
        <span className="sn-pay-focus__ref">
          {focus.task.reference ? `${focus.task.reference}` : focus.task.subject || focus.task.status}
        </span>
      </div>
      <div className="sn-pay-focus__states">
        <div className="sn-pay-focus__state">
          <span className="sn-pay-focus__state-label">Plan</span>
          <StatusPill tone={planDisplay?.tone === 'attention' ? 'attention' : 'success'}>{fs.plan}</StatusPill>
        </div>
        <div className="sn-pay-focus__state">
          <span className="sn-pay-focus__state-label">Funding</span>
          <StatusPill tone={fs.tone === 'attention' ? 'attention' : fs.tone === 'success' ? 'success' : fs.tone === 'danger' ? 'danger' : 'muted'}>
            {fs.funding}
          </StatusPill>
        </div>
        <div className="sn-pay-focus__state">
          <span className="sn-pay-focus__state-label">Work</span>
          <StatusPill tone={fs.work.includes('PROGRESS') || fs.work.includes('DELIVERED') || fs.work.includes('STARTING') ? 'success' : 'muted'}>
            <Lock size={12} aria-hidden="true" style={{ display: fs.work.includes('LOCKED') ? 'inline' : 'none' }} />
            <Unlock size={12} aria-hidden="true" style={{ display: fs.work.includes('LOCKED') ? 'none' : 'inline' }} />
            {fs.work}
          </StatusPill>
        </div>
      </div>
      <div className="sn-pay-focus__amount">
        <span className="sn-pay-focus__amount-label">{due > 0 ? 'Amount due' : 'Funded amount'}</span>
        <span className="sn-pay-focus__amount-value">
          {formatCurrency(due > 0 ? due : focus.amountPaid ?? focus.funding?.amountTotal ?? 0, currency)}
        </span>
        {focus.amountPaid > 0 && due > 0 ? (
          <span className="sn-pay-focus__paid">Paid {formatCurrencyShort(focus.amountPaid, currency)}</span>
        ) : null}
      </div>
      <div className="sn-pay-focus__cta">
        {action.label ? (
          <button
            type="button"
            className="student-button student-button--primary"
            onClick={onAct}
            disabled={busy || action.kind === 'processing'}
          >
            <CreditCard size={16} aria-hidden="true" />
            {busy ? 'Working…' : action.label}
          </button>
        ) : (
          <span className="sn-pay-focus__settled">
            <CheckCircle2 size={16} aria-hidden="true" />
            No payment required
          </span>
        )}
        <PaymentHelpLink />
      </div>
    </section>
  )
}

function TaskPaymentNavigator({ rows, loading, error, search, filter, onSearch, onFilter, onSelect, selectedId, onRetry }) {
  const filters = FUNDING_FILTERS
  if (loading && !rows.length) return <LoadingRows label="Loading tasks…" />
  if (error) return <ErrorBanner message="Could not load tasks needing payment." onRetry={onRetry} />
  if (!rows.length) {
    return (
      <EmptyState
        icon={<FileText size={24} aria-hidden="true" />}
        title="No tasks match this filter"
        body="Adjust the search or filter to find tasks with funding activity."
      />
    )
  }
  return (
    <div className="sn-pay-navigator">
      <div className="sn-pay-navigator__toolbar">
        <label className="sn-pay-navigator__search">
          <span className="sn-visually-hidden">Search tasks</span>
          <input
            type="search"
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Search tasks…"
          />
        </label>
        <div className="sn-pay-navigator__filters" role="tablist" aria-label="Funding filters">
          {filters.map((f) => (
            <button
              key={f.key}
              type="button"
              role="tab"
              aria-selected={filter === f.key}
              className={`sn-pay-navigator__filter ${filter === f.key ? 'is-active' : ''}`}
              onClick={() => onFilter(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>
      <ul className="sn-pay-navigator__list">
        {rows.map((row) => {
          const fs = resolveStudentFundingState(row)
          const action = resolvePaymentAction(row)
          const active = row.id === selectedId
          return (
            <li key={row.id || row.task.id}>
              <button
                type="button"
                className={`sn-pay-navigator__row ${active ? 'is-active' : ''}`}
                onClick={() => onSelect(row.id || row.task.id)}
                aria-current={active ? 'true' : undefined}
              >
                <span className="sn-pay-navigator__row-main">
                  <span className="sn-pay-navigator__row-title">{row.task.title}</span>
                  <span className="sn-pay-navigator__row-sub">
                    {row.task.reference || row.task.subject || row.task.status}
                    {row.task.deadline ? ` · Due ${formatDate(row.task.deadline)}` : ''}
                  </span>
                </span>
                <span className="sn-pay-navigator__row-state">
                  <StatusPill tone={fs.tone === 'attention' ? 'attention' : fs.tone === 'success' ? 'success' : fs.tone === 'danger' ? 'danger' : 'muted'}>
                    {fs.funding}
                  </StatusPill>
                </span>
                <span className="sn-pay-navigator__row-amount">
                  {row.amountDue != null && row.amountDue > 0
                    ? formatCurrency(row.amountDue, row.currency)
                    : row.amountPaid
                      ? formatCurrencyShort(row.amountPaid, row.currency)
                      : '—'}
                </span>
                <span className="sn-pay-navigator__row-action" aria-hidden="true">
                  {action.label ? action.label : 'View'}
                  <ArrowRight size={14} />
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function FundingStatusRail({ states }) {
  if (!states?.length) return null
  return (
    <ol className="sn-pay-rail" aria-label="Funding status">
      {states.map((item, i) => (
        <li key={item.label} className={`sn-pay-rail__step is-${item.tone || 'muted'}`}>
          <span className="sn-pay-rail__dot" aria-hidden="true" />
          <span className="sn-pay-rail__copy">
            <span className="sn-pay-rail__label">{item.label}</span>
            <span className="sn-pay-rail__value">{item.value}</span>
          </span>
          {i < states.length - 1 ? <span className="sn-pay-rail__line" aria-hidden="true" /> : null}
        </li>
      ))}
    </ol>
  )
}

function OfficialPlanDocument({ plan, displayState, onAccept, accepting, canAccept }) {
  if (!plan) {
    return (
      <EmptyState
        icon={<FileText size={24} aria-hidden="true" />}
        title="No official plan yet"
        body="An official plan will appear here once your tutor finalises the scope and quote."
      />
    )
  }
  return (
    <article className="sn-pay-plan" aria-label="Official plan">
      <header className="sn-pay-plan__header">
        <div>
          <span className="student-overline">Official Plan</span>
          <h3 className="sn-pay-plan__title">{plan.title || plan.taskTitle || 'Scope & delivery plan'}</h3>
          {plan.reference ? <p className="sn-pay-plan__ref">{plan.reference}</p> : null}
        </div>
        <div className="sn-pay-plan__badges">
          <StatusPill tone={displayState.tone === 'attention' ? 'attention' : displayState.tone === 'success' ? 'success' : 'muted'}>
            {displayState.label || plan.statusLabel}
          </StatusPill>
          {plan.issuedAt ? <span className="sn-pay-plan__issued">Issued {formatRelativeTime(plan.issuedAt)}</span> : null}
        </div>
      </header>
      <dl className="sn-pay-plan__grid">
        <div>
          <dt>Scope</dt>
          <dd>{plan.scope || '—'}</dd>
        </div>
        {plan.excluded ? (
          <div>
            <dt>Not included</dt>
            <dd>{plan.excluded}</dd>
          </div>
        ) : null}
        <div>
          <dt>Delivery</dt>
          <dd>{formatDate(plan.delivery) || plan.delivery || '—'}</dd>
        </div>
        <div>
          <dt>Revisions</dt>
          <dd>{plan.revisionAllowance != null ? String(plan.revisionAllowance) : '—'}</dd>
        </div>
        <div>
          <dt>Plan price</dt>
          <dd className="sn-pay-plan__price">{formatCurrency(plan.price, plan.currency)}</dd>
        </div>
        {plan.expiresAt ? (
          <div>
            <dt>Valid until</dt>
            <dd>{formatDate(plan.expiresAt)}</dd>
          </div>
        ) : null}
        {plan.estimate ? (
          <div>
            <dt>Estimated effort</dt>
            <dd>
              {plan.estimate.label
                || (plan.estimate.low != null && plan.estimate.high != null
                  ? `${formatCurrencyShort(plan.estimate.low, plan.currency)} – ${formatCurrencyShort(plan.estimate.high, plan.currency)}`
                  : '—')}
            </dd>
          </div>
        ) : null}
        {plan.acceptedAt ? (
          <div>
            <dt>Accepted</dt>
            <dd>{formatDate(plan.acceptedAt)}</dd>
          </div>
        ) : null}
      </dl>
      <footer className="sn-pay-plan__footer">
        <PaymentHelpLink />
        {canAccept && (plan.canAccept || displayState.canAccept) ? (
          <button type="button" className="student-button student-button--primary" onClick={onAccept} disabled={accepting}>
            <CheckCircle2 size={16} aria-hidden="true" />
            {accepting ? 'Accepting…' : 'Accept Plan'}
          </button>
        ) : null}
      </footer>
    </article>
  )
}

function PaymentCheckoutSummary({ structure, currency, onStart, busy, mode }) {
  if (!structure) return null
  const total = structure.amountTotal ?? structure.amountDue
  const funded = structure.amountFunded
  const remaining = structure.amountDue
  return (
    <section className="sn-pay-checkout" aria-label="Checkout summary">
      <span className="student-overline">{mode === 'milestone' ? 'Next milestone funding' : 'Standard funding'}</span>
      <div className="sn-pay-checkout__row">
        <span>{structure.workStateLabel || (structure.workLocked ? 'Work locked until funded' : 'Plan confirmed')}</span>
        <strong>{structure.model === 'milestone' ? 'Milestone funding' : 'Full funding'}</strong>
      </div>
      <div className="sn-pay-checkout__amounts">
        <div>
          <span className="sn-pay-checkout__label">Plan total</span>
          <span className="sn-pay-checkout__value">{formatCurrency(total, currency)}</span>
        </div>
        <div>
          <span className="sn-pay-checkout__label">Funded</span>
          <span className="sn-pay-checkout__value">{formatCurrency(funded ?? 0, currency)}</span>
        </div>
        <div className="sn-pay-checkout__due">
          <span className="sn-pay-checkout__label">Due now</span>
          <span className="sn-pay-checkout__value">{formatCurrency(remaining ?? 0, currency)}</span>
        </div>
      </div>
      {structure.afterFunding ? <p className="sn-pay-checkout__note">{structure.afterFunding}</p> : null}
      <div className="sn-pay-checkout__cta">
        <button
          type="button"
          className="student-button student-button--primary"
          onClick={onStart}
          disabled={busy || (remaining != null && remaining <= 0) || !structure.providerAvailable}
        >
          <CreditCard size={16} aria-hidden="true" />
          {busy ? 'Preparing…' : 'Make Payment'}
        </button>
        {!structure.providerAvailable ? (
          <span className="sn-pay-checkout__unavailable">Online payment is not available yet. Your tutor will confirm alternate funding options.</span>
        ) : null}
      </div>
    </section>
  )
}

function MilestoneFundingTrack({ structure, currency, currentMilestoneId, onFund, busy }) {
  if (!structure?.milestones?.length) {
    return (
      <EmptyState
        icon={<FileText size={24} aria-hidden="true" />}
        title="No milestone plan"
        body="This task uses standard funding, not milestone funding."
      />
    )
  }
  return (
    <ol className="sn-pay-milestones" aria-label="Milestone funding track">
      {structure.milestones.map((ms) => {
        const stateLabel = MILESTONE_STATE_LABELS[String(ms.fundingState).toLowerCase()] || ms.fundingState
        const isCurrent = ms.id === currentMilestoneId || String(ms.fundingState).toLowerCase() === 'payment_required'
        const funded = ['funded', 'paid'].includes(String(ms.fundingState).toLowerCase())
        return (
          <li key={ms.id} className={`sn-pay-milestone ${funded ? 'is-funded' : ''} ${isCurrent ? 'is-current' : ''}`}>
            <div className="sn-pay-milestone__seq">{String(ms.sequence).padStart(2, '0')}</div>
            <div className="sn-pay-milestone__main">
              <span className="sn-pay-milestone__name">{ms.name}</span>
              {ms.scope ? <span className="sn-pay-milestone__scope">{ms.scope}</span> : null}
              {ms.paidAt ? <span className="sn-pay-milestone__paid">Funded {formatDate(ms.paidAt)}</span> : null}
            </div>
            <div className="sn-pay-milestone__side">
              <span className="sn-pay-milestone__amount">{formatCurrency(ms.amount, ms.currency || currency)}</span>
              <StatusPill tone={funded ? 'success' : isCurrent ? 'attention' : 'muted'}>{stateLabel}</StatusPill>
              {isCurrent && !funded ? (
                <button
                  type="button"
                  className="student-button student-button--primary student-button--sm"
                  onClick={() => onFund(ms)}
                  disabled={busy}
                >
                  {busy ? 'Preparing…' : 'Fund Milestone'}
                </button>
              ) : null}
            </div>
          </li>
        )
      })}
    </ol>
  )
}

function StandardFundingFlow({ structure, currency, onStart, busy }) {
  if (!structure) {
    return (
      <EmptyState
        icon={<CreditCard size={24} aria-hidden="true" />}
        title="Funding details unavailable"
        body="Open a task to review its funding plan."
      />
    )
  }
  const steps = [
    { label: 'Plan confirmed', done: structure.planConfirmed },
    { label: 'Awaiting funding', done: (structure.amountDue ?? 0) > 0 ? false : true },
    { label: structure.workLocked ? 'Work locked' : 'Work unlocked', done: !structure.workLocked },
  ]
  return (
    <div className="sn-pay-standard">
      <ol className="sn-pay-standard__steps" aria-label="Standard funding steps">
        {steps.map((s, i) => (
          <li key={s.label} className={s.done ? 'is-done' : 'is-current'}>
            <span className="sn-pay-standard__num">{i + 1}</span>
            <span>{s.label}</span>
          </li>
        ))}
      </ol>
      <PaymentCheckoutSummary structure={structure} currency={currency} onStart={onStart} busy={busy} mode="full" />
    </div>
  )
}

function PaymentReturnStates({ status, record, onRetry, onDismiss }) {
  if (!status) return null
  const amount = record?.amount != null ? formatCurrency(record.amount, record.currency) : null
  const tone = status === 'succeeded' || status === 'paid' ? 'success' : status === 'failed' || status === 'canceled' ? 'danger' : 'attention'
  const title = {
    succeeded: 'Payment successful',
    paid: 'Payment successful',
    processing: 'Payment processing',
    pending: 'Payment processing',
    requires_action: 'Action required',
    failed: 'Payment failed',
    canceled: 'Payment cancelled',
    cancelled: 'Payment cancelled',
    refunded: 'Payment refunded',
  }[status] || PAYMENT_STATUS_LABELS[status] || 'Payment update'
  const body = {
    succeeded: `Your payment of ${amount ?? ''} was received. Work can now proceed.`.trim(),
    paid: `Your payment of ${amount ?? ''} was received. Work can now proceed.`.trim(),
    processing: 'We are confirming this payment with the provider. This page will update automatically.',
    pending: 'We are confirming this payment with the provider. This page will update automatically.',
    requires_action: 'The payment provider needs one more step from you before it can complete.',
    failed: record?.failureReason || 'The payment could not be completed. No charge was confirmed.',
    canceled: 'You cancelled this payment before it completed.',
    cancelled: 'You cancelled this payment before it completed.',
    refunded: 'This payment was refunded.',
  }[status] || 'Status update from payment provider.'
  return (
    <div className={`sn-pay-return sn-pay-return--${tone}`} role="status" aria-live="polite">
      <span className="sn-pay-return__icon" aria-hidden="true">
        {tone === 'success' ? <CheckCircle2 size={20} /> : tone === 'danger' ? <AlertTriangle size={20} /> : <Clock size={20} />}
      </span>
      <div className="sn-pay-return__text">
        <strong>{title}</strong>
        <span>{body}</span>
        {record?.reference ? <span className="sn-pay-return__ref">Ref {record.reference}</span> : null}
      </div>
      <div className="sn-pay-return__actions">
        {status === 'failed' || status === 'canceled' || status === 'cancelled' ? (
          <button type="button" className="student-button student-button--secondary student-button--sm" onClick={onRetry}>
            Try Again
          </button>
        ) : null}
        <button type="button" className="student-button student-button--secondary student-button--sm" onClick={onDismiss}>
          Dismiss
        </button>
      </div>
    </div>
  )
}

function PaymentHistoryLedger({ rows, loading, error, search, filter, onSearch, onFilter, onSelect, selectedId, onRetry, taskOnly }) {
  if (loading && !rows.length) return <LoadingRows label="Loading payment history…" />
  if (error) return <ErrorBanner message="Could not load payment history." onRetry={onRetry} />
  if (!rows.length) {
    return (
      <EmptyState
        icon={<Clock size={24} aria-hidden="true" />}
        title={taskOnly ? 'No payments for this task yet' : 'No payment history yet'}
        body={taskOnly ? 'Completed funding for this task will be listed here.' : 'Completed and processing payments will be listed here.'}
      />
    )
  }
  return (
    <div className="sn-pay-history">
      {!taskOnly ? (
        <div className="sn-pay-history__toolbar">
          <label className="sn-pay-navigator__search">
            <span className="sn-visually-hidden">Search payments</span>
            <input type="search" value={search} onChange={(e) => onSearch(e.target.value)} placeholder="Search payments…" />
          </label>
          <div className="sn-pay-navigator__filters" role="tablist" aria-label="History filters">
            {HISTORY_FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                role="tab"
                aria-selected={filter === f.key}
                className={`sn-pay-navigator__filter ${filter === f.key ? 'is-active' : ''}`}
                onClick={() => onFilter(f.key)}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      <table className="sn-pay-ledger">
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">{taskOnly ? 'Milestone' : 'Task'}</th>
            <th scope="col">Type</th>
            <th scope="col">Amount</th>
            <th scope="col">Status</th>
            <th scope="col"><span className="sn-visually-hidden">Open</span></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className={row.id === selectedId ? 'is-active' : ''}>
              <td>{formatDate(row.paidAt || row.createdAt)}</td>
              <td>{taskOnly ? row.milestoneName || row.type : row.taskTitle}</td>
              <td>{row.type}</td>
              <td>{formatCurrency(row.amount, row.currency)}</td>
              <td>
                <StatusPill tone={['succeeded', 'paid'].includes(row.status) ? 'success' : ['failed', 'canceled', 'cancelled'].includes(row.status) ? 'danger' : ['refunded', 'partially_refunded'].includes(row.status) ? 'muted' : 'attention'}>
                  {row.statusLabel}
                </StatusPill>
              </td>
              <td>
                <button type="button" className="sn-pay-ledger__open" onClick={() => onSelect(row)} aria-label={`Open payment ${row.reference || row.id}`}>
                  <ArrowRight size={14} aria-hidden="true" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function PaymentRecordInspector({ record, onDownload, downloading, onBack, taskOnly }) {
  if (!record) {
    return (
      <EmptyState
        icon={<FileText size={24} aria-hidden="true" />}
        title="Select a payment"
        body="Choose a row in the ledger to inspect its record and receipt."
      />
    )
  }
  return (
    <article className="sn-pay-record" aria-label="Payment record">
      <header className="sn-pay-record__header">
        {taskOnly ? (
          <button type="button" className="student-button student-button--secondary student-button--sm sn-pay-record__back" onClick={onBack}>
            <ArrowLeft size={14} aria-hidden="true" />
            Back
          </button>
        ) : null}
        <div>
          <span className="student-overline">Payment Record</span>
          <h3 className="sn-pay-record__title">{record.taskTitle}</h3>
        </div>
        <StatusPill tone={['succeeded', 'paid'].includes(record.status) ? 'success' : ['failed', 'canceled', 'cancelled'].includes(record.status) ? 'danger' : 'attention'}>
          {record.statusLabel}
        </StatusPill>
      </header>
      <dl className="sn-pay-record__grid">
        <div>
          <dt>Payment ID</dt>
          <dd>{record.id}</dd>
        </div>
        {record.reference ? (
          <div>
            <dt>Reference</dt>
            <dd>{record.reference}</dd>
          </div>
        ) : null}
        <div>
          <dt>Amount</dt>
          <dd>{formatCurrency(record.amount, record.currency)}</dd>
        </div>
        <div>
          <dt>Type</dt>
          <dd>{record.type}{record.milestoneName ? ` · ${record.milestoneName}` : ''}</dd>
        </div>
        <div>
          <dt>Date</dt>
          <dd>{formatDate(record.paidAt || record.createdAt) || '—'}</dd>
        </div>
        {record.provider ? (
          <div>
            <dt>Provider</dt>
            <dd>{record.provider}</dd>
          </div>
        ) : null}
        {record.refundAmount != null ? (
          <div>
            <dt>Refunded</dt>
            <dd>{formatCurrency(record.refundAmount, record.currency)}</dd>
          </div>
        ) : null}
        {record.failureReason ? (
          <div>
            <dt>Failure reason</dt>
            <dd>{record.failureReason}</dd>
          </div>
        ) : null}
      </dl>
      <footer className="sn-pay-record__footer">
        {record.hasReceipt || record.receiptUrl ? (
          <button type="button" className="student-button student-button--secondary" onClick={onDownload} disabled={downloading}>
            <Download size={16} aria-hidden="true" />
            {downloading ? 'Preparing…' : 'Download Receipt'}
          </button>
        ) : (
          <span className="sn-pay-record__no-receipt">Receipt unavailable until payment is confirmed.</span>
        )}
        <PaymentHelpLink />
      </footer>
    </article>
  )
}

function ScopeChangePanel({ change, onAccept, accepting }) {
  if (!change) {
    return (
      <EmptyState
        icon={<AlertTriangle size={24} aria-hidden="true" />}
        title="No pending scope change"
        body="If your tutor requests a scope revision, the comparison will appear here."
      />
    )
  }
  const currency = change.currency
  return (
    <section className="sn-pay-scope" aria-label="Scope change">
      <header className="sn-pay-scope__header">
        <span className="student-overline">Scope Change</span>
        <StatusPill tone={change.canAccept ? 'attention' : 'muted'}>
          {change.status === 'requested' ? 'Awaiting your acceptance' : change.status}
        </StatusPill>
      </header>
      {change.reason ? <p className="sn-pay-scope__reason">{change.reason}</p> : null}
      <div className="sn-pay-scope__compare">
        <div className="sn-pay-scope__col">
          <h4>Previous</h4>
          <p>{change.original.scope || '—'}</p>
          <p className="sn-pay-scope__price">{change.original.price != null ? formatCurrency(change.original.price, currency) : '—'}</p>
          <p className="sn-pay-scope__delivery">{formatDate(change.original.delivery) || change.original.delivery || '—'}</p>
        </div>
        <ArrowRight className="sn-pay-scope__arrow" size={20} aria-hidden="true" />
        <div className="sn-pay-scope__col sn-pay-scope__col--next">
          <h4>Revised</h4>
          <p>{change.requested.scope || '—'}</p>
          <p className="sn-pay-scope__price">
            {change.requested.priceDelta != null
              ? `${change.requested.priceDelta >= 0 ? '+' : ''}${formatCurrency(change.requested.priceDelta, currency)}`
              : change.newTotal != null
                ? formatCurrency(change.newTotal, currency)
                : '—'}
          </p>
          <p className="sn-pay-scope__delivery">{change.requested.deliveryDelta || '—'}</p>
        </div>
      </div>
      {change.canAccept ? (
        <div className="sn-pay-scope__actions">
          <button type="button" className="student-button student-button--primary" onClick={onAccept} disabled={accepting}>
            <CheckCircle2 size={16} aria-hidden="true" />
            {accepting ? 'Accepting…' : 'Accept Revised Plan'}
          </button>
          <PaymentHelpLink />
        </div>
      ) : null}
    </section>
  )
}

function PaymentsEmptyStates({ type, onCreateTask }) {
  const map = {
    'no-tasks': {
      icon: <FileText size={24} />,
      title: 'No tasks yet',
      body: 'Create your first task to receive an official plan and funding options.',
    },
    'no-payments': {
      icon: <CreditCard size={24} />,
      title: 'No payments yet',
      body: 'Your funding history will appear here once a plan is accepted.',
    },
    'plan-missing': {
      icon: <FileText size={24} />,
      title: 'No official plan',
      body: 'Your tutor has not published an official plan for this task yet.',
    },
    unavailable: {
      icon: <AlertTriangle size={24} />,
      title: 'Payment unavailable',
      body: 'Online payment is not connected yet. Contact support or your tutor to settle funding.',
    },
  }
  const item = map[type] || map['no-payments']
  return (
    <EmptyState
      icon={item.icon}
      title={item.title}
      body={item.body}
      action={type === 'no-tasks' && onCreateTask ? (
        <a className="student-button student-button--primary" href="/student/tasks">Create a task</a>
      ) : null}
    />
  )
}

export default function StudentPaymentsPage() {
  const urlState = useRef(parsePaymentsUrlState()).current
  const [viewState, setViewState] = useState({
    taskId: urlState.taskId,
    section: urlState.section,
    paymentId: urlState.paymentId,
    search: urlState.search,
    filter: 'all',
    historySearch: '',
    historyFilter: 'all',
    selectedPaymentId: urlState.paymentId,
    returnStatus: null,
    mobileDetail: Boolean(urlState.taskId || urlState.paymentId || urlState.section),
  })
  const [acceptPlanOpen, setAcceptPlanOpen] = useState(false)
  const [acceptScopeOpen, setAcceptScopeOpen] = useState(false)
  const [receiptBusy, setReceiptBusy] = useState(false)
  const [receiptError, setReceiptError] = useState(null)

  const patch = useCallback((partial) => {
    setViewState((s) => {
      const next = { ...s, ...partial }
      syncPaymentsUrlState({
        taskId: next.taskId,
        section: next.section,
        paymentId: next.selectedPaymentId || next.paymentId,
        search: next.search,
      })
      return next
    })
  }, [])

  const focusQuery = useFundingFocus()
  const tasksQuery = useTaskFundingNavigator({ search: viewState.search, filter: viewState.filter })
  const historyQuery = usePaymentHistory({ search: viewState.historySearch, filter: viewState.historyFilter })
  const planQuery = useOfficialPlan(viewState.taskId)
  const structureQuery = useFundingStructure(viewState.taskId)
  const scopeQuery = useScopeChange(viewState.taskId)
  const checkout = usePaymentCheckout()

  const allTasks = useMemo(() => {
    const base = tasksQuery.data || []
    if (focusQuery.data && !base.some((t) => t.id === focusQuery.data.id)) {
      return [focusQuery.data, ...base]
    }
    return base
  }, [tasksQuery.data, focusQuery.data])

  const visibleTasks = useMemo(
    () => filterTaskFundingSummaries(allTasks, { search: viewState.search, filter: viewState.filter }),
    [allTasks, viewState.search, viewState.filter],
  )

  const selectedTask = useMemo(() => {
    if (viewState.taskId) return allTasks.find((t) => t.id === viewState.taskId) || null
    return null
  }, [allTasks, viewState.taskId])

  const section = viewState.section
    || (selectedTask ? (selectedTask.milestones?.length ? 'milestones' : 'funding') : 'history')

  const planDisplay = planQuery.data ? resolveOfficialPlanDisplayState(planQuery.data) : null
  const currentMs = selectedTask ? resolveCurrentMilestone(selectedTask) : null
  const structure = structureQuery.data || (selectedTask ? mapStructureFallback(selectedTask) : null)

  const historyRows = useMemo(
    () => filterPaymentHistory(historyQuery.data || [], {
      search: viewState.historySearch,
      filter: viewState.historyFilter,
    }),
    [historyQuery.data, viewState.historySearch, viewState.historyFilter],
  )

  const taskHistory = useMemo(() => {
    if (!viewState.taskId) return []
    return historyRows.filter((r) => r.taskId === viewState.taskId)
  }, [historyRows, viewState.taskId])

  const selectedPayment = useMemo(() => {
    const id = viewState.selectedPaymentId
    if (!id) return null
    return historyRows.find((r) => r.id === id) || null
  }, [historyRows, viewState.selectedPaymentId])

  const recordQueryId = viewState.selectedPaymentId && !selectedPayment ? viewState.selectedPaymentId : null
  const [standaloneRecord, setStandaloneRecord] = useState(null)
  useEffect(() => {
    let alive = true
    if (!recordQueryId) {
      setStandaloneRecord(null)
      return undefined
    }
    fetchPaymentRecord(recordQueryId)
      .then((rec) => { if (alive) setStandaloneRecord(rec) })
      .catch(() => { if (alive) setStandaloneRecord(null) })
    return () => { alive = false }
  }, [recordQueryId])

  const inspectorRecord = selectedPayment || standaloneRecord

  const polling = usePaymentStatusPolling(viewState.paymentId || viewState.selectedPaymentId, {
    enabled: Boolean(viewState.paymentId || viewState.selectedPaymentId),
    onStatusChanged: () => {
      tasksQuery.reload()
      historyQuery.reload()
      focusQuery.reload()
      if (structureQuery.data) structureQuery.reload()
    },
  })

  usePaymentRealtime({
    onStatusChanged: () => {
      tasksQuery.reload()
      historyQuery.reload()
      focusQuery.reload()
      structureQuery.reload()
      planQuery.reload()
    },
    onMilestoneFunded: () => {
      structureQuery.reload()
      tasksQuery.reload()
      focusQuery.reload()
    },
    onPlanAccepted: () => {
      planQuery.reload()
      tasksQuery.reload()
      focusQuery.reload()
    },
    onFailure: () => {
      tasksQuery.reload()
      historyQuery.reload()
    },
  })

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const s = params.get('status')
    if (s) patch({ returnStatus: s, paymentId: params.get('payment') || viewState.paymentId })
  }, [])

  useEffect(() => {
    if (polling.record?.status && ['succeeded', 'paid', 'failed', 'canceled', 'cancelled'].includes(polling.record.status)) {
      setViewState((s) => (s.returnStatus ? s : { ...s, returnStatus: polling.record.status }))
    }
  }, [polling.record?.status])

  const railStates = useMemo(() => {
    const fs = selectedTask ? resolveStudentFundingState(selectedTask) : focusQuery.data ? resolveStudentFundingState(focusQuery.data) : null
    if (!fs) return []
    return [
      { label: 'Plan', value: fs.plan, tone: fs.plan.includes('ACCEPTED') || fs.plan.includes('READY') ? 'success' : 'attention' },
      { label: 'Funding', value: fs.funding, tone: fs.tone },
      { label: 'Work', value: fs.work, tone: fs.work.includes('LOCKED') ? 'muted' : 'success' },
    ]
  }, [selectedTask, focusQuery.data])

  const selectTask = useCallback((taskId) => {
    patch({ taskId, mobileDetail: true, section: undefined, selectedPaymentId: null })
    planQuery.reload()
    structureQuery.reload()
    scopeQuery.reload()
  }, [patch, planQuery, structureQuery, scopeQuery])

  const runCheckout = useCallback(async ({ milestoneId } = {}) => {
    const taskId = viewState.taskId || focusQuery.data?.id
    if (!taskId) return
    const result = await checkout.start({
      taskId,
      milestoneId: milestoneId || currentMs?.id || null,
      planId: planQuery.data?.id || null,
    })
    if (result?.checkoutUrl) {
      checkout.handoff()
    }
  }, [viewState.taskId, focusQuery.data, currentMs, planQuery.data, checkout])

  const onPrimaryAct = useCallback(async () => {
    const target = selectedTask || focusQuery.data
    if (!target) return
    const action = resolvePaymentAction(target)
    if (action.kind === 'accept-plan') {
      setAcceptPlanOpen(true)
      return
    }
    if (action.kind === 'review-plan') {
      patch({ taskId: target.id, section: 'plan', mobileDetail: true })
      planQuery.reload()
      return
    }
    if (action.kind === 'pay' || action.kind === 'fund-milestone' || action.kind === 'retry') {
      if (!viewState.taskId) patch({ taskId: target.id, section: 'funding', mobileDetail: true })
      await runCheckout({ milestoneId: action.milestone?.id })
    }
  }, [selectedTask, focusQuery.data, patch, runCheckout, viewState.taskId])

  const confirmAcceptPlan = async () => {
    try {
      await planQuery.accept()
      setAcceptPlanOpen(false)
      tasksQuery.reload()
      focusQuery.reload()
    } catch {}
  }

  const confirmAcceptScope = async () => {
    try {
      await scopeQuery.accept()
      setAcceptScopeOpen(false)
      structureQuery.reload()
      tasksQuery.reload()
    } catch {}
  }

  const downloadReceipt = async () => {
    if (!inspectorRecord?.id) return
    setReceiptBusy(true)
    setReceiptError(null)
    try {
      const receipt = await fetchReceipt(inspectorRecord.id)
      if (receipt?.url) {
        window.open(receipt.url, '_blank', 'noopener,noreferrer')
      } else {
        setReceiptError('Receipt is not available yet.')
      }
    } catch {
      setReceiptError('Could not load receipt. Try again shortly.')
    } finally {
      setReceiptBusy(false)
    }
  }

  const focusTask = focusQuery.data
  const emptyTasks = !tasksQuery.loading && !tasksQuery.error && visibleTasks.length === 0 && !focusTask
  const anyLoading = tasksQuery.loading || focusQuery.loading
  const anyError = tasksQuery.error && !tasksQuery.data ? tasksQuery.error : null

  const nav = (
    <div className="sn-pay__nav-pane">
      <TaskPaymentNavigator
        rows={visibleTasks}
        loading={tasksQuery.loading}
        error={tasksQuery.error}
        search={viewState.search}
        filter={viewState.filter}
        onSearch={(v) => patch({ search: v })}
        onFilter={(v) => patch({ filter: v })}
        onSelect={selectTask}
        selectedId={viewState.taskId}
        onRetry={() => { tasksQuery.reload(); focusQuery.reload() }}
      />
      {emptyTasks ? <PaymentsEmptyStates type="no-tasks" /> : null}
      <PaymentHelpLink />
    </div>
  )

  const detail = (
    <div className="sn-pay__detail-pane">
      <div className="sn-pay__detail-toolbar">
        <button
          type="button"
          className="student-button student-button--secondary student-button--sm sn-pay__back"
          onClick={() => patch({ mobileDetail: false, section: undefined, taskId: null, selectedPaymentId: null })}
        >
          <ArrowLeft size={14} aria-hidden="true" />
          Tasks
        </button>
        <nav className="sn-pay__sections" aria-label="Payments sections">
          {Object.entries(SECTION_LABELS).map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={`sn-pay__section-tab ${section === key ? 'is-active' : ''}`}
              onClick={() => patch({ section: key })}
              aria-current={section === key ? 'page' : undefined}
            >
              {label}
            </button>
          ))}
        </nav>
      </div>

      <div className="sn-pay__detail-body">
      {viewState.returnStatus ? (
        <PaymentReturnStates
          status={polling.record?.status || viewState.returnStatus}
          record={polling.record}
          onRetry={() => runCheckout({})}
          onDismiss={() => patch({ returnStatus: null, paymentId: null, selectedPaymentId: null })}
        />
      ) : null}

      {checkout.status === 'error' ? (
        <ErrorBanner
          message={checkout.error?.unavailable
            ? 'Online payment is not connected yet. Your tutor will confirm alternate funding options.'
            : checkout.error?.message || 'Could not start checkout. Try again.'}
          onRetry={() => runCheckout({})}
        />
      ) : null}

      {anyError ? <ErrorBanner message="Some payment data failed to load." onRetry={() => { tasksQuery.reload(); focusQuery.reload() }} /> : null}

      {section === 'history' || section === 'scope-change' || !railStates.length ? null : (
        <FundingStatusRail states={railStates} />
      )}

      {section === 'plan' ? (
        planQuery.loading ? (
          <LoadingRows label="Loading official plan…" />
        ) : planQuery.error ? (
          <ErrorBanner message="Could not load official plan." onRetry={planQuery.reload} />
        ) : (
          <OfficialPlanDocument
            plan={planQuery.data}
            displayState={planDisplay}
            onAccept={() => setAcceptPlanOpen(true)}
            accepting={planQuery.accepting}
            canAccept={Boolean(viewState.taskId)}
          />
        )
      ) : null}

      {section === 'funding' || section === 'milestones' ? (
        structureQuery.loading ? (
          <LoadingRows label="Loading funding structure…" />
        ) : structureQuery.error && !structure ? (
          <ErrorBanner message="Could not load funding structure." onRetry={structureQuery.reload} />
        ) : !structure ? (
          <PaymentsEmptyStates type="unavailable" />
        ) : structure.model === 'milestone' && section === 'milestones' ? (
          <MilestoneFundingTrack
            structure={structure}
            currency={structure.currency}
            currentMilestoneId={currentMs?.id}
            onFund={(ms) => runCheckout({ milestoneId: ms.id })}
            busy={checkout.busy}
          />
        ) : (
          <StandardFundingFlow
            structure={structure}
            currency={structure.currency}
            onStart={() => runCheckout({})}
            busy={checkout.busy}
          />
        )
      ) : null}

      {section === 'history' ? (
        <div className="sn-pay__history-split">
          <PaymentHistoryLedger
            rows={viewState.taskId ? taskHistory : historyRows}
            loading={historyQuery.loading}
            error={historyQuery.error}
            search={viewState.historySearch}
            filter={viewState.historyFilter}
            onSearch={(v) => patch({ historySearch: v })}
            onFilter={(v) => patch({ historyFilter: v })}
            onSelect={(row) => patch({ selectedPaymentId: row.id, mobileDetail: true })}
            selectedId={viewState.selectedPaymentId}
            onRetry={historyQuery.reload}
            taskOnly={Boolean(viewState.taskId)}
          />
          {!viewState.taskId ? (
            <PaymentRecordInspector
              record={inspectorRecord}
              onDownload={downloadReceipt}
              downloading={receiptBusy}
              onBack={() => patch({ selectedPaymentId: null })}
            />
          ) : null}
          {receiptError ? <ErrorBanner message={receiptError} /> : null}
        </div>
      ) : null}

      {section === 'scope-change' ? (
        scopeQuery.loading ? (
          <LoadingRows label="Loading scope change…" />
        ) : scopeQuery.error ? (
          <ErrorBanner message="Could not load scope change." onRetry={scopeQuery.reload} />
        ) : (
          <ScopeChangePanel
            change={scopeQuery.data}
            onAccept={() => setAcceptScopeOpen(true)}
            accepting={scopeQuery.accepting}
          />
        )
      ) : null}

      {!viewState.taskId && section !== 'history' ? (
        <PaymentsEmptyStates type="no-tasks" />
      ) : null}
      </div>
    </div>
  )

  const planTaskTitle = selectedTask?.task?.title || focusTask?.task?.title || planQuery.data?.taskTitle || 'the selected task'

  return (
    <div className={`sn-pay sn-pay--${viewState.mobileDetail ? 'detail' : 'list'}`}>
      <header className="sn-pay__header">
        <div className="sn-pay__header-text">
          <span className="student-overline">Payments</span>
          <h1 className="sn-pay__title">Funding & payment history</h1>
          <p className="sn-pay__subtitle">
            Review official plans, fund active work, and track every payment record.
          </p>
        </div>
        <div className="sn-pay__header-actions">
          <button
            type="button"
            className="student-button student-button--secondary student-button--sm"
            onClick={() => {
              tasksQuery.reload()
              focusQuery.reload()
              historyQuery.reload()
              if (viewState.taskId) {
                planQuery.reload()
                structureQuery.reload()
                scopeQuery.reload()
              }
            }}
            disabled={anyLoading}
          >
            <RefreshCw size={14} aria-hidden="true" />
            Refresh
          </button>
          <PaymentHelpLink />
        </div>
      </header>

      <StudentFundingFocus
        focus={focusTask}
        planState={planDisplay}
        onAct={onPrimaryAct}
        busy={checkout.busy || planQuery.accepting}
      />

      {anyLoading && !allTasks.length && !focusTask ? <LoadingRows count={3} label="Loading funding…" /> : null}

      <div className="sn-pay__split">
        <aside className="sn-pay__nav">{nav}</aside>
        <section className="sn-pay__detail" aria-label="Payment detail">{detail}</section>
      </div>

      <ConfirmDialog
        open={acceptPlanOpen}
        title="Accept official plan?"
        body={
          <p>
            Accepting the official plan for <strong>{planTaskTitle}</strong>
            {planQuery.data?.price != null
              ? <> at <strong>{formatCurrency(planQuery.data.price, planQuery.data.currency)}</strong></>
              : null}
            {' '}confirms the scope and unlocks funding. This cannot be undone from this screen.
          </p>
        }
        confirmLabel="Accept Plan"
        busy={planQuery.accepting}
        onCancel={() => setAcceptPlanOpen(false)}
        onConfirm={confirmAcceptPlan}
      />

      <ConfirmDialog
        open={acceptScopeOpen}
        title="Accept revised plan?"
        body={
          <p>
            Accepting updates the scope and funding for <strong>{planTaskTitle}</strong>.
            Review the comparison carefully before confirming.
          </p>
        }
        confirmLabel="Accept Revised Plan"
        busy={scopeQuery.accepting}
        onCancel={() => setAcceptScopeOpen(false)}
        onConfirm={confirmAcceptScope}
      />
    </div>
  )
}

function mapStructureFallback(task) {
  if (!task) return null
  const currency = task.currency || 'LKR'
  const total = task.amountPaid != null && task.amountDue != null
    ? task.amountPaid + task.amountDue
    : task.amountDue ?? task.funding?.amountTotal ?? null
  return {
    model: task.model || 'full',
    currency,
    amountDue: task.amountDue,
    amountTotal: total,
    amountFunded: task.amountPaid,
    planConfirmed: ['QUOTE_READY', 'PAYMENT_PENDING', 'PAID', 'ASSIGNMENT_PENDING', 'IN_PROGRESS', 'QUALITY_REVIEW', 'DELIVERED', 'REVISION_REQUESTED', 'REVISION_IN_PROGRESS', 'COMPLETED'].includes(task.task.status)
      || ['accepted'].includes(String(task.plan?.status || '').toLowerCase()),
    workLocked: task.amountDue == null || task.amountDue > 0,
    workStateLabel: null,
    sequence: null,
    explanation: null,
    afterFunding: task.amountDue > 0 ? 'Once funded, your tutor can begin or continue work on this task.' : null,
    providerAvailable: false,
    milestones: task.milestones || [],
    raw: task.funding,
  }
}
