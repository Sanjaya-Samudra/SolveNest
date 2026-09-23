import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dataDir = path.join(__dirname, 'data')
const storePath = path.join(dataDir, 'help-tickets.json')

const categories = [
  { key: 'task', label: 'Task & progress', blurb: 'Status, matching, revisions and where things stand.', needsTask: true, route: '/student/tasks' },
  { key: 'payment', label: 'Payment & official plan', blurb: 'Funding, failed payments, plan changes or receipts.', needsTask: true, route: '/student/payments' },
  { key: 'files', label: 'Files & delivery', blurb: 'Uploads, previews, downloads and delivery versions.', needsTask: true, route: '/student/files' },
  { key: 'messages', label: 'Messages', blurb: 'Talking with your assigned Expert.', needsTask: true, route: '/student/messages' },
  { key: 'explain', label: 'Explain & Defend', blurb: 'Availability, sessions and results.', needsTask: true, route: '/student/explain' },
  { key: 'account', label: 'Account & access', blurb: 'Sign-in, profile and security.', needsTask: false, route: '/student/account' },
  { key: 'technical', label: 'Technical issue', blurb: "Something in the app isn't working as expected.", needsTask: false, route: null },
]

const issues = {
  payment: [
    { key: 'not-showing', label: 'My official plan is not showing' },
    { key: 'price', label: "I don't understand the price" },
    { key: 'processing', label: 'Payment is still processing' },
    { key: 'failed', label: 'Payment failed' },
    { key: 'receipt', label: 'I need a receipt' },
    { key: 'other', label: 'Something else' },
  ],
  files: [
    { key: 'cant-open', label: "I can't open my delivery" },
    { key: 'cant-upload', label: "A file won't upload" },
    { key: 'old-version', label: 'This looks like the wrong version' },
    { key: 'other', label: 'Something else' },
  ],
  task: [
    { key: 'under-review', label: 'Why is my task still under review?' },
    { key: 'not-started', label: "Work hasn't started yet" },
    { key: 'other', label: 'Something else' },
  ],
  messages: [
    { key: 'cant-send', label: "I can't send a message" },
    { key: 'read-only', label: 'My conversation looks read-only' },
    { key: 'other', label: 'Something else' },
  ],
  explain: [
    { key: 'unavailable', label: "Explain & Defend isn't available" },
    { key: 'wont-load', label: "The source won't load" },
    { key: 'other', label: 'Something else' },
  ],
  account: [
    { key: 'password', label: "I can't sign in" },
    { key: 'profile', label: 'I need to update my profile' },
    { key: 'other', label: 'Something else' },
  ],
  technical: [
    { key: 'wont-load', label: "A page won't load" },
    { key: 'upload-fail', label: "A file won't upload" },
    { key: 'payment-page', label: 'Payment page issue' },
    { key: 'other', label: 'Something else' },
  ],
}

const quickHelp = [
  { id: 'qh-review', title: 'Task under review', blurb: 'What each review stage means and how long it usually takes.', category: 'task', issue: 'under-review' },
  { id: 'qh-plan', title: 'Official plan & pricing', blurb: 'How plans are priced and what happens after you pay.', category: 'payment', issue: 'price' },
  { id: 'qh-payment', title: 'Payment problems', blurb: 'Processing, failed payments and receipts.', category: 'payment', issue: 'processing' },
  { id: 'qh-delivery', title: 'Delivery & revisions', blurb: 'What happens after delivery, revisions and scope changes.', category: 'files', issue: 'old-version' },
  { id: 'qh-messages', title: 'Messages & Expert communication', blurb: "How to reach your Expert and what's off-limits.", category: 'messages', issue: 'cant-send' },
  { id: 'qh-account', title: 'Account & sign-in', blurb: 'Password resets and keeping your account secure.', category: 'account', issue: 'password' },
]

const articles = [
  {
    id: 'art-review-stages',
    title: 'Why tasks stay in review',
    keywords: ['review', 'quality', 'task', 'under review', 'stuck'],
    body: 'Quality review is a normal stage before delivery. Your Expert finishes the work, then it is checked against the brief before it is released to you. You will get a notification the moment the status changes. No action is required from you while review is underway.',
    category: 'task',
    issue: 'under-review',
  },
  {
    id: 'art-payment-processing',
    title: 'Payment still processing',
    keywords: ['payment', 'pending', 'processing', 'confirm'],
    body: 'While SolveNest confirms a payment, the status stays Processing. You do not need to submit another payment during this time. Confirmation usually completes on its own; if it stays in this state, contact support with the task attached.',
    category: 'payment',
    issue: 'processing',
  },
  {
    id: 'art-official-plan',
    title: 'Official plan & pricing',
    keywords: ['plan', 'price', 'pricing', 'quote', 'official'],
    body: 'After analysis, you receive an official plan with scope, delivery timeline, and price. Review it before you fund the task. Your Expert is matched once the plan is accepted and payment is confirmed.',
    category: 'payment',
    issue: 'price',
  },
  {
    id: 'art-cant-open-delivery',
    title: "Can't open a delivery",
    keywords: ['delivery', 'open', 'file', 'download', 'link'],
    body: 'This is usually an expired secure link, not a missing file. Open the delivery from Files & Deliveries to refresh access. If the version still will not open, contact support with the task reference.',
    category: 'files',
    issue: 'cant-open',
  },
  {
    id: 'art-receipt',
    title: 'Receipts',
    keywords: ['receipt', 'invoice', 'proof', 'payment record'],
    body: 'Receipts are available from the payment record for a confirmed payment. Open Payments, select the task, and download the receipt from the transaction history. If a receipt is missing, contact support with the task reference.',
    category: 'payment',
    issue: 'receipt',
  },
  {
    id: 'art-messages',
    title: 'Messages & Expert communication',
    keywords: ['message', 'expert', 'chat', 'communication'],
    body: 'Messages stay on the task conversation so context is never lost. Reply from Messages when your Expert asks a question. Off-platform contact and requests that break academic integrity rules are not allowed.',
    category: 'messages',
    issue: 'cant-send',
  },
  {
    id: 'art-sign-in',
    title: 'Account & sign-in',
    keywords: ['sign in', 'login', 'password', 'account', 'security'],
    body: 'Use the sign-in link on the landing page to recover access. Keep your account credentials private. If sign-in still fails after a reset, contact support and we will verify account access with you.',
    category: 'account',
    issue: 'password',
  },
  {
    id: 'art-explain',
    title: 'Explain & Defend availability',
    keywords: ['explain', 'defend', 'session', 'availability', 'rubric'],
    body: 'Explain & Defend opens when a qualifying delivery is ready. Sessions depend on Expert availability. If the studio will not open for a delivered task, contact support with the task reference so we can check eligibility.',
    category: 'explain',
    issue: 'unavailable',
  },
]

const policies = [
  { id: 'pol-integrity', title: 'Academic integrity', summary: 'Work supports your learning. Submitting delivered work as your own without understanding it, or requesting work that breaks your institution rules, is not allowed.' },
  { id: 'pol-payments', title: 'Payments, refunds & cancellation', summary: 'You are charged only after accepting an official plan. Cancellations and refunds follow the status of work already completed on the task.' },
  { id: 'pol-revisions', title: 'Revisions & scope changes', summary: 'Revisions within the agreed scope are handled on the task. Extra scope is proposed as a scope change with updated price and timeline for your approval.' },
  { id: 'pol-privacy', title: 'Privacy', summary: 'Task files and messages stay on your student workspace and are visible only to you and assigned SolveNest participants for that task.' },
  { id: 'pol-comms', title: 'Communication rules', summary: 'Keep communication on the platform task conversation. Requests for direct contact outside SolveNest or for academic misconduct are not permitted.' },
]

const workspaceTasks = []

function ensureStore() {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true })
  if (!fs.existsSync(storePath)) {
    fs.writeFileSync(storePath, JSON.stringify({ studentId: 'demo-student', tickets: [] }, null, 2))
  }
}

function readTickets() {
  ensureStore()
  try {
    const raw = fs.readFileSync(storePath, 'utf8')
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed.tickets)) throw new Error('invalid')
    return parsed
  } catch {
    const fresh = { studentId: 'demo-student', tickets: [] }
    fs.writeFileSync(storePath, JSON.stringify(fresh, null, 2))
    return fresh
  }
}

function writeTickets(store) {
  ensureStore()
  fs.writeFileSync(storePath, JSON.stringify(store, null, 2))
}

function nextTicketId(existing) {
  const used = existing.map((t) => Number(String(t.id).replace('SN-SUP-', ''))).filter((n) => Number.isFinite(n))
  const next = (used.length ? Math.max(...used) : 1000) + 1
  return `SN-SUP-${next}`
}

export function getCatalog() {
  return {
    categories,
    issues,
    quickHelp,
    articles: articles.map(({ id, title, body, category, issue }) => ({ id, title, body, category, issue })),
    policies,
    workspace: workspaceTasks.filter((t) => t.status === 'PAYMENT_PENDING' || t.status === 'DELIVERED' || t.paymentState === 'Processing').slice(0, 3),
    tasks: workspaceTasks,
    tickets: readTickets().tickets,
  }
}

export function searchHelp(query) {
  const q = String(query || '').trim().toLowerCase()
  if (!q) return []
  const hits = []
  for (const article of articles) {
    const hay = [article.title, article.body, ...(article.keywords || [])].join(' ').toLowerCase()
    if (hay.includes(q) || q.split(/\s+/).some((word) => word.length > 2 && hay.includes(word))) {
      hits.push({
        type: 'guide',
        title: article.title,
        desc: article.body.split('. ')[0] + '.',
        articleId: article.id,
        category: article.category,
        issue: article.issue,
      })
    }
  }
  for (const category of categories) {
    const hay = `${category.label} ${category.blurb}`.toLowerCase()
    if (hay.includes(q)) {
      hits.push({
        type: 'action',
        title: `Start guided ${category.label.toLowerCase()} help`,
        desc: category.blurb,
        presetCategory: category.key,
      })
    }
  }
  return hits.slice(0, 8)
}

function findTask(taskId) {
  if (!taskId) return null
  return workspaceTasks.find((t) => String(t.id) === String(taskId)) || null
}

export function resolveGuidance({ category, issue, taskId }) {
  const task = findTask(taskId)
  const categoryDef = categories.find((c) => c.key === category) || null

  if (category === 'payment' && issue === 'processing' && task?.paymentState === 'Processing') {
    return {
      kind: 'guidance',
      found: 'Your payment is currently being confirmed.',
      body: "You don't need to submit another payment while this status is active. Processing usually clears on its own.",
      actions: [
        { label: 'Refresh payment status', kind: 'primary', route: `/student/payments?task=${task.id}` },
        { label: 'How payment confirmation works', kind: 'secondary', route: null, articleId: 'art-payment-processing' },
      ],
      context: { task, category: categoryDef, issue },
    }
  }

  if (category === 'payment' && (task?.status === 'PAYMENT_PENDING' || issue === 'not-showing' || issue === 'price')) {
    return {
      kind: 'action',
      found: 'Your official plan is ready for review.',
      body: 'Reviewing the plan is the next step before your Expert can be assigned.',
      actions: [
        { label: 'Review official plan', kind: 'primary', route: task ? `/student/payments?task=${task.id}&view=plan` : '/student/payments' },
        { label: 'How official plans work', kind: 'secondary', route: null, articleId: 'art-official-plan' },
      ],
      context: { task, category: categoryDef, issue },
    }
  }

  if (category === 'payment' && issue === 'receipt') {
    return {
      kind: 'guidance',
      found: 'Receipts live on the payment record for confirmed payments.',
      body: 'Open the task in Payments and download the receipt from transaction history. If it is missing, send a support request with the task attached.',
      actions: [
        { label: 'Open payment record', kind: 'primary', route: task ? `/student/payments?task=${task.id}` : '/student/payments' },
        { label: 'About receipts', kind: 'secondary', route: null, articleId: 'art-receipt' },
      ],
      context: { task, category: categoryDef, issue },
    }
  }

  if (category === 'payment' && issue === 'failed') {
    return {
      kind: 'support',
      found: 'A failed payment needs a closer look.',
      body: 'Do not retry blindly. Contact SolveNest with this task attached so we can check the payment state with you.',
      actions: [
        { label: 'Open payments', kind: 'secondary', route: task ? `/student/payments?task=${task.id}` : '/student/payments' },
      ],
      context: { task, category: categoryDef, issue },
    }
  }

  if (category === 'files' && issue === 'cant-open' && task?.deliveryVersion) {
    return {
      kind: 'action',
      found: 'This is usually an expired secure link, not a missing file.',
      body: `${task.deliveryVersion} is on file and should reopen once access is refreshed from the delivery.`,
      actions: [
        { label: 'Open delivery', kind: 'primary', route: `/student/files?task=${task.id}` },
        { label: 'Why links expire', kind: 'secondary', route: null, articleId: 'art-cant-open-delivery' },
      ],
      context: { task, category: categoryDef, issue },
    }
  }

  if (category === 'files' && task) {
    return {
      kind: 'guidance',
      found: `${task.title} files are managed under Files & Deliveries.`,
      body: 'Open the delivery for this task to refresh access, check versions, or start a revision request.',
      actions: [
        { label: 'Open Files & Deliveries', kind: 'primary', route: `/student/files?task=${task.id}` },
      ],
      context: { task, category: categoryDef, issue },
    }
  }

  if (category === 'task' && issue === 'not-started' && task) {
    return {
      kind: 'guidance',
      found: `${task.title} is currently: ${task.statusLabel}.`,
      body: "No action is required from you at this stage. You'll get a notification the moment this changes.",
      actions: [{ label: 'Open task', kind: 'secondary', route: `/student/tasks?id=${task.id}` }],
      context: { task, category: categoryDef, issue },
    }
  }

  if (category === 'task' && issue === 'under-review') {
    return {
      kind: 'guidance',
      found: 'Quality review is a normal stage before delivery.',
      body: 'Work is checked against your brief before it is released. You will be notified when the status moves.',
      actions: [
        { label: task ? 'Open task' : 'Open My Tasks', kind: 'secondary', route: task ? `/student/tasks?id=${task.id}` : '/student/tasks' },
        { label: 'What review means', kind: 'secondary', route: null, articleId: 'art-review-stages' },
      ],
      context: { task, category: categoryDef, issue },
    }
  }

  if (category === 'messages') {
    return {
      kind: 'guidance',
      found: 'Task conversations stay under Messages.',
      body: 'Open the conversation for this task to reply. If sending fails, contact support with the task reference.',
      actions: [
        { label: 'Open Messages', kind: 'primary', route: task ? `/student/messages?task=${task.id}` : '/student/messages' },
        { label: 'Communication rules', kind: 'secondary', route: null, articleId: 'art-messages' },
      ],
      context: { task, category: categoryDef, issue },
    }
  }

  if (category === 'explain') {
    return {
      kind: 'guidance',
      found: 'Explain & Defend opens when a qualifying delivery is ready.',
      body: 'Sessions depend on Expert availability. If the studio will not open, contact support with the task reference.',
      actions: [
        { label: 'Open Explain & Defend', kind: 'primary', route: task ? `/student/explain?task=${task.id}` : '/student/explain' },
        { label: 'Availability explained', kind: 'secondary', route: null, articleId: 'art-explain' },
      ],
      context: { task, category: categoryDef, issue },
    }
  }

  if (category === 'account' && issue === 'password') {
    return {
      kind: 'guidance',
      found: 'Sign-in recovery starts from the landing page.',
      body: 'Reset your password, then sign in again. If access still fails, send a support request and we will verify the account with you.',
      actions: [
        { label: 'Go to sign in', kind: 'primary', route: '/login' },
        { label: 'Account help', kind: 'secondary', route: null, articleId: 'art-sign-in' },
      ],
      context: { task, category: categoryDef, issue },
    }
  }

  return {
    kind: 'support',
    found: "We can see the current state, but it doesn't fully explain the issue.",
    body: "Let's get SolveNest to look into this directly.",
    actions: [],
    context: { task, category: categoryDef, issue },
  }
}

export function createTicket({ student, category, issue, taskId, message }) {
  const store = readTickets()
  const task = findTask(taskId)
  const categoryDef = categories.find((c) => c.key === category) || null
  const issueDef = (issues[category] || []).find((i) => i.key === issue) || null
  const ticket = {
    id: nextTicketId(store.tickets),
    status: 'received',
    category: category || 'general',
    categoryLabel: categoryDef?.label || 'General',
    issue: issue || null,
    issueLabel: issueDef?.label || null,
    taskId: task?.id || null,
    taskTitle: task?.title || null,
    message: String(message || '').trim(),
    context: {
      studentId: student?.studentId || null,
      studentName: student?.name || null,
      taskState: task?.statusLabel || null,
      paymentState: task?.paymentState || null,
    },
    createdAt: new Date().toISOString(),
  }
  store.tickets.unshift(ticket)
  writeTickets(store)
  return ticket
}

export function listTickets() {
  return readTickets().tickets
}

export function getTicket(id) {
  return readTickets().tickets.find((t) => String(t.id) === String(id)) || null
}
