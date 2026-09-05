/* SolveNest Smart Contact Router — intent configurations.
   Field types: text | email | textarea | select | checkbox | file.
   No fake contact details, hours, SLAs, or ticket numbers anywhere. */

export const INTENT_ORDER = ['general', 'task', 'payment', 'technical', 'business']

export const INTENTS = {
  general: {
    num: '01', tab: 'General', dest: 'GENERAL SUPPORT',
    heading: 'Tell us what’s on your mind.',
    desc: 'Share your question and the SolveNest team will direct it to the right place.',
    include: [],
    link: { t: 'Browse Help Centre →', to: '/help' },
    linkNote: 'You may find your answer faster in the Help Centre.',
    fields: [
      { k: 'name', label: 'Name', type: 'text', req: true, ph: 'How should we address you?' },
      { k: 'email', label: 'Email', type: 'email', req: true, ph: 'you@example.com' },
      { k: 'subject', label: 'Subject', type: 'text', req: true, ph: 'What is this about?' },
      { k: 'message', label: 'Message', type: 'textarea', req: true, ph: 'Tell us what you need help understanding…' },
      { k: 'attachment', label: 'Attachment', type: 'file', req: false, hint: 'PDF, PNG, JPG or supported file' },
    ],
  },
  task: {
    num: '02', tab: 'Task Question', dest: 'TASK SUPPORT',
    heading: 'Tell us about your task.',
    desc: 'Share the relevant task details so the SolveNest team can understand the question.',
    include: ['Task reference', 'What you expected', 'What happened', 'Any relevant screenshot'],
    link: { t: 'Analyze My Task →', to: '/analyze' },
    linkNote: 'Need help understanding your academic brief?',
    fields: [
      { k: 'name', label: 'Name', type: 'text', req: true, ph: 'How should we address you?' },
      { k: 'email', label: 'Email', type: 'email', req: true, ph: 'you@example.com' },
      { k: 'taskRef', label: 'Task Reference', type: 'text', req: true, ph: 'e.g. SN-2048', hideWhen: (d) => d.noTaskRef },
      { k: 'noTaskRef', label: 'options', type: 'checkbox', req: false, box: 'I haven’t created a task yet.' },
      { k: 'topic', label: 'Topic', type: 'select', req: true, opts: ['Analysis', 'Quote', 'Expert', 'Progress', 'Delivery', 'Other'] },
      { k: 'message', label: 'Message', type: 'textarea', req: true, ph: 'What part of your task needs context?' },
      { k: 'attachment', label: 'Attachment', type: 'file', req: false, hint: 'PDF, PNG, JPG or supported file' },
    ],
  },
  payment: {
    num: '03', tab: 'Payment', dest: 'PAYMENT SUPPORT',
    heading: 'Tell us what happened.',
    desc: 'Share the relevant task and payment information so the SolveNest team can understand the issue.',
    include: ['Task reference', 'Payment reference', 'What you expected', 'What happened', 'Any relevant screenshot'],
    link: { t: 'Plans & Estimates →', to: '/plans' },
    linkNote: 'Looking for information about estimates, official quotes or milestones?',
    fields: [
      { k: 'name', label: 'Name', type: 'text', req: true, ph: 'How should we address you?' },
      { k: 'email', label: 'Email', type: 'email', req: true, ph: 'you@example.com' },
      { k: 'taskRef', label: 'Task Reference', type: 'text', req: true, ph: 'e.g. SN-2048' },
      { k: 'payRef', label: 'Payment Reference', type: 'text', req: false, ph: 'If you have one' },
      { k: 'issueType', label: 'Issue Type', type: 'select', req: true, opts: ['Payment not completed', 'Payment shows incorrectly', 'Quote question', 'Milestone question', 'Refund / cancellation question', 'Other'] },
      { k: 'message', label: 'Description', type: 'textarea', req: true, ph: 'Describe what happened…' },
      { k: 'attachment', label: 'Attachment', type: 'file', req: true, hint: 'A screenshot helps payment issues' },
    ],
  },
  technical: {
    num: '04', tab: 'Technical Issue', dest: 'TECHNICAL SUPPORT',
    heading: 'Tell us what broke.',
    desc: 'Describe the problem and where it happened so it can be reproduced and routed correctly.',
    include: ['Where it happened', 'What you expected', 'Device and browser', 'A screenshot if possible'],
    link: { t: 'Technical Help →', to: '/help?topic=technical&q=0' },
    linkNote: 'Before sending a report, you can check common technical issues.',
    fields: [
      { k: 'name', label: 'Name', type: 'text', req: true, ph: 'How should we address you?' },
      { k: 'email', label: 'Email', type: 'email', req: true, ph: 'you@example.com' },
      { k: 'area', label: 'Problem Area', type: 'select', req: true, opts: ['Login', 'File upload', 'Analyze My Task', 'Task Room', 'Payment', 'Page / UI issue', 'Other'] },
      { k: 'device', label: 'Device', type: 'text', req: false, ph: 'e.g. Windows laptop, Android phone' },
      { k: 'browser', label: 'Browser', type: 'text', req: false, ph: 'e.g. Chrome 126' },
      { k: 'message', label: 'Description', type: 'textarea', req: true, ph: 'What happened and where?' },
      { k: 'attachment', label: 'Screenshot', type: 'file', req: false, hint: 'PNG or JPG works best' },
    ],
  },
  business: {
    num: '05', tab: 'Business', dest: 'BUSINESS ENQUIRY',
    heading: 'Tell us about the enquiry.',
    desc: 'Share enough about your organisation so the enquiry can be routed appropriately.',
    include: ['Organisation', 'Your role', 'Enquiry type'],
    link: null,
    linkNote: 'Tell us enough about your organisation or enquiry so we can route it appropriately.',
    fields: [
      { k: 'name', label: 'Name', type: 'text', req: true, ph: 'Your full name' },
      { k: 'email', label: 'Work Email', type: 'email', req: true, ph: 'you@organisation.com' },
      { k: 'org', label: 'Organisation', type: 'text', req: true, ph: 'Institution or company' },
      { k: 'role', label: 'Role', type: 'text', req: false, ph: 'Your role' },
      { k: 'enqType', label: 'Enquiry Type', type: 'select', req: true, opts: ['Partnership', 'Institution enquiry', 'Business enquiry', 'Other'] },
      { k: 'message', label: 'Message', type: 'textarea', req: true, ph: 'Tell us about the conversation you would like to start…' },
    ],
  },
}

export function intentFromParam(v) {
  const s = (v || '').toLowerCase().trim()
  if (['general', 'task', 'payment', 'technical', 'business'].includes(s)) return s
  if (s.includes('pay')) return 'payment'
  if (s.includes('tech')) return 'technical'
  if (s.includes('task')) return 'task'
  if (s.includes('busi')) return 'business'
  return 'general'
}

export function validateField(f, value, data) {
  if (f.hideWhen && f.hideWhen(data)) return null
  if (f.type === 'checkbox' || !f.req) {
    if (f.type === 'email' && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Enter a valid email address.'
    return null
  }
  if (f.type === 'file') {
    if (!value) return 'Attach a file — it helps resolve this faster.'
    return null
  }
  if (!value || !String(value).trim()) {
    if (f.k === 'taskRef') return 'Enter your task reference or choose ‘I haven’t created a task yet.’'
    return `Enter ${f.label.toLowerCase()}.`
  }
  if (f.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Enter a valid email address.'
  return null
}
