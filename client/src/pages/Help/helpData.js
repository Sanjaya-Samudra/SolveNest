/* SolveNest Help Centre knowledge base.
   Every answer is grounded in established product facts
   (estimates, quotes, milestones, experts, task room, QA).
   No invented policies, counts, partnerships or guarantees. */

export const CATEGORIES = [
  {
    id: 'getting-started', num: '01', title: 'GETTING STARTED', glyph: '◒',
    desc: 'Begin with a first analysis before creating an account.',
    keywords: ['start', 'begin', 'account', 'first', 'upload', 'files', 'estimate', 'continue'],
    related: ['analyze', 'estimates'],
    links: [{ t: 'Analyze My Task', to: '/analyze' }],
    articles: [
      { q: 'Do I need an account to analyze a task?', a: 'No. The Guest Quick Scan works before account creation: Solvy identifies visible requirements and returns an approximate effort, turnaround, and price range. It is not a binding quote.' },
      { q: 'What files can I upload?', a: 'PDF, DOCX and images, up to 100 MB in total. Files are validated and processed privately.' },
      { q: 'How do I continue after an estimate?', a: 'Create an account for full analysis and human feasibility review. An authorized admin then confirms the official scope, price, delivery date, and revision allowance.' },
    ],
  },
  {
    id: 'analyze', num: '02', title: 'ANALYZE MY TASK', glyph: '⌘',
    desc: 'How Solvy reads your brief and what it finds.',
    keywords: ['analyze', 'scan', 'solvy', 'identify', 'missing', 'extract', 'details', 'brief', 'requirements'],
    related: ['getting-started', 'estimates'],
    links: [{ t: 'Analyze My Task', to: '/analyze' }],
    articles: [
      { q: 'What does Solvy identify?', a: 'Visible requirements, assessment structure, citation style, complexity, and any missing information in your brief.' },
      { q: 'Why is information sometimes missing?', a: 'Briefs, rubrics, or files are sometimes incomplete. Solvy flags the gaps so you can add what is missing before the official review.' },
      { q: 'Can I edit extracted details?', a: 'Yes. Review the extracted details, correct anything Solvy misread, and add missing information before continuing to full analysis.' },
    ],
  },
  {
    id: 'estimates', num: '03', title: 'ESTIMATES & QUOTES', glyph: '∿',
    desc: 'Provisional ranges first, human-confirmed quotes after.',
    keywords: ['estimate', 'quote', 'price', 'cost', 'range', 'final', 'confirm', 'official', 'provisional', 'valid', 'change'],
    related: ['payments', 'revisions'],
    links: [{ t: 'Plans & Estimates', to: '/plans' }, { t: 'Analyze My Task', to: '/analyze' }],
    articles: [
      { q: 'Is my first estimate final?', a: 'No. The first estimate is an approximate, non-binding range. The official quote is confirmed later by an authorized human after full analysis and feasibility review.', visual: 'estimate' },
      { q: 'Why is the estimate a range?', a: 'Scope, complexity, timing, and requirements interact. The range reflects that uncertainty; human review narrows it into one confirmed figure.' },
      { q: 'Who confirms the official quote?', a: 'An authorized admin, after account verification, full analysis, and human feasibility review. The official quote confirms scope, price, delivery date, and revision allowance.' },
      { q: 'Can my quote change?', a: 'The confirmed figures stand unless your requirements change. New work outside the locked scope needs a scope-change quote with its own price and time.', terms: ['scope change'] },
      { q: 'How long is my quote valid?', a: 'Your official quote states its own validity period. If it expires before you accept, details may need re-confirmation.' },
    ],
  },
  {
    id: 'payments', num: '04', title: 'PAYMENTS & MILESTONES', glyph: '◈',
    desc: 'When payment is required and how milestones unlock work.',
    keywords: ['pay', 'payment', 'milestone', 'fund', 'funding', 'begin', 'start', 'stripe', 'locked', 'stage'],
    related: ['estimates', 'progress'],
    links: [{ t: 'Plans & Estimates', to: '/plans' }],
    articles: [
      { q: 'When do I pay?', a: 'After you accept the official quote. Payment is confirmed before execution begins — no stage starts unfunded.' },
      { q: 'How do prepaid milestones work?', a: 'Larger projects may use prepaid milestones (for example 40 / 35 / 25). Each stage is funded before its work begins; later stages stay locked until funded.', visual: 'milestones' },
      { q: 'When does work begin?', a: 'Only after payment for the task — or for the active milestone stage — is confirmed. A student never provides unpaid work first.' },
      { q: 'What happens if a milestone is not funded?', a: 'The next stage stays locked until funding is confirmed. Already funded and completed work is unaffected.' },
    ],
  },
  {
    id: 'experts', num: '05', title: 'EXPERT SUPPORT', glyph: '✳',
    desc: 'Reviewed internal experts, assigned and managed by SolveNest.',
    keywords: ['expert', 'assign', 'choose', 'select', 'freelancer', 'contact', 'performance', 'see'],
    related: ['progress', 'privacy'],
    links: [{ t: 'Why SolveNest', to: '/why-solvenest' }],
    articles: [
      { q: 'How is an Expert assigned?', a: 'SolveNest assigns from reviewed internal experts, considering expertise, availability, performance, workload, and reliability.', visual: 'expert' },
      { q: 'Can I choose an Expert?', a: 'No. Students do not browse or negotiate with freelancers — SolveNest manages the assignment.' },
      { q: 'What information can my Expert see?', a: 'Task materials and the work history connected to your task. Never your private contact details.' },
      { q: 'How is Expert performance handled?', a: 'Expert work passes internal quality review before delivery, and performance is monitored inside the operation.' },
    ],
  },
  {
    id: 'progress', num: '06', title: 'TASK PROGRESS', glyph: '△',
    desc: 'Visible states that show what happens next.',
    keywords: ['progress', 'status', 'state', 'track', 'next', 'happens', 'visible', 'history'],
    related: ['experts', 'files'],
    links: [{ t: 'The SolveNest Method', to: '/method' }],
    articles: [
      { q: 'Where can I see progress?', a: 'Task states show what happened and what comes next, alongside your payments and decisions in the task history.' },
      { q: 'What do task statuses mean?', a: 'Each visible state names the accountable next step, from analysis and review through to delivery.' },
      { q: 'How do I know what happens next?', a: 'Progress, payments, and decisions remain visible. If a state is unclear, ask Solvy or contact support.' },
    ],
  },
  {
    id: 'files', num: '07', title: 'FILES & DELIVERY', glyph: '▤',
    desc: 'Protected files and review before anything reaches you.',
    keywords: ['file', 'delivery', 'deliver', 'download', 'protect', 'upload', 'document', 'receive'],
    related: ['progress', 'revisions'],
    links: [{ t: 'The SolveNest Method', to: '/method' }],
    articles: [
      { q: 'Where are delivered files?', a: 'Delivered through your task room once quality review and completion are confirmed.' },
      { q: 'How are files protected?', a: 'Production uploads use private storage, validation, malware scanning, limited access, and short-lived signed URLs.' },
      { q: 'What happens at delivery?', a: 'Work passes internal review — requirements, scope, citation, formatting, and files — before it reaches you, with Explain & Defend support afterward.' },
    ],
  },
  {
    id: 'revisions', num: '08', title: 'REVISIONS & SCOPE', glyph: '∑',
    desc: 'What a revision covers and when a scope change applies.',
    keywords: ['revision', 'revise', 'scope', 'change', 'new', 'requirements', 'included', 'edit'],
    related: ['estimates', 'files'],
    links: [{ t: 'Plans & Estimates', to: '/plans' }],
    articles: [
      { q: 'How many revisions are included?', a: 'Your official plan states the revision allowance — for example, 2 revisions within the agreed scope.' },
      { q: 'What counts as a revision?', a: 'Corrections or improvements within the accepted scope. New work outside the locked scope is not a free revision.' },
      { q: 'What if I change the requirements?', a: 'New requirements outside the locked scope need a scope-change quote with its own price and time.', terms: ['scope change'] },
      { q: 'When does a scope change apply?', a: 'A scope change applies when a request changes the previously accepted work, price, or delivery requirements.', terms: ['scope change'] },
    ],
  },
  {
    id: 'account', num: '09', title: 'ACCOUNT & ACCESS', glyph: 'Ω',
    desc: 'Registration, verification, and everyday access.',
    keywords: ['account', 'register', 'verify', 'verification', 'login', 'password', 'reset', 'access', 'another'],
    related: ['getting-started', 'technical'],
    links: [{ t: 'The SolveNest Method', to: '/method' }],
    articles: [
      { q: 'How do I verify my account?', a: 'Complete the verification step after registration to unlock full analysis and the official review.' },
      { q: 'How do I reset my password?', a: 'Use the reset option on the login page and follow the link sent to your email address.' },
      { q: 'Can I analyze another task?', a: 'Yes. You can run a new Quick Scan at any time before committing to anything.' },
    ],
  },
  {
    id: 'privacy', num: '10', title: 'PRIVACY & SECURITY', glyph: '◒',
    desc: 'Your information stays inside the platform.',
    keywords: ['privacy', 'private', 'security', 'contact', 'details', 'information', 'see', 'whatsapp', 'share'],
    related: ['experts', 'integrity'],
    links: [{ t: 'Why SolveNest', to: '/why-solvenest' }],
    articles: [
      { q: 'Who can see my information?', a: 'Only authorized SolveNest team members involved in your task. Experts see task materials only.' },
      { q: 'Can Experts see my contact details?', a: 'No. Contact details are blocked, and all communication stays inside the platform.' },
      { q: 'Are my files private?', a: 'Yes. Uploads use private storage with validation, malware scanning, limited access, and short-lived signed URLs.' },
    ],
  },
  {
    id: 'integrity', num: '11', title: 'ACADEMIC INTEGRITY', glyph: '✚',
    desc: 'Support that strengthens ownership, with clear boundaries.',
    keywords: ['integrity', 'academic', 'allow', 'allowed', 'restrict', 'cheat', 'ownership', 'boundary', 'support'],
    related: ['privacy', 'experts'],
    links: [{ t: 'Why SolveNest', to: '/why-solvenest' }],
    articles: [
      { q: 'What support does SolveNest allow?', a: 'Tutoring, research guidance, feedback, editing, project mentorship, structure, formatting, debugging, citation support, and review of student-created work.' },
      { q: 'What types of requests are restricted?', a: 'Requests that replace student ownership or cross the academic-integrity boundary are declined at human feasibility review.' },
    ],
  },
  {
    id: 'technical', num: '12', title: 'TECHNICAL HELP', glyph: '⌗',
    desc: 'Uploads, pages, payments, and browsers.',
    keywords: ['technical', 'upload', 'loading', 'browser', 'error', 'payment', 'issue', 'problem', 'work', 'page'],
    related: ['account', 'payments'],
    links: [{ t: 'Analyze My Task', to: '/analyze' }],
    articles: [
      { q: 'Upload not working?', a: 'Check the file type (PDF, DOCX, images) and the 100 MB total limit, then retry in a current browser.' },
      { q: 'Page not loading?', a: 'Refresh, check your connection, and try another browser. If it persists, contact support with what happened and where.' },
      { q: 'Payment issue?', a: 'Confirm the quote was accepted and the payment method is valid. For anything unresolved, contact payment support through Connect.' },
    ],
  },
]

export const QUICK = [
  'How does the estimate work?',
  'When does work begin?',
  'How do revisions work?',
  'Can I change my task scope?',
]

export const SUPPORT_INTENTS = ['General Support', 'Task Question', 'Payment', 'Technical Issue']

/* ─── guided problem resolver (decision tree; leaves point at real articles) ─── */
export const RESOLVER = {
  q: 'What do you need help with?',
  options: [
    {
      t: 'I’m starting a task', next: {
        q: 'What do you want to know first?',
        options: [
          { t: 'How analysis works', leaf: { cat: 'analyze', art: 0, links: [{ t: 'Analyze My Task →', to: '/analyze' }] } },
          { t: 'Do I need an account', leaf: { cat: 'getting-started', art: 0, links: [{ t: 'Analyze My Task →', to: '/analyze' }] } },
          { t: 'What files to upload', leaf: { cat: 'getting-started', art: 1, links: [{ t: 'Analyze My Task →', to: '/analyze' }] } },
        ],
      },
    },
    {
      t: 'I received an estimate', next: {
        q: 'What are you unsure about?',
        options: [
          { t: 'The estimated price', leaf: { cat: 'estimates', art: 1, links: [{ t: 'Plans & Estimates →', to: '/plans' }] } },
          { t: 'Whether it is final', leaf: { cat: 'estimates', art: 0, links: [{ t: 'Plans & Estimates →', to: '/plans' }, { t: 'Analyze My Task →', to: '/analyze' }] } },
          { t: 'The deadline', leaf: { cat: 'getting-started', art: 0, links: [{ t: 'Analyze My Task →', to: '/analyze' }] } },
          { t: 'How to continue', leaf: { cat: 'getting-started', art: 2, links: [{ t: 'Analyze My Task →', to: '/analyze' }] } },
        ],
      },
    },
    {
      t: 'I have already paid', next: {
        q: 'What about your payment?',
        options: [
          { t: 'When work begins', leaf: { cat: 'payments', art: 2, links: [{ t: 'Plans & Estimates →', to: '/plans' }] } },
          { t: 'How milestones work', leaf: { cat: 'payments', art: 1, links: [{ t: 'Plans & Estimates →', to: '/plans' }] } },
          { t: 'A payment issue', leaf: { cat: 'technical', art: 2, links: [] } },
        ],
      },
    },
    {
      t: 'My task is in progress', next: {
        q: 'What do you want to check?',
        options: [
          { t: 'Seeing my progress', leaf: { cat: 'progress', art: 0, links: [] } },
          { t: 'My Expert', leaf: { cat: 'experts', art: 0, links: [{ t: 'Why SolveNest →', to: '/why-solvenest' }] } },
          { t: 'What delivery brings', leaf: { cat: 'files', art: 2, links: [] } },
        ],
      },
    },
    {
      t: 'I received my delivery', next: {
        q: 'What now?',
        options: [
          { t: 'Finding delivered files', leaf: { cat: 'files', art: 0, links: [] } },
          { t: 'Revisions included', leaf: { cat: 'revisions', art: 0, links: [{ t: 'Plans & Estimates →', to: '/plans' }] } },
          { t: 'Changing requirements', leaf: { cat: 'revisions', art: 2, links: [{ t: 'Plans & Estimates →', to: '/plans' }] } },
        ],
      },
    },
    {
      t: 'Account or technical issue', next: {
        q: 'Which one?',
        options: [
          { t: 'Verifying my account', leaf: { cat: 'account', art: 0, links: [] } },
          { t: 'Resetting my password', leaf: { cat: 'account', art: 1, links: [] } },
          { t: 'Upload not working', leaf: { cat: 'technical', art: 0, links: [{ t: 'Analyze My Task →', to: '/analyze' }] } },
          { t: 'Page not loading', leaf: { cat: 'technical', art: 1, links: [] } },
        ],
      },
    },
  ],
}

/* ─── search ─── */
const STOP = new Set('what,how,when,where,does,do,is,are,the,a,an,my,i,to,of,it,in,on,and,or,can,me,for,with,about,your,you,we,work,doesnt,dont,there,their,this,that,please,help,know,someone,something'.split(','))
function tokens(s) {
  return (s || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w))
}
function scoreText(text, toks) {
  const t = ` ${text.toLowerCase()} `
  let s = 0
  toks.forEach((w) => { if (t.includes(` ${w}`) || t.includes(w)) s += 1 })
  return s
}
export function searchHelp(query) {
  const toks = tokens(query)
  if (!toks.length) return { best: null, related: [], catHits: [] }
  const scored = []
  CATEGORIES.forEach((c) => {
    let catScore = scoreText(`${c.title} ${c.keywords.join(' ')}`, toks) * 2
    c.articles.forEach((a, art) => {
      const s = scoreText(a.q, toks) * 2.5 + scoreText(c.title, toks) * 1.5 + scoreText(`${c.keywords.join(' ')}`, toks) * 1.5 + scoreText(a.a, toks)
      if (s > 0) scored.push({ cat: c.id, art, score: s })
      catScore = Math.max(catScore, s)
    })
    if (catScore > 0) scored.push({ cat: c.id, art: -1, score: catScore * 0.6, isCat: true })
  })
  scored.sort((a, b) => b.score - a.score)
  const arts = scored.filter((s) => !s.isCat)
  if (!arts.length || arts[0].score < 1.5) return { best: null, related: [], catHits: [] }
  const best = arts[0]
  const related = arts.filter((s) => !(s.cat === best.cat && s.art === best.art)).slice(0, 3)
  const seen = new Set()
  const catHits = []
  scored.forEach((s) => { if (!seen.has(s.cat) && s.score >= 1.5) { seen.add(s.cat); catHits.push(s.cat) } })
  return { best, related: related.slice(0, 3), catHits: catHits.slice(0, 4) }
}
export function catById(id) { return CATEGORIES.find((c) => c.id === id) }
