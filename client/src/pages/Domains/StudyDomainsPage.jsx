import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowRight, ArrowUpRight, Search, Check, ShieldCheck, Database, Code2, Globe, Shield, FileText, BookOpen, GraduationCap, Beaker, BarChart3, Briefcase, Calculator, Network, Layers, FileCheck, Lightbulb, Compass, Sparkles, ChevronRight } from 'lucide-react'

const navigate = (path) => { window.history.pushState({}, '', path); window.dispatchEvent(new PopStateEvent('popstate')) }

const domainsData = [
  {
    id: 'software-it',
    name: 'Software & IT',
    symbol: '⌘',
    desc: 'Programming, web development, databases, documentation',
    visual: 'it',
    keywords: ['software','it','code','programming','web','database','documentation','ai'],
    subcategories: [
      { id:'programming', name:'Programming', keywords:['programming','code','python','java','debug'], tasks:['Logic building','Debugging','Code structure','Documentation','Algorithm design'], solvy:['Language detected','Logic flow','Complexity','Missing requirements flagged'], support:['Explain concepts','Plan approach','Guide implementation','Review & QA'] },
      { id:'web-dev', name:'Web Development', keywords:['web','frontend','backend','react','api'], tasks:['UI implementation','Frontend logic','API integration','Database connection','Deployment guidance'], solvy:['Stack detected','Component mapping','API surface','Missing endpoints'], support:['Explain architecture','Plan structure','Guide build','Review'] },
      { id:'databases', name:'Databases', keywords:['database','sql','er','schema'], tasks:['Schema design','SQL queries','ER modelling','Documentation','Debugging'], solvy:['Tables detected','Relations','Query intent','Documentation gaps'], support:['Design guidance','Query debugging','Diagram review','Explanation'] },
      { id:'documentation', name:'Software Documentation', keywords:['documentation','docs','spec'], tasks:['Spec writing','API docs','User guides','Structure review'], solvy:['Structure detected','Coverage','Formatting'], support:['Structure guidance','Clarity review','Consistency check'] },
      { id:'ai-foundations', name:'AI Foundations', keywords:['ai','ml','model'], tasks:['Model concepts','Data flow','Evaluation','Documentation'], solvy:['Model type','Data requirements'], support:['Concept explain','Plan experiment','Review approach'] },
    ]
  },
  {
    id: 'engineering',
    name: 'Engineering',
    symbol: '△',
    desc: 'Technical structure, reports, diagrams, project support',
    visual: 'engineering',
    keywords: ['engineering','technical','diagram','project','report'],
    subcategories: [
      { id:'structure', name:'Technical Structure', keywords:['structure','design'], tasks:['Structure planning','Calculations','Diagrams','Report writing'], solvy:['Spec detected','Diagram type','Units'], support:['Explain principles','Plan calculations','Review'] },
      { id:'reports', name:'Reports', keywords:['report'], tasks:['Report structure','Analysis','Presentation'], solvy:['Sections detected','Data tables'], support:['Structure','Editing','Formatting'] },
    ]
  },
  {
    id: 'data-analytics',
    name: 'Data & Analytics',
    symbol: '∿',
    desc: 'Analysis, interpretation, visualisation, methods',
    visual: 'data',
    keywords: ['data','analytics','analysis','visualisation','statistics'],
    subcategories: [
      { id:'analysis', name:'Analysis', keywords:['analysis'], tasks:['Data cleaning','Interpretation','Methods','Reporting'], solvy:['Dataset type','Method','Missing data'], support:['Explain method','Guide analysis','Review'] },
      { id:'visualisation', name:'Visualisation', keywords:['visual','chart'], tasks:['Chart design','Dashboard','Interpretation'], solvy:['Chart type','Data mapping'], support:['Design guidance','Review'] },
    ]
  },
  {
    id: 'business',
    name: 'Business',
    symbol: '◒',
    desc: 'Reports, strategy, presentations, case work',
    visual: 'business',
    keywords: ['business','strategy','case','presentation','report'],
    subcategories: [
      { id:'strategy', name:'Strategy', keywords:['strategy'], tasks:['Case analysis','Strategy formulation','Presentation'], solvy:['Framework detected','Structure'], support:['Explain framework','Plan structure','Review'] },
    ]
  },
  {
    id: 'academic-writing',
    name: 'Academic Writing',
    symbol: 'Aa',
    desc: 'Essays, research, structure, citations, editing',
    visual: 'writing',
    keywords: ['writing','essay','research','citation','apa','referencing','editing'],
    subcategories: [
      { id:'essays', name:'Essays', keywords:['essay'], tasks:['Thesis development','Structure','Argument','Editing'], solvy:['Thesis detected','Structure','Citation style'], support:['Structure guidance','Editing','Feedback'] },
      { id:'research', name:'Research', keywords:['research'], tasks:['Literature review','Methodology','Analysis'], solvy:['Sources','Method','Gaps'], support:['Research guidance','Structure','Review'] },
      { id:'citations', name:'Citations & Formatting', keywords:['citation','apa','referencing','formatting'], tasks:['APA 7','Referencing','Formatting','Consistency'], solvy:['Style detected','Consistency','Missing refs'], support:['Formatting review','Consistency check'] },
    ]
  },
  {
    id: 'mathematics',
    name: 'Mathematics',
    symbol: '∑',
    desc: 'Explanations, problem-solving, revision guidance',
    visual: 'math',
    keywords: ['mathematics','math','calculation','problem','equation'],
    subcategories: [
      { id:'problem', name:'Problem Solving', keywords:['problem'], tasks:['Step-by-step solutions','Concept explanation','Practice'], solvy:['Problem type','Steps','Missing data'], support:['Explain concept','Guide solution','Review'] },
    ]
  },
  {
    id: 'cybersecurity',
    name: 'Cybersecurity',
    symbol: '◈',
    desc: 'Defensive analysis, concepts, ethical reports',
    visual: 'cyber',
    keywords: ['cybersecurity','security','network','defensive','ethical'],
    subcategories: [
      { id:'concepts', name:'Security Concepts', keywords:['concept'], tasks:['Security principles','Risk concepts','Documentation'], solvy:['Concept type','Threat model'], support:['Explain','Guide documentation','Review'] },
      { id:'defensive', name:'Defensive Analysis', keywords:['defensive','analysis'], tasks:['Vulnerability assessment','Defensive recommendations','Lab reports'], solvy:['Scope detected','Method','Documentation'], support:['Concept explain','Structure guidance','Review'] },
    ]
  },
  {
    id: 'science',
    name: 'Science',
    symbol: '✳',
    desc: 'Lab reports, explanations, research organisation',
    visual: 'science',
    keywords: ['science','lab','research','experiment'],
    subcategories: [
      { id:'lab', name:'Lab Reports', keywords:['lab'], tasks:['Lab structure','Data recording','Analysis','Conclusion'], solvy:['Sections','Data tables','Units'], support:['Structure','Review','Explanation'] },
    ]
  },
  {
    id: 'ol-al',
    name: 'O/L & A/L',
    symbol: 'Ω',
    desc: 'School-level subject and revision support',
    visual: 'school',
    keywords: ['school','ol','al','revision','olevel','alevel'],
    subcategories: [
      { id:'revision', name:'Revision Guidance', keywords:['revision'], tasks:['Structured explanations','Practice','Coursework organisation'], solvy:['Subject detected','Level','Gaps'], support:['Explain','Plan revision','Review'] },
    ]
  },
]

function useQueryParams() {
  const [params, setParams] = useState({ domain: null, area: null })
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search)
    setParams({ domain: sp.get('domain'), area: sp.get('area') })
  }, [])
  return params
}

function ITVisual({ sub }) {
  const [hovered, setHovered] = useState(null)
  if (sub === 'databases') return (
    <svg viewBox="0 0 640 280" className="da-diagram">
            <defs><marker id="arrow-db2" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#7657FF"/></marker></defs>
      {[
        {x:60,y:40,w:120,h:56,label:'STUDENT'},
        {x:250,y:40,w:120,h:56,label:'TASK'},
        {x:440,y:40,w:120,h:56,label:'FILE'},
        {x:150,y:170,w:120,h:56,label:'QUOTE'},
        {x:340,y:170,w:120,h:56,label:'PAYMENT'},
      ].map(b=> <g key={b.label} onMouseEnter={()=> setHovered(b.label)} onMouseLeave={()=> setHovered(null)} style={{cursor:'pointer'}} className={hovered===b.label?'is-hovered':''}><rect x={b.x} y={b.y} width={b.w} height={b.h} rx={8} className="da-table"/><rect x={b.x} y={b.y} width={b.w} height={20} rx={8} className="da-table-header"/><rect x={b.x} y={b.y+12} width={b.w} height={8} className="da-table-header no-radius"/><text x={b.x+b.w/2} y={b.y+14} textAnchor="middle" className="da-table-header-label">{b.label}</text><text x={b.x+b.w/2} y={b.y+38} textAnchor="middle" className="da-table-sub">id • fields</text>{hovered===b.label && <rect x={b.x-2} y={b.y-2} width={b.w+4} height={b.h+4} rx={10} className="da-table-hover"/>}</g>)}
      <defs><marker id="arrow-db" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#7657FF"/></marker></defs>
      <path d="M180 68 H250 M370 68 H440 M120 96 C120 130 210 130 210 170 M310 96 C310 130 400 130 400 170 M500 96 C500 130 400 130 400 170" className="da-line" markerEnd="url(#arrow-db)" />
    </svg>
  )
  if (sub === 'web-dev') return (
    <svg viewBox="0 0 640 280" className="da-diagram">
      <rect x={40} y={24} width={560} height={232} rx={14} className="da-browser"/>
      <rect x={40} y={24} width={560} height={36} rx={14} className="da-browser-bar"/>
      <circle cx={66} cy={42} r={6} className="da-dot"/><circle cx={86} cy={42} r={6} className="da-dot"/><circle cx={106} cy={42} r={6} className="da-dot"/>
      <g className="da-browser-grid">
        <rect x={70} y={86} width={120} height={72} rx={8} className="da-card"><text x={130} y={128} className="da-card-label">UI</text></rect>
        <rect x={210} y={86} width={120} height={72} rx={8} className="da-card"><text x={270} y={128} className="da-card-label">Frontend</text></rect>
        <rect x={350} y={86} width={120} height={72} rx={8} className="da-card"><text x={410} y={128} className="da-card-label">API</text></rect>
        <rect x={490} y={86} width={80} height={72} rx={8} className="da-card"><text x={530} y={128} className="da-card-label">DB</text></rect>
        <rect x={150} y={180} width={340} height={44} rx={8} className="da-card is-wide"><text x={320} y={207} className="da-card-label">Database & Storage</text></rect>
      </g>
      <path d="M190 122 H210 M330 122 H350 M470 122 H490 M270 158 V180 M410 158 V180" className="da-line"/>
    </svg>
  )
  if (sub === 'documentation') return (
    <svg viewBox="0 0 640 280" className="da-diagram">
      <rect x={40} y={20} width={360} height={240} rx={12} className="da-paper"/>
      <rect x={40} y={20} width={360} height={34} rx={12} className="da-paper-header"/><rect x={40} y={32} width={360} height={12} className="da-paper-header no-radius"/>
      <text x={60} y={42} className="da-paper-header-label">Software Documentation • API Spec</text>
      {[
        {y:68, label:'01  Overview', active:false},
        {y:100, label:'02  Authentication', active:true},
        {y:132, label:'03  Endpoints', active:false},
        {y:164, label:'04  Data Models', active:false},
        {y:196, label:'05  Examples', active:false},
      ].map(r=> <g key={r.label} onClick={()=> setHovered(r.label)} onMouseEnter={()=> setHovered(r.label)} onMouseLeave={()=> setHovered(null)} style={{cursor:'pointer'}}><rect x={60} y={r.y} width={320} height={24} rx={6} className={hovered===r.label||r.active?'da-paper-sec active':'da-paper-sec'}/><text x={72} y={r.y+16} className="da-paper-label">{r.label}</text></g>)}
      <g className="da-doc-side">
        <g onClick={()=> setHovered('coverage')} style={{cursor:'pointer'}}><rect x={440} y={60} width={160} height={72} rx={10} className="da-side-card"/><text x={520} y={84} textAnchor="middle" className="da-side-title">Coverage</text><text x={520} y={106} textAnchor="middle" className="da-side-desc">92% • Complete</text></g>
        <g onClick={()=> setHovered('structure')} style={{cursor:'pointer'}}><rect x={440} y={150} width={160} height={72} rx={10} className="da-side-card"/><text x={520} y={174} textAnchor="middle" className="da-side-title">Structure</text><text x={520} y={196} textAnchor="middle" className="da-side-desc">Consistent • Reviewed</text></g>
      </g>
    </svg>
  )
  if (sub === 'ai-foundations') return (
    <svg viewBox="0 0 640 280" className="da-diagram">
      {[
        {x:40,y:100,w:120,h:72,label:'Dataset', sub:'raw • labelled'},
        {x:190,y:100,w:120,h:72,label:'Training', sub:'model fit'},
        {x:340,y:100,w:120,h:72,label:'Model', sub:'weights'},
        {x:490,y:100,w:110,h:72,label:'Inference', sub:'predict'},
      ].map((b,i)=> <g key={b.label}><rect x={b.x} y={b.y} width={b.w} height={b.h} rx={10} className={i===2?'da-ai-box active':'da-ai-box'}/><text x={b.x+b.w/2} y={b.y+30} textAnchor="middle" className="da-ai-label">{b.label}</text><text x={b.x+b.w/2} y={b.y+50} textAnchor="middle" className="da-ai-sub">{b.sub}</text></g>)}
      <defs><marker id="arrow-ai" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M 0 0 L 10 5 L 0 10 z" fill="#7657FF"/></marker></defs>
      <path d="M160 136 H190" className="da-line" markerEnd="url(#arrow-ai)"/><path d="M310 136 H340" className="da-line" markerEnd="url(#arrow-ai)"/><path d="M460 136 H490" className="da-line" markerEnd="url(#arrow-ai)"/>
      <text x={320} y={220} textAnchor="middle" className="da-ai-note">Guidance • Evaluation • Documentation</text>
    </svg>
  )
  return (
    <svg viewBox="0 0 640 280" className="da-diagram">
      <g className="da-flow">
        <rect x={220} y={24} width={200} height={44} rx={10} className="da-flow-box"><text x={320} y={51} textAnchor="middle" className="da-flow-label">INPUT</text></rect>
        <defs><marker id="arrow-prog" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path d="M 0 0 L 10 5 L 0 10 z" fill="#7657FF"/></marker></defs>
        <path d="M320 68 V94" className="da-line" markerEnd="url(#arrow-prog)" strokeWidth="1.8"/>
        <rect x={160} y={96} width={320} height={72} rx={10} className="da-flow-box is-code"><text x={320} y={122} textAnchor="middle" className="da-code">function process(data) → result</text><text x={320} y={142} textAnchor="middle" className="da-code small">logic • structure • docs</text></rect>
        <path d="M320 168 V194" className="da-line" markerEnd="url(#arrow-prog)" strokeWidth="1.8"/>
        <rect x={220} y={196} width={200} height={44} rx={8} className="da-flow-box"><text x={320} y={223} textAnchor="middle" className="da-flow-label">OUTPUT</text></rect>
      </g>
    </svg>
  )
}
function CyberVisual() {
  return (
    <svg viewBox="0 0 640 280" className="da-diagram">
      {[
        {x:80,y:40,label:'User'},
        {x:250,y:40,label:'Application'},
        {x:420,y:40,label:'API'},
        {x:80,y:180,label:'Database'},
        {x:250,y:180,label:'Analysis'},
      ].map(n=> <g key={n.label}><rect x={n.x} y={n.y} width={120} height={48} rx={24} className="da-node"/><text x={n.x+60} y={n.y+30} textAnchor="middle" className="da-node-label">{n.label}</text></g>)}
      <path d="M200 64 H250 M370 64 H420 M140 88 V180 M310 88 V180 M200 204 H250" className="da-line"/>
      <g className="da-shield"><rect x={420} y={164} width={120} height={48} rx={8} className="da-shield-box"/><text x={480} y={192} textAnchor="middle" className="da-shield-label">Defensive Path</text></g>
    </svg>
  )
}
function WritingVisual({ active = 2 }) {
  const [sel, setSel] = useState(active)
  useEffect(()=> setSel(active), [active])
  const sections = [
    {name:'Introduction', desc:'Thesis • hook', icon:'◈'},
    {name:'Literature', desc:'Sources • gap', icon:'⬢'},
    {name:'Analysis', desc:'Evidence • comparison', icon:'⬣'},
    {name:'Discussion', desc:'Interpretation', icon:'⬔'},
    {name:'Conclusion', desc:'Summary', icon:'⬕'},
    {name:'References', desc:'APA 7 • citations', icon:'⬓'},
  ]
  const sideMap = {
    0: {a:{title:'Essay Focus', desc:'Thesis • Hook • Argument', detail:'Introduction → Thesis'}, b:{title:'Opening', desc:'Context • Aim • Roadmap', detail:'Structure • Click → Edit'}},
    1: {a:{title:'Research Focus', desc:'Literature • Sources • Gap', detail:'Literature → Sources'}, b:{title:'Methodology', desc:'Approach • Design • Validity', detail:'Research • Click → Method'}},
    2: {a:{title:'Analysis Focus', desc:'Evidence • Comparison • Insight', detail:'Analysis → Evidence'}, b:{title:'Critical Thinking', desc:'Evaluation • Synthesis • Insight', detail:'Analysis • Active'}},
    3: {a:{title:'Discussion Focus', desc:'Interpretation • Implications', detail:'Discussion → Insight'}, b:{title:'Argument', desc:'Reasoning • Link • Voice', detail:'Discussion • Click → Arg'}},
    4: {a:{title:'Conclusion Focus', desc:'Summary • Recommendations', detail:'Conclusion → Summary'}, b:{title:'Closure', desc:'Restate • Final • Impact', detail:'Conclusion • Click → Close'}},
    5: {a:{title:'Citation Support', desc:'APA 7 • Consistency • Formatting', detail:'References → APA'}, b:{title:'Reference List', desc:'Accuracy • Style • Cross-check', detail:'References • Active'}},
  }
  const sideA = sideMap[sel].a
  const sideB = sideMap[sel].b
  return (
    <svg viewBox="0 0 640 380" className="da-diagram">
      <rect x={40} y={20} width={240} height={340} rx={16} className="da-paper"/>
      <rect x={40} y={20} width={240} height={32} rx={14} className="da-paper-header is-plain"/><rect x={40} y={32} width={240} height={12} className="da-paper-header is-plain no-radius"/>
      <text x={60} y={42} className="da-paper-header-label is-plain">Academic Writing • Click to explore</text>
      {sections.map((s,i)=> (
        <g key={s.name} onClick={()=> setSel(i)} style={{cursor:'pointer'}} className={i===sel?'is-active':''}>
          <rect x={60} y={68+i*44} width={200} height={38} rx={10} className={i===sel?'da-paper-sec active':'da-paper-sec'}/>
          <text x={74} y={86+i*44} className="da-paper-label">{s.icon}  {String(i+1).padStart(2,'0')}  {s.name}</text>
          <text x={74} y={98+i*44} className="da-paper-sub">{s.desc}</text>
          {i===sel && <line x1={260} y1={87+i*44} x2={320} y2={i<=2?118:220} className="da-annotation"/>}
        </g>
      ))}
      <g className="da-side">
        <g onClick={()=> setSel((sel+5)%6)} style={{cursor:'pointer'}}><rect x={320} y={68} width={270} height={118} rx={14} className="da-side-card active"/><text x={455} y={98} textAnchor="middle" className="da-side-title">{sideA.title}</text><text x={455} y={120} textAnchor="middle" className="da-side-desc">{sideA.desc}</text><text x={455} y={142} textAnchor="middle" className="da-side-meta">● {sideA.detail}</text></g>
        <g onClick={()=> setSel((sel+1)%6)} style={{cursor:'pointer'}}><rect x={320} y={200} width={270} height={110} rx={14} className="da-side-card"/><text x={455} y={228} textAnchor="middle" className="da-side-title">{sideB.title}</text><text x={455} y={248} textAnchor="middle" className="da-side-desc">{sideB.desc}</text><text x={455} y={268} textAnchor="middle" className="da-side-meta">○ {sideB.detail}</text></g>
      </g>
    </svg>
  )
}
function SchoolVisual() {
  return (
    <svg viewBox="0 0 640 280" className="da-diagram">
      <rect x={40} y={20} width={560} height={240} rx={14} className="da-paper"/>
      <line x1={80} y1={60} x2={560} y2={60} className="da-note-line"/>
      <line x1={80} y1={90} x2={560} y2={90} className="da-note-line"/>
      <line x1={80} y1={120} x2={560} y2={120} className="da-note-line"/>
      <text x={80} y={48} className="da-note-title">Structured Revision — Mathematics • Science</text>
      <g className="da-math">
        <text x={80} y={108} className="da-math-expr">f(x) = x² + 3x — 4</text>
        <text x={80} y={138} className="da-math-expr">Revision guidance • Step-by-step</text>
        <rect x={380} y={70} width={160} height={70} rx={8} className="da-math-box"/><text x={460} y={98} textAnchor="middle" className="da-math-box-label">Practice Set</text><text x={460} y={118} textAnchor="middle" className="da-math-box-desc">Q1 → Q6</text>
      </g>
    </svg>
  )
}
function EngStructureVisual() {
  return (
    <svg viewBox="0 0 640 280" className="da-diagram">
      <rect x={40} y={20} width={380} height={240} rx={12} className="da-paper"/>
      <line x1={80} y1={70} x2={380} y2={70} className="da-eng-beam"/><line x1={80} y1={70} x2={80} y2={210} className="da-eng-beam"/><line x1={380} y1={70} x2={380} y2={210} className="da-eng-beam"/>
      <line x1={80} y1={140} x2={380} y2={140} className="da-eng-beam dashed"/><line x1={150} y1={70} x2={150} y2={210} className="da-eng-dim"/><line x1={230} y1={70} x2={230} y2={210} className="da-eng-dim"/>
      <text x={60} y={48} className="da-note-title">Technical Structure • Load Diagram</text>
      <text x={85} y={200} className="da-eng-label">Support</text><text x={355} y={200} className="da-eng-label">Load</text>
      <rect x={440} y={40} width={160} height={72} rx={10} className="da-side-card"/><text x={520} y={68} textAnchor="middle" className="da-side-title">Calculations</text><text x={520} y={88} textAnchor="middle" className="da-side-desc">kN • m • kPa</text>
      <rect x={440} y={130} width={160} height={72} rx={10} className="da-side-card"/><text x={520} y={158} textAnchor="middle" className="da-side-title">Diagrams</text><text x={520} y={178} textAnchor="middle" className="da-side-desc">CAD • Sketch • Review</text>
    </svg>
  )
}
function EngReportsVisual() {
  const [sel, setSel] = useState(2)
  return (
    <svg viewBox="0 0 640 280" className="da-diagram">
      <rect x={40} y={20} width={360} height={240} rx={12} className="da-paper"/>
      <rect x={40} y={20} width={360} height={34} rx={12} className="da-paper-header"/><rect x={40} y={32} width={360} height={12} className="da-paper-header no-radius"/>
      <text x={60} y={42} className="da-paper-header-label">Engineering Report • Project Support</text>
      {['Abstract','Methodology','Calculations','Diagrams','Conclusion'].map((t,i)=> <g key={t} onClick={()=> setSel(i)} style={{cursor:'pointer'}}><rect x={60} y={68+i*32} width={320} height={22} rx={6} className={sel===i?'da-paper-sec active':'da-paper-sec'}/><text x={72} y={83+i*32} className="da-paper-label">{String(i+1).padStart(2,'0')}  {t}</text></g>)}
      <rect x={440} y={70} width={160} height={90} rx={10} className="da-side-card"/><text x={520} y={100} textAnchor="middle" className="da-side-title">QA Check</text><text x={520} y={122} textAnchor="middle" className="da-side-desc">Units • Tolerance</text>
    </svg>
  )
}
function DataAnalysisVisual() {
  return (
    <svg viewBox="0 0 640 280" className="da-diagram">
      {[
        {x:40,y:60,w:120,h:72,label:'Raw Data', sub:'CSV • Sheets'},
        {x:180,y:60,w:120,h:72,label:'Cleaning', sub:'filter • dedupe'},
        {x:320,y:60,w:120,h:72,label:'Analysis', sub:'method • test'},
        {x:460,y:60,w:140,h:72,label:'Insights', sub:'findings'},
      ].map((b,i)=> <g key={b.label}><rect x={b.x} y={b.y} width={b.w} height={b.h} rx={10} className={i===2?'da-ai-box active':'da-ai-box'}/><text x={b.x+b.w/2} y={b.y+28} textAnchor="middle" className="da-ai-label">{b.label}</text><text x={b.x+b.w/2} y={b.y+50} textAnchor="middle" className="da-ai-sub">{b.sub}</text></g>)}
      <defs><marker id="arrow-data" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M 0 0 L 10 5 L 0 10 z" fill="#7657FF"/></marker></defs>
      <path d="M160 96 H180" className="da-line" markerEnd="url(#arrow-data)"/><path d="M300 96 H320" className="da-line" markerEnd="url(#arrow-data)"/><path d="M440 96 H460" className="da-line" markerEnd="url(#arrow-data)"/>
      <rect x={180} y={170} width={280} height={48} rx={8} className="da-flow-box is-code"/><text x={320} y={198} textAnchor="middle" className="da-code">Methods • Interpretation • Reporting</text>
    </svg>
  )
}
function DataVizVisual() {
  const [selected, setSelected] = useState('chart')
  const [activeBar, setActiveBar] = useState('D')
  const bars = [
    {x:70, h:50, label:'A', val:'42%'},
    {x:124, h:80, label:'B', val:'68%'},
    {x:178, h:100, label:'C', val:'84%'},
    {x:232, h:130, label:'D', val:'92%'},
    {x:286, h:65, label:'E', val:'51%'},
  ]
  return (
    <svg viewBox="0 0 640 280" className="da-diagram">
      <rect x={40} y={20} width={360} height={200} rx={14} className="da-paper"/>
      <rect x={40} y={20} width={360} height={36} rx={14} className="da-paper-header"/><rect x={40} y={34} width={360} height={14} className="da-paper-header no-radius"/>
      <text x={60} y={42} className="da-paper-header-label">Visualisation • Dashboard</text>
      <g className="da-bars">
        {bars.map(b=> <g key={b.label} onClick={()=> setActiveBar(b.label)} style={{cursor:'pointer'}}><rect x={b.x} y={190-b.h} width={40} height={b.h} rx={6} className={activeBar===b.label?'da-bar active':'da-bar'}/><text x={b.x+20} y={204} textAnchor="middle" className="da-bar-label">{b.label}</text>{activeBar===b.label && <text x={b.x+20} y={190-b.h-8} textAnchor="middle" className="da-bar-value">{b.val}</text>}</g>)}
      </g>
      <line x1={60} y1={190} x2={340} y2={190} className="da-axis"/>
      <g onClick={()=> setSelected(selected==='chart'?'insight':'chart')} style={{cursor:'pointer'}}>
        <rect x={420} y={40} width={180} height={72} rx={12} className={selected==='chart'?'da-side-card active':'da-side-card'}/><text x={510} y={68} textAnchor="middle" className="da-side-title">Chart Type</text><text x={510} y={88} textAnchor="middle" className="da-side-desc">Bar • Line • Dashboard</text><text x={510} y={104} textAnchor="middle" className="da-side-meta">{selected==='chart'?'● Active':'○ Click'}</text>
      </g>
      <g onClick={()=> setSelected(selected==='insight'?'chart':'insight')} style={{cursor:'pointer'}}>
        <rect x={420} y={130} width={180} height={72} rx={12} className={selected==='insight'?'da-side-card active':'da-side-card'}/><text x={510} y={158} textAnchor="middle" className="da-side-title">Interpretation</text><text x={510} y={178} textAnchor="middle" className="da-side-desc">Trend • Insight • Story</text><text x={510} y={194} textAnchor="middle" className="da-side-meta">{selected==='insight'?'● Active':'○ Click'}</text>
      </g>
    </svg>
  )
}
function BusinessVisual() {
  return (
    <svg viewBox="0 0 640 280" className="da-diagram">
      <rect x={40} y={20} width={560} height={240} rx={14} className="da-paper"/>
      <text x={60} y={48} className="da-note-title">Business • Strategy Canvas</text>
      <g className="da-business-grid">
        <rect x={60} y={64} width={130} height={72} rx={8} className="da-card"/><text x={125} y={96} textAnchor="middle" className="da-card-label">Strengths</text><text x={125} y={116} textAnchor="middle" className="da-card-sub">Internal</text>
        <rect x={204} y={64} width={130} height={72} rx={8} className="da-card"/><text x={269} y={96} textAnchor="middle" className="da-card-label">Weaknesses</text><text x={269} y={116} textAnchor="middle" className="da-card-sub">Internal</text>
        <rect x={348} y={64} width={120} height={72} rx={8} className="da-card active"/><text x={408} y={96} textAnchor="middle" className="da-card-label">Opportunities</text><text x={408} y={116} textAnchor="middle" className="da-card-sub">External</text>
        <rect x={482} y={64} width={100} height={72} rx={8} className="da-card"/><text x={532} y={96} textAnchor="middle" className="da-card-label">Threats</text><text x={532} y={116} textAnchor="middle" className="da-card-sub">External</text>
        <rect x={60} y={154} width={540} height={48} rx={8} className="da-card is-wide"/><text x={330} y={183} textAnchor="middle" className="da-card-label">Case Work • Presentation • Report Structure</text>
      </g>
    </svg>
  )
}
function MathProblemVisual() {
  const [step, setStep] = useState(1)
  const steps = [
    {label:'1. Understand', sub:'Given • Find', x:60},
    {label:'2. Plan', sub:'Formula • Method', x:240},
    {label:'3. Solve & Check', sub:'Compute • Verify', x:420},
  ]
  return (
    <svg viewBox="0 0 640 280" className="da-diagram">
      <rect x={40} y={20} width={560} height={240} rx={14} className="da-paper"/>
      <rect x={40} y={20} width={560} height={36} rx={14} className="da-paper-header"/><rect x={40} y={34} width={560} height={14} className="da-paper-header no-radius"/>
      <text x={60} y={42} className="da-paper-header-label">Mathematics • Problem Solving • Click steps</text>
      <g className="da-math-steps">
        {steps.map((s,i)=> <g key={s.label} onClick={()=> setStep(i)} style={{cursor:'pointer'}}><rect x={s.x} y={64} width={s.x===420?160:150} height={56} rx={10} className={step===i?'da-step active':'da-step'}/><text x={s.x+(s.x===420?80:75)} y={86} textAnchor="middle" className="da-step-label">{s.label}</text><text x={s.x+(s.x===420?80:75)} y={106} textAnchor="middle" className="da-step-sub">{s.sub}</text></g>)}
        <text x={222} y={96} className="da-arrow">→</text><text x={402} y={96} className="da-arrow">→</text>
      </g>
      <g onClick={()=> setStep((step+1)%3)} style={{cursor:'pointer'}}><rect x={60} y={140} width={540} height={38} rx={10} className="da-math-highlight"/><text x={70} y={163} className="da-math-expr">Example: {step===0?'Identify: 2x+5=17, find x':step===1?'Plan: 2x=12 → x=6':'Check: 2×6+5=17 ✓'}</text><text x={580} y={163} textAnchor="end" className="da-math-action">{['Understand ●','Plan ●','Solve ●'][step]}</text></g>
      <text x={60} y={196} className="da-math-expr small">{step===0?'Given: 2x+5=17 • Find x':step===1?'Method: isolate x • divide both sides':'Verify: substitute x=6 • check'} — click steps to cycle</text>
      <g onClick={()=> setStep(0)} style={{cursor:'pointer'}}><rect x={60} y={210} width={540} height={36} rx={10} className="da-math-box"/><text x={330} y={232} textAnchor="middle" className="da-math-box-label">Practice • Feedback • QA — Click to reset</text></g>
    </svg>
  )
}
function CyberConceptsVisual() {
  return (
    <svg viewBox="0 0 640 280" className="da-diagram">
      <circle cx={320} cy={124} r={72} className="da-cyber-circle"/><text x={320} y={130} textAnchor="middle" className="da-cyber-center">CIA Triad</text>
      <g className="da-cyber-nodes">
        <rect x={165} y={52} width={120} height={40} rx={20} className="da-node"/><text x={225} y={76} textAnchor="middle" className="da-node-label">Confidentiality</text>
        <rect x={355} y={52} width={120} height={40} rx={20} className="da-node"/><text x={415} y={76} textAnchor="middle" className="da-node-label">Integrity</text>
        <rect x={260} y={208} width={120} height={40} rx={20} className="da-node"/><text x={320} y={232} textAnchor="middle" className="da-node-label">Availability</text>
      </g>
      <path d="M225 82 L 265 105 M415 82 L 375 105 M320 208 L 320 198" className="da-line"/>
      <rect x={210} y={138} width={220} height={44} rx={12} className="da-shield-box"/><text x={320} y={164} textAnchor="middle" className="da-shield-label">Security Concepts • Documentation</text><text x={320} y={176} textAnchor="middle" className="da-shield-sub">padded • verified</text>
    </svg>
  )
}
function ScienceLabVisual() {
  const [sel, setSel] = useState(2)
  const [hovered, setHovered] = useState(null)
  return (
    <svg viewBox="0 0 640 280" className="da-diagram">
      <rect x={40} y={20} width={380} height={240} rx={12} className="da-paper"/>
      <rect x={40} y={20} width={380} height={34} rx={12} className="da-paper-header"/><rect x={40} y={32} width={380} height={12} className="da-paper-header no-radius"/>
      <text x={60} y={42} className="da-paper-header-label">Science • Lab Report</text>
      {['Aim & Hypothesis','Method','Results • Data','Analysis','Conclusion'].map((t,i)=> <g key={t} onClick={()=> setSel(i)} style={{cursor:'pointer'}}><rect x={60} y={64+i*28} width={340} height={22} rx={6} className={sel===i?'da-paper-sec active':'da-paper-sec'}/><text x={72} y={79+i*28} className="da-paper-label">{String(i+1).padStart(2,'0')}  {t}</text></g>)}
      <g className="da-lab-side">
        <rect x={440} y={40} width={160} height={90} rx={10} className="da-side-card"/><text x={520} y={70} textAnchor="middle" className="da-side-title">Beaker • 250ml</text><text x={520} y={90} textAnchor="middle" className="da-side-desc">pH 7.2 • 24°C</text><circle cx={520} cy={108} r={14} className="da-beaker"/>
        <rect x={440} y={150} width={160} height={70} rx={10} className="da-side-card"/><text x={520} y={178} textAnchor="middle" className="da-side-title">Data Table</text><text x={520} y={198} textAnchor="middle" className="da-side-desc">3 trials • Avg</text>
      </g>
    </svg>
  )
}
function GenericVisual({ domain }) {
  if(domain.visual==='cyber') return <CyberVisual/>
  if(domain.visual==='writing') return <WritingVisual/>
  if(domain.visual==='school') return <SchoolVisual/>
  if(domain.visual==='it') return <ITVisual sub={domain.subcategories[0].id}/>
  return <ITVisual sub="programming"/>
}

export function DomainsPage() {
  const query = useQueryParams()
  const [selected, setSelected] = useState(0)
  const [subIdx, setSubIdx] = useState(0)

  const [search, setSearch] = useState('')
  const [spectrumHover, setSpectrumHover] = useState(1)

  useEffect(()=>{
    if(query.domain){
      const idx = domainsData.findIndex(d=> d.id===query.domain)
      if(idx!==-1){ setSelected(idx); if(query.area){ const sidx = domainsData[idx].subcategories.findIndex(s=> s.id===query.area); if(sidx!==-1) setSubIdx(sidx)}}
    }
  },[query.domain, query.area])

  useEffect(()=>{ setSubIdx(0) },[selected])

  const activeDomain = domainsData[selected]
  const activeSub = activeDomain.subcategories[subIdx] || activeDomain.subcategories[0]

  const searchResults = useMemo(()=>{
    const q = search.trim().toLowerCase()
    if(!q) return []
    const results = []
    domainsData.forEach(d=>{
      const domainMatch = d.name.toLowerCase().includes(q) || d.keywords.some(k=> k.includes(q))
      d.subcategories.forEach(s=>{
        const subMatch = s.name.toLowerCase().includes(q) || s.keywords.some(k=> q.includes(k) || k.includes(q)) || s.tasks.some(t=> t.toLowerCase().includes(q))
        if(domainMatch || subMatch){
          results.push({ domain:d, sub:s, score: subMatch? 2 : 1 })
        }
      })
    })
    return results.sort((a,b)=> b.score - a.score).slice(0,4)
  },[search])

  const bestMatch = searchResults[0] || null

  return (
    <div className="domains-page">
      {/* 01 HERO */}
      <section className="da-hero">
        <div className="da-container da-hero-grid">
          <div className="da-hero-copy">
            <span className="da-eyebrow">STUDY DOMAINS</span>
            <h1>Find where your<br/><em>academic challenge belongs.</em></h1>
            <p>Explore the academic areas currently supported by SolveNest, or search for your subject, task type or topic.</p>
            <div className={`da-search ${search?'is-focused':''}`}>
              <Search size={18}/>
              <input value={search} onChange={e=> setSearch(e.target.value)} placeholder="Try ‘database’, ‘research report’, ‘cybersecurity’…" aria-label="Search domains"/>
              <button className="da-search-btn" onClick={()=> { if(bestMatch){ const di = domainsData.findIndex(d=> d.id===bestMatch.domain.id); if(di!==-1){ setSelected(di); const si = domainsData[di].subcategories.findIndex(s=> s.id===bestMatch.sub.id); if(si!==-1) setSubIdx(si); } } }}>Search</button>
            </div>
            {search && (
              <div className="da-search-results">
                {searchResults.length? searchResults.map(r=> (
                  <button key={r.domain.id+r.sub.id} className={`da-result ${bestMatch===r?'is-best':''}`} onClick={()=>{ const di = domainsData.findIndex(d=> d.id===r.domain.id); setSelected(di); const si = domainsData[di].subcategories.findIndex(s=> s.id===r.sub.id); setSubIdx(si); setSearch('')}}>
                    <span className="da-result-domain">{r.domain.name}</span><span>→</span><b>{r.sub.name}</b>{bestMatch===r && <span className="da-best">Best Match</span>}
                  </button>
                )) : (
                  <div className="da-search-empty">
                    <p>We couldn't confidently match that subject.</p>
                    <button onClick={()=> navigate('/analyze')}>Analyze the brief instead <ArrowRight size={14}/></button>
                  </div>
                )}
              </div>
            )}
            <button className="da-hero-secondary" onClick={()=> navigate('/analyze')}>Not sure? Analyze your task <ArrowRight size={14}/></button>
          </div>
          <div className={`da-hero-index ${search?'is-searching':''}`}>
            {domainsData.slice(0,4).map((d,i)=> (
              <motion.div key={d.id} className={`da-sheet ${selected===i?'is-active':''} ${bestMatch && bestMatch.domain.id===d.id?'is-highlight':''}`} initial={{ x: 18*i, y: 8*i }} animate={{ x: 18*i, y: 8*i }} whileHover={{ x: 18*i+10, y: 8*i-4 }} transition={{ delay: i*0.08 }} onClick={()=> setSelected(domainsData.findIndex(x=> x.id===d.id))}>
                <span className="da-sheet-symbol">{d.symbol}</span>
                <b>{d.name.toUpperCase()}</b>
                <small>{d.desc}</small>
                <span className="da-sheet-graphic" aria-hidden="true">
                  {d.visual==='it' && <span className="da-mini-graph it"/>}
                  {d.visual==='cyber' && <span className="da-mini-graph cyber"/>}
                  {d.visual==='writing' && <span className="da-mini-graph writing"/>}
                  {d.visual==='school' && <span className="da-mini-graph school"/>}
                </span>
                <span className="da-sheet-subs">{d.subcategories.slice(0,3).map(s=> <i key={s.id}>{s.name}</i>)}</span>
              </motion.div>
            ))}
            <span className="da-hero-index-caption">ACADEMIC INDEX • {domainsData.length} DOMAINS</span>
          </div>
        </div>
      </section>

      {/* 02 ACADEMIC ATLAS */}
      <section className="da-atlas">
        <div className="da-container">
          <div className="da-atlas-head">
            <h2>Explore the academic atlas.</h2>
            <p>Select a domain to explore the areas and support currently available.</p>
          </div>
          <div className="da-atlas-grid">
            <nav className="da-domain-index" aria-label="Domains">
              {domainsData.map((d,i)=> (
                <button key={d.id} className={selected===i?'is-active':''} onClick={()=> setSelected(i)} aria-selected={selected===i}>
                  <span className="da-index-num">{String(i+1).padStart(2,'0')}</span>
                  <span className="da-index-main"><b>{d.name}</b><small>{d.desc}</small></span>
                  <span className="da-index-symbol">{d.symbol}</span>
                  {selected===i && <motion.i layoutId="da-active-accent" className="da-active-accent"/>}
                </button>
              ))}
            </nav>
            <div className="da-canvas">
              <div className="da-canvas-head">
                <div>
                  <span className="da-canvas-kicker">{activeDomain.symbol} • {activeDomain.name.toUpperCase()}</span>
                  <h3>{activeDomain.name}</h3>
                  <p>{activeDomain.desc}. Select a subcategory to see the visual map.</p>
                </div>
                <span className="da-canvas-status">ACTIVE • {activeDomain.subcategories.length} areas</span>
              </div>
              <div className="da-sub-rail" role="tablist">
                {activeDomain.subcategories.map((s,i)=> (
                  <button key={s.id} role="tab" aria-selected={subIdx===i} className={subIdx===i?'is-active':''} onClick={()=> setSubIdx(i)}>
                    {s.name}
                    {subIdx===i && <motion.i layoutId="da-sub-accent"/>}
                  </button>
                ))}
              </div>
              <AnimatePresence mode="wait">
                <motion.div key={activeDomain.id+activeSub.id} initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-8 }} transition={{ duration:0.35 }} className="da-visual">
                  <div className={`da-visual-hero da-hero-${activeDomain.visual}`}>
                    <span className="da-visual-hero-icon">
                      {activeSub.id==='databases' && <Database size={22}/>}
                      {activeSub.id==='web-dev' && <Globe size={22}/>}
                      {activeSub.id==='programming' && <Code2 size={22}/>}
                      {activeSub.id==='documentation' && <FileText size={22}/>}
                      {activeSub.id==='ai-foundations' && <Sparkles size={22}/>}
                      {activeDomain.visual==='cyber' && <Shield size={22}/>}
                      {activeDomain.visual==='writing' && <BookOpen size={22}/>}
                      {activeDomain.visual==='school' && <GraduationCap size={22}/>}
                      {activeDomain.visual==='engineering' && <Layers size={22}/>}
                      {activeDomain.visual==='data' && <BarChart3 size={22}/>}
                      {activeDomain.visual==='business' && <Briefcase size={22}/>}
                      {activeDomain.visual==='math' && <Calculator size={22}/>}
                      {activeDomain.visual==='science' && <Beaker size={22}/>}
                      {!['databases','web-dev','programming','documentation','ai-foundations'].includes(activeSub.id) && !['cyber','writing','school','engineering','data','business','math','science'].includes(activeDomain.visual) && <Layers size={22}/>}
                    </span>
                    <div className="da-visual-hero-text">
                      <b>{activeSub.name}</b>
                      <small>{activeDomain.name} • {activeSub.tasks[0]}</small>
                    </div>
                    <span className="da-visual-hero-badge">{activeDomain.subcategories.length} areas • {activeSub.tasks.length} tasks</span>
                  </div>
                  <div className="da-visual-diagram">
                    {activeSub.id==='programming' && <ITVisual sub="programming"/>}
                    {activeSub.id==='web-dev' && <ITVisual sub="web-dev"/>}
                    {activeSub.id==='databases' && <ITVisual sub="databases"/>}
                    {activeSub.id==='documentation' && <ITVisual sub="documentation"/>}
                    {activeSub.id==='ai-foundations' && <ITVisual sub="ai-foundations"/>}
                    {activeSub.id==='structure' && <EngStructureVisual/>}
                    {activeSub.id==='reports' && <EngReportsVisual/>}
                    {activeSub.id==='analysis' && <DataAnalysisVisual/>}
                    {activeSub.id==='visualisation' && <DataVizVisual/>}
                    {activeSub.id==='strategy' && <BusinessVisual/>}
                    {activeSub.id==='essays' && <WritingVisual active={0}/>}
                    {activeSub.id==='research' && <WritingVisual active={1}/>}
                    {activeSub.id==='citations' && <WritingVisual active={5}/>}
                    {activeSub.id==='problem' && <MathProblemVisual/>}
                    {activeSub.id==='concepts' && <CyberConceptsVisual/>}
                    {activeSub.id==='defensive' && <CyberVisual/>}
                    {activeSub.id==='lab' && <ScienceLabVisual/>}
                    {activeSub.id==='revision' && <SchoolVisual/>}
                  </div>
                  <div className="da-visual-tasks">
                    {activeSub.tasks.slice(0,4).map(t=> <span key={t}><Check size={10}/>{t}</span>)}
                  </div>
                </motion.div>
              </AnimatePresence>
              <div className="da-canvas-foot">
                <span><Check size={12}/> Hover diagram to reveal details</span>
                <span>Visual language adapts per domain</span>
              </div>
            </div>
          </div>
        </div>
      </section>


      {/* 04 SUPPORT SPECTRUM */}
      <section className="da-spectrum">
        <div className="da-container">
          <h3>Different tasks need different kinds of support.</h3>
          <div className="da-spectrum-rail">
            {[
              ['EXPLAIN','annotated concept', <Lightbulb key="e" size={16}/>],
              ['PLAN','structured outline', <Layers key="p" size={16}/>],
              ['GUIDE','working doc/code', <Code2 key="g" size={16}/>],
              ['REVIEW','quality annotation', <FileCheck key="r" size={16}/>],
            ].map(([label,desc,icon],i)=> (
              <button key={label} className={spectrumHover===i?'is-active':''} onMouseEnter={()=> setSpectrumHover(i)} onClick={()=> setSpectrumHover(i)}>
                <span className="da-spectrum-icon">{icon}</span><b>{label}</b><small>{desc}</small>
                {spectrumHover===i && <motion.i layoutId="spectrum-accent"/>}
              </button>
            ))}
          </div>
          <div className="da-spectrum-preview">
            {spectrumHover===0 && <p><Lightbulb size={14}/> Annotated concept — Solvy highlights the core idea and related requirements.</p>}
            {spectrumHover===1 && <p><Layers size={14}/> Structured outline — Approach, sections, and dependencies mapped before building.</p>}
            {spectrumHover===2 && <p><Code2 size={14}/> Working document/code with suggestions — Guidance inside your draft, not replacement.</p>}
            {spectrumHover===3 && <p><FileCheck size={14}/> Quality annotation — Coverage, citation, and formatting reviewed before delivery.</p>}
          </div>
          <p className="da-spectrum-note">SolveNest support is provided within our academic integrity and acceptable-use boundaries. <button onClick={()=> navigate('/method')}>Learn about responsible support <ArrowRight size={12}/></button></p>
        </div>
      </section>

      {/* 05 NOT SURE */}
      <section className="da-notsure">
        <div className="da-container da-notsure-grid">
          <div className="da-notsure-copy">
            <span className="da-eyebrow">NOT LISTED?</span>
            <h3>Can't find the exact subject?</h3>
            <p>Upload the brief. Solvy can analyse the request and route it for feasibility review.</p>
            <button className="da-cta" onClick={()=> navigate('/analyze')}>Analyze My Task <ArrowRight size={16}/></button>
            <small>No account required to begin.</small>
          </div>
          <div className="da-notsure-visual">
            <div className="da-brief">
              <span className="da-brief-kicker">BRIEF</span>
              <h4>Environmental Systems Case Study</h4>
              <p>Interdisciplinary case — systems, data, and report structure.</p>
              <div className="da-brief-analysis">
                <motion.div initial={{ opacity:0 }} whileInView={{ opacity:1 }} viewport={{ once:true }} className="da-analysis-row"><small>Solvy detects:</small></motion.div>
                {[
                  ['Category','Needs Review'],
                  ['Relevant areas','Science • Data • Academic Writing'],
                  ['Next','Feasibility Review'],
                ].map(([k,v],i)=> (
                  <motion.div key={k} initial={{ opacity:0, x:10 }} whileInView={{ opacity:1, x:0 }} viewport={{ once:true }} transition={{ delay: i*0.12 }} className="da-analysis-item"><small>{k}</small><b>{v}</b></motion.div>
                ))}
              </div>
            </div>
            <span className="da-notsure-caption">Document → Solvy classification → Feasibility gate</span>
          </div>
        </div>
      </section>

      {/* 06 FINAL CTA */}
      <section className="da-final">
        <div className="da-container da-final-grid">
          <div className="da-final-copy">
            <h2>Found your area?<br/><em>Now let Solvy read the task.</em></h2>
            <p>Upload your brief and receive an initial structured estimate before creating an account.</p>
            <div className="da-final-actions">
              <button className="da-cta is-dark" onClick={()=> navigate('/analyze')}>Analyze My Task <ArrowUpRight size={16}/></button>
              <button className="da-secondary" onClick={()=> navigate('/method')}>Explore The SolveNest Method <ArrowRight size={14}/></button>
            </div>
          </div>
          <div className="da-final-index">
            {domainsData.slice(0,4).map((d,i)=> (
              <span key={d.id} style={{ transform:`translateX(${i*8}px)` }}><i>{d.symbol}</i>{d.name}</span>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}

export default DomainsPage
