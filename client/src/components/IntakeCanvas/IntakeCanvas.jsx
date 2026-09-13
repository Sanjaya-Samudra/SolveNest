/**
 * IntakeCanvas.jsx — Analyze desk, matched to SolveNest premium theme
 * ─────────────────────────────────────────────────────────────────────────
 * Keeps the requested desk interaction (drop physics, markup reveal,
 * attachments, CTA hover lift), but reskinned to the application system:
 * midnight/navy page, ivory paper, violet/indigo intelligence accents,
 * cyan labels, DM Sans / Playfair Display / DM Mono.
 *
 * Props:
 *  - onAnalyze({ brief, rubric, references, other })
 *  - onUpload(file, onProgress) — awaited before the markup reveal
 *  - onPreview(file) — optional
 */
import { useEffect, useRef } from 'react'
import { ArrowRight, Paperclip, UploadCloud } from 'lucide-react'

const ACCEPTED = ['pdf', 'docx', 'pptx', 'jpg', 'jpeg', 'png']
const MAX_MB = 25

export function IntakeCanvas({ onAnalyze, onUpload, onPreview }) {
  const mountRef = useRef(null)
  const onAnalyzeRef = useRef(onAnalyze)
  const onUploadRef = useRef(onUpload)
  const onPreviewRef = useRef(onPreview)
  useEffect(() => { onAnalyzeRef.current = onAnalyze }, [onAnalyze])
  useEffect(() => { onUploadRef.current = onUpload }, [onUpload])
  useEffect(() => { onPreviewRef.current = onPreview }, [onPreview])

  useEffect(() => {
    const root = mountRef.current
    if (!root) return
    const q = (sel) => root.querySelector(sel)
    const qa = (sel) => Array.from(root.querySelectorAll(sel))
    const motes = q('.sni-motes')
    const paper = q('.sni-paper')
    const idle = q('.sni-idle')
    const doc = q('.sni-doc')
    const hit = q('.sni-hit')
    const chooseBtn = q('.sni-choose')
    const idleText = q('.sni-idle-title')
    const errText = q('.sni-error')
    const fileInput = q('.sni-file-input')
    const clipInput = q('.sni-clip-input')
    const marginRule = q('.sni-margin-rule')
    const announce = q('.sni-live')
    const cta = q('.sni-cta')
    const uploadBar = q('.sni-upload')
    const uploadFill = q('.sni-upload-fill')
    const uploadLabel = q('.sni-upload-label')
    if (!paper) return

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const ext = (n) => (n.split('.').pop() || '').toLowerCase()
    const okFile = (f) => ACCEPTED.includes(ext(f.name))
    const tooBig = (f) => f.size > MAX_MB * 1048576
    const fmt = (b) => (b < 1048576 ? `${Math.round(b / 1024)} KB` : `${(b / 1048576).toFixed(1)} MB`)
    const displayName = (name) => {
      const base = name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim()
      return base.length > 44 ? `${base.slice(0, 44)}…` : (base || 'Untitled brief')
    }
    const say = (msg) => { if (announce) announce.textContent = msg }

    let dragDepth = 0
    let hasDoc = false
    let clipTarget = null
    let briefFile = null
    const attached = { rubric: null, refs: null, other: [] }
    const timers = []

    // Ambient micro-particles in the app's violet/cyan language.
    if (motes && !reduced) {
      for (let i = 0; i < 6; i += 1) {
        const m = document.createElement('span')
        m.className = 'sni-mote'
        if (i % 2) m.classList.add('is-cyan')
        m.style.left = `${8 + Math.random() * 84}%`
        m.style.top = `${12 + Math.random() * 62}%`
        m.style.setProperty('--dx', `${Math.round(Math.random() * 44 - 18)}px`)
        m.style.setProperty('--dy', `${Math.round(-90 - Math.random() * 90)}px`)
        m.style.animationDuration = `${(9 + Math.random() * 5).toFixed(1)}s`
        m.style.animationDelay = `${(Math.random() * 7).toFixed(1)}s`
        motes.appendChild(m)
      }
    }

    const handleValidation = (f) => {
      if (!okFile(f)) {
        errText.style.display = 'block'
        errText.textContent = `"${f.name}" isn’t a supported file type.`
        say(errText.textContent)
        return false
      }
      if (tooBig(f)) {
        errText.style.display = 'block'
        errText.textContent = `"${f.name}" is over ${MAX_MB}MB.`
        say(errText.textContent)
        return false
      }
      errText.style.display = 'none'
      return true
    }

    const fadeIn = (el, delay) => {
      if (!el) return
      if (reduced) { el.style.opacity = '1'; el.style.transform = 'none'; return }
      timers.push(setTimeout(() => el.classList.add('is-in'), delay))
    }

    const wireAnn = (name) => {
      const path = q(`[data-ann-path="${name}"]`)
      if (!path) return () => {}
      const len = path.getTotalLength()
      path.style.strokeDasharray = len
      path.style.strokeDashoffset = len
      const nib = q(`[data-ann-nib="${name}"]`)
      const motion = q(`[data-ann-motion="${name}"]`)
      return (duration) => {
        path.getBoundingClientRect()
        path.style.transition = `stroke-dashoffset ${duration}s cubic-bezier(.3,.6,.3,1)`
        requestAnimationFrame(() => { path.style.strokeDashoffset = '0' })
        if (nib) {
          nib.style.opacity = '1'
          if (motion && motion.beginElement) { try { motion.beginElement() } catch {} }
          timers.push(setTimeout(() => { nib.style.transition = 'opacity .3s ease'; nib.style.opacity = '0' }, duration * 1000 + 120))
        }
      }
    }
    const markDeadline = wireAnn('deadline')
    const markTask = wireAnn('task')
    const markRubric = wireAnn('rubric')

    const runAnnotationSequence = () => {
      fadeIn(q('.sni-doc-title'), 70)
      fadeIn(q('.sni-doc-meta-row'), 170)
      fadeIn(q('.sni-doc-para'), 290)
      fadeIn(q('.sni-doc-section'), 410)
      qa('.sni-doc-bar').forEach((b, i) => fadeIn(b, 480 + i * 70))
      fadeIn(q('.sni-doc-actions'), 540)
      timers.push(setTimeout(() => markDeadline(0.55), 800))
      timers.push(setTimeout(() => q('.sni-tag-deadline')?.classList.add('show'), 1070))
      timers.push(setTimeout(() => say('Deadline noted.'), 1120))
      timers.push(setTimeout(() => markTask(0.5), 1400))
      timers.push(setTimeout(() => q('.sni-tag-task')?.classList.add('show'), 1650))
      timers.push(setTimeout(() => markRubric(0.35), 2000))
      timers.push(setTimeout(() => q('.sni-tag-rubric')?.classList.add('show'), 2120))
      timers.push(setTimeout(() => say('Task and rubric structure extracted.'), 2170))
      timers.push(setTimeout(() => fadeIn(q('.sni-attachments'), 0), 2420))
      timers.push(setTimeout(() => { fadeIn(q('.sni-cta-row'), 0); if (cta) cta.disabled = false }, 2570))
    }

    const revealDocument = async (file) => {
      briefFile = file
      hasDoc = true
      idle.style.display = 'none'
      doc.classList.add('show')
      if (marginRule) marginRule.style.display = 'block'
      q('.sni-doc-title').textContent = displayName(file.name)
      const fm = q('.sni-file-meta')
      if (fm) fm.textContent = `${file.name} · ${fmt(file.size)}`
      say(`${file.name} received. Reading document.`)

      if (onUploadRef.current) {
        if (uploadBar) uploadBar.hidden = false
        if (uploadLabel) uploadLabel.textContent = 'Uploading brief…'
        try {
          await onUploadRef.current(file, (pct) => {
            const v = Math.max(0, Math.min(100, Math.round(pct || 0)))
            if (uploadFill) uploadFill.style.width = `${v}%`
            if (uploadLabel) uploadLabel.textContent = `Uploading brief… ${v}%`
          })
        } catch (e) {
          errText.style.display = 'block'
          errText.textContent = e?.message || 'Upload failed.'
          say(errText.textContent)
          return
        } finally {
          if (uploadBar) {
            timers.push(setTimeout(() => { uploadBar.hidden = true }, 450))
          }
        }
      }
      runAnnotationSequence()
    }

    const dropWithPhysics = (file, clientX, clientY) => {
      if (!handleValidation(file)) return
      if (reduced) { revealDocument(file); return }
      const ghost = document.createElement('div')
      ghost.className = 'sni-ghost'
      ghost.innerHTML = `<span class="sni-ghost-icon">↧</span><span>${file.name}</span>`
      document.body.appendChild(ghost)
      ghost.style.display = 'flex'
      const targetRect = paper.getBoundingClientRect()
      const targetX = targetRect.left + targetRect.width / 2 - 70
      const targetY = targetRect.top + 76
      let x = clientX - 70
      let y = clientY - 42
      let vy = 0
      let rot = Math.random() * 22 - 11
      const gravity = 0.0021
      const fall = () => {
        vy += gravity * 16
        y += vy * 16 * 0.06 + 2
        x += (targetX - x) * 0.055
        rot += (0 - rot) * 0.045
        ghost.style.transform = `translate(${x}px,${y}px) rotate(${rot.toFixed(1)}deg)`
        if (y < targetY - 4) {
          requestAnimationFrame(fall)
        } else {
          paper.classList.add('impact')
          timers.push(setTimeout(() => paper.classList.remove('impact'), 340))
          ghost.style.transition = 'transform .38s cubic-bezier(.34,1.6,.55,1), opacity .25s ease .28s'
          ghost.style.transform = `translate(${targetX}px,${targetY - 6}px) rotate(0deg)`
          ghost.style.opacity = '0'
          timers.push(setTimeout(() => { ghost.remove(); revealDocument(file) }, 420))
        }
      }
      requestAnimationFrame(fall)
    }

    const onDragEnter = (e) => { e.preventDefault(); dragDepth += 1; if (!hasDoc) { paper.classList.add('is-drag'); if (idleText) idleText.textContent = 'Release to add it' } }
    const onDragOver = (e) => e.preventDefault()
    const onDragLeave = () => { dragDepth = Math.max(0, dragDepth - 1); if (dragDepth === 0) { paper.classList.remove('is-drag'); if (idleText) idleText.textContent = 'Drop your brief on the desk' } }
    const onDrop = (e) => {
      e.preventDefault()
      dragDepth = 0
      paper.classList.remove('is-drag')
      if (idleText) idleText.textContent = 'Drop your brief on the desk'
      const files = Array.from(e.dataTransfer.files || [])
      if (files.length) dropWithPhysics(files[0], e.clientX, e.clientY)
    }
    paper.addEventListener('dragenter', onDragEnter)
    paper.addEventListener('dragover', onDragOver)
    paper.addEventListener('dragleave', onDragLeave)
    paper.addEventListener('drop', onDrop)

    const onHitClick = () => fileInput.click()
    const onHitKey = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click() } }
    const onChooseClick = (e) => { e.stopPropagation(); fileInput.click() }
    const onFileChange = (e) => {
      const f = e.target.files[0]
      e.target.value = ''
      if (f) {
        const r = paper.getBoundingClientRect()
        dropWithPhysics(f, r.left + r.width / 2, r.top - 40)
      }
    }
    hit.addEventListener('click', onHitClick)
    hit.addEventListener('keydown', onHitKey)
    chooseBtn.addEventListener('click', onChooseClick)
    fileInput.addEventListener('change', onFileChange)

    const resetAnnotations = () => {
      qa('.is-in').forEach((el) => el.classList.remove('is-in'))
      qa('.sni-tag.show').forEach((el) => el.classList.remove('show'))
      ;['deadline', 'task', 'rubric'].forEach((name) => {
        const p = q(`[data-ann-path="${name}"]`)
        if (p) { p.style.transition = 'none'; try { p.style.strokeDashoffset = p.getTotalLength() } catch {} }
      })
    }
    const onRemove = () => {
      hasDoc = false
      briefFile = null
      doc.classList.remove('show')
      idle.style.display = 'flex'
      if (marginRule) marginRule.style.display = 'none'
      resetAnnotations()
      if (cta) { cta.disabled = true; cta.querySelector('span').textContent = 'Continue with SolveNest' }
      attached.rubric = null
      attached.refs = null
      attached.other = []
      qa('.sni-clip').forEach((b) => b.classList.remove('filled'))
      qa('.sni-clip-wrap').forEach((w) => w.classList.remove('dangle'))
      const labels = { rubric: 'Attach rubric', refs: 'Attach sources', other: 'Attach other files' }
      Object.entries(labels).forEach(([key, text]) => {
        const el = q(`[data-clip-label="${key}"]`)
        if (el) el.textContent = text
      })
      say('Brief removed.')
    }
    const onReplace = () => fileInput.click()
    const removeBtn = q('.sni-remove')
    const replaceBtn = q('.sni-replace')
    const previewBtn = q('.sni-preview')
    if (removeBtn) removeBtn.addEventListener('click', onRemove)
    if (replaceBtn) replaceBtn.addEventListener('click', onReplace)
    if (previewBtn) previewBtn.addEventListener('click', () => { if (briefFile && onPreviewRef.current) onPreviewRef.current(briefFile) })

    const onClipClick = (e) => {
      const btn = e.target.closest('[data-clip]')
      if (!btn) return
      clipTarget = btn.getAttribute('data-clip')
      clipInput.click()
    }
    const attachments = q('.sni-attachments')
    if (attachments) attachments.addEventListener('click', onClipClick)
    const onClipChange = (e) => {
      const f = e.target.files[0]
      e.target.value = ''
      if (!f || !handleValidation(f)) return
      let key = clipTarget || 'other'
      if (key === 'rubric') attached.rubric = f
      else if (key === 'refs') attached.refs = f
      else { key = 'other'; attached.other.push(f) }
      const btn = q(`[data-clip="${key}"]`)
      const wrap = q(`[data-clip-wrap="${key}"]`)
      const label = q(`[data-clip-label="${key}"]`)
      if (btn) btn.classList.add('filled')
      if (wrap) wrap.classList.add('dangle')
      if (label) {
        label.textContent = key === 'other'
          ? `${attached.other.length} file${attached.other.length > 1 ? 's' : ''} attached`
          : f.name
      }
      say(`${f.name} attached.`)
    }
    clipInput.addEventListener('change', onClipChange)

    const onCtaClick = () => {
      if (!hasDoc || !briefFile) return
      if (onAnalyzeRef.current) {
        onAnalyzeRef.current({
          brief: { file: briefFile },
          rubric: attached.rubric ? { file: attached.rubric } : null,
          references: attached.refs ? { file: attached.refs } : null,
          other: attached.other.map((f) => ({ file: f })),
        })
      } else {
        say('Starting analysis.')
        cta.querySelector('span').textContent = 'Reading in progress…'
        cta.disabled = true
      }
    }
    if (cta) {
      cta.addEventListener('click', onCtaClick)
    }

    return () => {
      timers.forEach(clearTimeout)
      paper.removeEventListener('dragenter', onDragEnter)
      paper.removeEventListener('dragover', onDragOver)
      paper.removeEventListener('dragleave', onDragLeave)
      paper.removeEventListener('drop', onDrop)
      hit.removeEventListener('click', onHitClick)
      hit.removeEventListener('keydown', onHitKey)
      chooseBtn.removeEventListener('click', onChooseClick)
      fileInput.removeEventListener('change', onFileChange)
      if (removeBtn) removeBtn.removeEventListener('click', onRemove)
      if (replaceBtn) replaceBtn.removeEventListener('click', onReplace)
      if (attachments) attachments.removeEventListener('click', onClipClick)
      clipInput.removeEventListener('change', onClipChange)
      if (cta) { cta.removeEventListener('click', onCtaClick) }
      qa('.sni-mote').forEach((m) => m.remove())
      document.querySelectorAll('.sni-ghost').forEach((g) => g.remove())
    }
  }, [])

  return (
    <section className="sni" ref={mountRef} aria-label="Analyze my task">
      <style>{CSS}</style>

      <div className="sni-head">
        <span className="sni-eyebrow"><i />Guest quick scan / Analyze my task</span>
        <h1>Let&apos;s understand<br /><em>your task.</em></h1>
        <p>Drop your brief on the desk. Solvy reads the visible structure and marks up the deadline, task, and rubric before you commit to anything.</p>
      </div>

      <div className="sni-scene">
        <div className="sni-glow sni-glow-a" aria-hidden="true" />
        <div className="sni-glow sni-glow-b" aria-hidden="true" />
        <div className="sni-motes" aria-hidden="true" />

        <div className="sni-stage">
          <span className="sni-corner sni-corner-tl" aria-hidden="true" />
          <span className="sni-corner sni-corner-tr" aria-hidden="true" />
          <span className="sni-corner sni-corner-bl" aria-hidden="true" />
          <span className="sni-corner sni-corner-br" aria-hidden="true" />

          <div className="sni-paper">
            <div className="sni-paper-inner">
              <div className="sni-rules" aria-hidden="true" />
              <div className="sni-margin-rule" style={{ display: 'none' }} aria-hidden="true" />

              <div className="sni-idle">
                <span className="sni-idle-icon"><UploadCloud size={22} strokeWidth={1.6} /></span>
                <h2 className="sni-idle-title">Drop your brief on the desk</h2>
                <button type="button" className="sni-choose">or choose a file</button>
                <span className="sni-support">PDF · DOCX · PPTX · JPG · PNG — up to 25 MB</span>
                <div className="sni-error" style={{ display: 'none' }} role="alert" />
                <div className="sni-hit" role="button" tabIndex={0} aria-label="Upload your brief" />
              </div>

              <div className="sni-doc">
                <div className="sni-doc-top">
                  <span className="sni-doc-kicker"><i />Solvy / First read</span>
                  <span className="sni-doc-state">Markup ready</span>
                </div>
                <h3 className="sni-doc-title">Untitled brief</h3>

                <div className="sni-doc-meta-row">
                  <span className="sni-due">
                    Due Nov 14, 11:59 PM
                    <svg className="sni-ann" viewBox="0 0 150 42" style={{ left: '-8px', top: '-11px', width: '150px', height: '42px' }} aria-hidden="true">
                      <path className="sni-ink" data-ann-path="deadline" d="M9,21 C9,9 42,3 72,4 C107,5 134,11 132,23 C130,35 96,39 66,38 C36,37 9,34 9,21 Z" />
                      <g className="sni-nib" data-ann-nib="deadline">
                        <polygon points="-3,-4 3,-4 0,-9" fill="currentColor" />
                        <line x1="0" y1="-4" x2="0" y2="4" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                        <animateMotion data-ann-motion="deadline" dur="0.55s" fill="freeze" begin="indefinite" rotate="auto" path="M9,21 C9,9 42,3 72,4 C107,5 134,11 132,23 C130,35 96,39 66,38 C36,37 9,34 9,21 Z" />
                      </g>
                    </svg>
                    <span className="sni-tag sni-tag-deadline">deadline noted</span>
                  </span>
                  <span>2,500–3,000 words</span>
                </div>

                <p className="sni-doc-para">
                  Assess a primary source using two peer-reviewed secondary sources.
                  Argue a clear thesis and address at least one counterargument.
                  <svg className="sni-ann" viewBox="0 0 22 92" style={{ left: '-18px', top: '-2px', width: '22px', height: '92px' }} aria-hidden="true">
                    <path className="sni-ink" data-ann-path="task" d="M15,4 C7,4 5,10 5,20 L5,72 C5,82 7,88 15,88" />
                    <g className="sni-nib" data-ann-nib="task">
                      <polygon points="-3,-4 3,-4 0,-9" fill="currentColor" />
                      <line x1="0" y1="-4" x2="0" y2="4" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                      <animateMotion data-ann-motion="task" dur="0.5s" fill="freeze" begin="indefinite" rotate="auto" path="M15,4 C7,4 5,10 5,20 L5,72 C5,82 7,88 15,88" />
                    </g>
                  </svg>
                  <span className="sni-tag sni-tag-task">task extracted</span>
                </p>

                <div className="sni-doc-section">
                  Grading criteria
                  <svg className="sni-ann" viewBox="0 0 24 24" style={{ left: '-26px', top: '0px', width: '18px', height: '18px' }} aria-hidden="true">
                    <path className="sni-ink" data-ann-path="rubric" d="M5 12l5 5 9-10" />
                    <g className="sni-nib" data-ann-nib="rubric">
                      <polygon points="-3,-4 3,-4 0,-9" fill="currentColor" />
                      <line x1="0" y1="-4" x2="0" y2="4" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                      <animateMotion data-ann-motion="rubric" dur="0.35s" fill="freeze" begin="indefinite" rotate="auto" path="M5 12l5 5 9-10" />
                    </g>
                  </svg>
                  <span className="sni-tag sni-tag-rubric">rubric detected</span>
                </div>
                <div className="sni-doc-bars" aria-hidden="true">
                  <span className="sni-doc-bar" /><span className="sni-doc-bar" /><span className="sni-doc-bar" />
                </div>

                <div className="sni-doc-actions">
                  <span className="sni-file-meta">brief.pdf · 340 KB</span>
                  <span className="sni-ops">
                    {onPreview ? <button type="button" className="sni-preview">preview</button> : null}
                    <button type="button" className="sni-replace">replace</button>
                    <button type="button" className="sni-remove">remove</button>
                  </span>
                </div>
                <div className="sni-upload" hidden>
                  <span className="sni-upload-label">Uploading brief…</span>
                  <span className="sni-upload-track"><i className="sni-upload-fill" /></span>
                </div>

                <div className="sni-attachments">
                  {[['rubric', 'Attach rubric'], ['refs', 'Attach sources'], ['other', 'Attach other files']].map(([key, label]) => (
                    <span className="sni-clip-wrap" data-clip-wrap={key} key={key}>
                      <button type="button" className="sni-clip" data-clip={key}>
                        <Paperclip size={11} />
                        <span data-clip-label={key}>{label}</span>
                      </button>
                    </span>
                  ))}
                </div>

                <div className="sni-cta-row">
                  <button type="button" className="sni-cta" disabled>
                    <span>Continue with SolveNest</span>
                    <ArrowRight size={16} />
                  </button>
                  <p className="sni-note">Approximate only · full analysis follows account verification</p>
                </div>
              </div>

              <input type="file" className="sni-file-input" hidden accept=".pdf,.docx,.pptx,.jpg,.jpeg,.png" />
              <input type="file" className="sni-clip-input" hidden accept=".pdf,.docx,.pptx,.jpg,.jpeg,.png" />
            </div>
          </div>
        </div>
      </div>

      <div className="sni-foot">
        <span><i />Private processing</span>
        <span><i />No account required to begin</span>
        <span><i />Estimate only, humans confirm</span>
      </div>
      <div className="sni-live sr-only" role="status" aria-live="polite" />
    </section>
  )
}

const CSS = `
.sni{
  --sni-paper:var(--p-white,#fcfcf8);
  --sni-ink:var(--p-text,#111827);
  --sni-soft:var(--p-muted,#64748b);
  --sni-line:rgba(17,24,39,.08);
  --sni-mark:var(--p-violet,#7c5cff);
  --sni-mark-deep:var(--p-indigo,#5b6cff);
  --sni-cyan:var(--p-cyan,#35d6e8);
  --sni-success:var(--p-success,#22c58b);
  width:min(700px,100%);
  margin:0 auto;
  position:relative;
  z-index:1;
  color:#fff;
  font-family:'DM Sans',sans-serif;
}
.sni-head{text-align:center;margin:0 0 34px;padding:0 8px}
.sni-eyebrow{
  display:inline-flex;align-items:center;gap:9px;
  font:10px 'DM Mono',monospace;letter-spacing:.12em;text-transform:uppercase;
  color:var(--sni-cyan);
}
.sni-eyebrow i{width:7px;height:7px;border-radius:50%;background:var(--sni-cyan);box-shadow:0 0 14px var(--sni-cyan)}
.sni-head h1{
  margin:18px 0 16px;
  font-size:clamp(48px,7vw,72px);
  line-height:.9;
  letter-spacing:-.06em;
  font-weight:600;
  color:#fff;
}
.sni-head h1 em{font-family:'Playfair Display',serif;font-style:italic;font-weight:600;color:#d4cdff}
.sni-head p{margin:0 auto;max-width:500px;color:#aab6cc;line-height:1.7;font-size:15px}

.sni-scene{position:relative;perspective:1200px;perspective-origin:50% 28%}
.sni-glow{position:absolute;pointer-events:none;filter:blur(24px);z-index:0;will-change:transform}
.sni-glow-a{top:-120px;right:-70px;width:380px;height:380px;background:radial-gradient(circle,rgba(124,92,255,.20),transparent 68%);animation:sni-glow-a 9s ease-in-out infinite alternate}
.sni-glow-b{bottom:-90px;left:-80px;width:340px;height:340px;background:radial-gradient(circle,rgba(53,214,232,.12),transparent 68%);animation:sni-glow-b 11s ease-in-out infinite alternate}
@keyframes sni-glow-a{from{transform:translate(0,0)}to{transform:translate(18px,12px)}}
@keyframes sni-glow-b{from{transform:translate(0,0)}to{transform:translate(-16px,12px)}}
.sni-motes{position:absolute;inset:-40px 0 auto 0;height:220px;pointer-events:none;z-index:1;overflow:visible}
.sni-mote{
  position:absolute;width:3px;height:3px;border-radius:50%;
  background:rgba(168,162,255,.7);box-shadow:0 0 10px rgba(124,92,255,.55);
  opacity:0;animation:sni-drift linear infinite;
}
.sni-mote.is-cyan{background:rgba(53,214,232,.65);box-shadow:0 0 10px rgba(53,214,232,.45)}
@keyframes sni-drift{
  0%{opacity:0;transform:translate(0,0)}
  14%{opacity:.75}
  82%{opacity:.45}
  100%{opacity:0;transform:translate(var(--dx,30px),var(--dy,-130px))}
}
.sni-stage{position:relative;transform-style:preserve-3d;will-change:transform;z-index:2}
.sni-corner{position:absolute;width:24px;height:24px;z-index:6;pointer-events:none}
.sni-corner::before,.sni-corner::after{content:'';position:absolute;background:rgba(53,214,232,.42)}
.sni-corner::before{width:100%;height:1px;top:0}
.sni-corner::after{width:1px;height:100%;left:0}
.sni-corner-tl{top:12px;left:12px}
.sni-corner-tr{top:12px;right:12px;transform:scaleX(-1)}
.sni-corner-bl{bottom:12px;left:12px;transform:scaleY(-1)}
.sni-corner-br{bottom:12px;right:12px;transform:scale(-1)}

.sni-paper{
  position:relative;transform-style:preserve-3d;
  background:var(--sni-paper);color:var(--sni-ink);
  border:1px solid rgba(17,24,39,.08);
  border-radius:16px;
  box-shadow:0 28px 65px rgba(2,6,18,.52),0 10px 26px rgba(2,6,18,.28);
  padding:36px 38px 30px;min-height:470px;overflow:visible;will-change:transform;
  transition:box-shadow .3s ease,border-color .3s ease;
  animation:sni-breathe 4.6s ease-in-out infinite;
  transform-origin:50% 40%;
}
@keyframes sni-breathe{
  0%,100%{transform:scale(1)}
  50%{transform:scale(1.012)}
}
.sni-paper:hover{animation-play-state:paused}
.sni-paper:hover .sni-idle-icon{animation-play-state:paused}
.sni-paper.impact{animation:sni-thump .38s cubic-bezier(.34,1.4,.5,1)}
@keyframes sni-thump{
  0%{transform:scale(1)}
  35%{transform:scale(.982)}
  70%{transform:scale(1.006)}
  100%{transform:scale(1)}
}
.sni-paper.is-drag{
  border-color:rgba(124,92,255,.42);
  box-shadow:0 34px 76px rgba(2,6,18,.55),0 0 0 2px rgba(124,92,255,.22);
}
.sni-paper-inner{position:relative;overflow:hidden;border-radius:8px;min-height:392px}
.sni-rules{
  position:absolute;inset:0;pointer-events:none;opacity:.8;
  background-image:repeating-linear-gradient(to bottom,transparent 0,transparent 27px,rgba(17,24,39,.065) 27px,rgba(17,24,39,.065) 28px);
}
.sni-margin-rule{
  position:absolute;top:0;bottom:0;left:72px;width:1px;pointer-events:none;
  background:rgba(124,92,255,.16);
}
.sni-idle{
  position:relative;z-index:2;height:100%;min-height:392px;
  display:flex;flex-direction:column;align-items:center;justify-content:center;
  text-align:center;gap:10px;padding:22px;
}
.sni-idle-icon{
  width:52px;height:52px;border-radius:50%;display:grid;place-items:center;
  color:var(--sni-mark);background:rgba(124,92,255,.10);border:1px solid rgba(124,92,255,.22);
  margin-bottom:8px;animation:sni-bob 3.4s ease-in-out infinite;
}
@keyframes sni-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}
.sni-paper.is-drag .sni-idle-icon{background:rgba(124,92,255,.16);box-shadow:0 0 0 8px rgba(124,92,255,.08)}
.sni-idle-title{font-size:20px;font-weight:600;letter-spacing:-.02em;margin:0;color:var(--sni-ink)}
.sni-choose{
  font:500 12px 'DM Mono',monospace;color:var(--sni-mark);background:none;border:none;cursor:pointer;
  text-decoration:underline;text-decoration-color:rgba(124,92,255,.35);text-underline-offset:3px;padding:2px 0;
}
.sni-support{font:10.5px 'DM Mono',monospace;color:var(--sni-soft)}
.sni-error{font:11.5px 'DM Mono',monospace;color:#b03a3a}
.sni-hit{position:absolute;inset:0;cursor:pointer;z-index:5}
.sni-hit:focus-visible{outline:2px solid var(--sni-mark);outline-offset:-4px;border-radius:12px}
.sni-ghost{
  position:fixed;z-index:60;pointer-events:none;display:none;align-items:center;gap:8px;
  font:11px 'DM Mono',monospace;background:#fff;color:var(--sni-ink);
  border:1px solid rgba(17,24,39,.12);border-radius:8px;padding:8px 11px;
  box-shadow:0 20px 42px rgba(2,6,18,.35);will-change:transform;
}
.sni-ghost-icon{color:var(--sni-mark);font-size:13px}

.sni-doc{position:relative;z-index:2;display:none}
.sni-doc.show{display:block}
.sni-doc-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}
.sni-doc-kicker{display:inline-flex;align-items:center;gap:8px;font:10px 'DM Mono',monospace;letter-spacing:.12em;text-transform:uppercase;color:var(--sni-mark)}
.sni-doc-kicker i{width:6px;height:6px;border-radius:50%;background:var(--sni-mark);box-shadow:0 0 12px var(--sni-mark)}
.sni-doc-state{font:10px 'DM Mono',monospace;letter-spacing:.1em;text-transform:uppercase;color:var(--sni-success)}
.sni-doc-title{font-size:24px;font-weight:600;letter-spacing:-.03em;margin:0 0 8px;opacity:0;transform:translateY(5px)}
.sni-doc-meta-row{display:flex;gap:18px;flex-wrap:wrap;font:12px 'DM Mono',monospace;color:var(--sni-soft);margin-bottom:20px;opacity:0;transform:translateY(5px);position:relative}
.sni-due{position:relative;padding:1px 2px}
.sni-doc-para{font-size:15px;line-height:1.72;max-width:56ch;margin:0 0 22px;opacity:0;transform:translateY(5px);position:relative}
.sni-doc-section{font:11px 'DM Mono',monospace;color:var(--sni-soft);margin-bottom:8px;opacity:0;transform:translateY(5px);position:relative}
.sni-doc-bars{display:flex;flex-direction:column;gap:8px;margin-bottom:22px}
.sni-doc-bar{height:9px;border-radius:3px;background:#e8e6fb;opacity:0;transform:translateY(5px)}
.sni-doc-bar:nth-child(1){width:88%}
.sni-doc-bar:nth-child(2){width:71%}
.sni-doc-bar:nth-child(3){width:79%}
.is-in{animation:sni-up .5s cubic-bezier(.2,.7,.2,1) forwards}
@keyframes sni-up{to{opacity:1;transform:translateY(0)}}
.sni-paper.impact .sni-paper-inner{animation:sni-squash .32s ease}
@keyframes sni-squash{0%{transform:scaleY(1)}35%{transform:scaleY(.976) scaleX(1.005)}100%{transform:scaleY(1)}}
.sni-ann{position:absolute;overflow:visible;pointer-events:none}
.sni-ink{fill:none;stroke:var(--sni-mark);stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
.sni-nib{opacity:0;color:var(--sni-mark)}
.sni-tag{
  position:absolute;font:500 10.5px 'DM Mono',monospace;white-space:nowrap;
  color:var(--sni-mark-deep);background:rgba(124,92,255,.10);border:1px solid rgba(124,92,255,.24);
  border-radius:999px;padding:2px 8px;opacity:0;transform:translateX(-4px);pointer-events:none;
}
.sni-tag.show{animation:sni-tag-in .3s ease forwards}
@keyframes sni-tag-in{to{opacity:1;transform:translateX(0)}}
.sni-tag-deadline{top:-22px;left:4px}
.sni-tag-task{top:0;left:calc(100% + 8px)}
.sni-tag-rubric{top:-3px;left:calc(100% + 8px)}
.sni-doc-actions{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px;opacity:0;transform:translateY(5px);position:relative;z-index:2}
.sni-file-meta{font:11px 'DM Mono',monospace;color:var(--sni-soft)}
.sni-ops{display:flex;gap:14px}
.sni-ops button{
  font:11px 'DM Mono',monospace;background:none;border:none;color:var(--sni-soft);cursor:pointer;
  text-decoration:underline;text-decoration-color:transparent;transition:color .15s,text-decoration-color .15s;
}
.sni-ops button:hover{color:var(--sni-mark);text-decoration-color:rgba(124,92,255,.4)}
.sni-upload{display:flex;align-items:center;gap:10px;margin:0 0 14px;font:11px 'DM Mono',monospace;color:var(--sni-soft)}
.sni-upload[hidden]{display:none}
.sni-upload-track{flex:1;height:4px;border-radius:4px;background:rgba(124,92,255,.14);overflow:hidden}
.sni-upload-fill{display:block;height:100%;width:0;background:linear-gradient(90deg,var(--sni-mark),var(--sni-mark-deep));transition:width .2s}
.sni-attachments{
  display:flex;gap:12px;flex-wrap:wrap;padding-top:18px;border-top:1px dashed rgba(17,24,39,.12);
  opacity:0;transform:translateY(5px);position:relative;z-index:2;
}
.sni-clip-wrap{transform-origin:top center}
.sni-clip-wrap.dangle{animation:sni-dangle 4.4s ease-in-out infinite}
@keyframes sni-dangle{0%,100%{transform:rotate(-1.6deg)}50%{transform:rotate(1.6deg)}}
.sni-clip{
  font:500 11.5px 'DM Mono',monospace;color:var(--sni-soft);background:#fff;
  border:1px dashed rgba(17,24,39,.22);border-radius:8px;padding:8px 11px;
  display:inline-flex;align-items:center;gap:7px;cursor:pointer;
  transition:border-color .15s,color .15s,background .15s,transform .15s,box-shadow .15s;
  max-width:220px;
}
.sni-clip span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sni-clip:hover{border-color:var(--sni-mark);color:var(--sni-mark);background:rgba(124,92,255,.07);transform:translateY(-1px)}
.sni-clip.filled{border-style:solid;border-color:rgba(124,92,255,.32);color:var(--sni-ink);background:rgba(124,92,255,.08)}
.sni-cta-row{margin-top:20px;opacity:0;transform:translateY(5px);position:relative;z-index:2;perspective:500px}
.sni-cta{
  width:100%;appearance:none;border:none;border-radius:10px;padding:15px 19px;
  background:linear-gradient(110deg,var(--sni-mark),var(--sni-mark-deep));color:#fff;
  font:700 12px 'DM Sans',sans-serif;display:flex;align-items:center;justify-content:center;gap:10px;
  cursor:pointer;transform-style:preserve-3d;will-change:transform;
  box-shadow:0 12px 28px rgba(92,90,255,.24);
  transition:transform .12s ease,box-shadow .25s ease,background .15s;
}
.sni-cta:hover:not(:disabled){transform:translateY(-2px);box-shadow:0 17px 35px rgba(92,90,255,.34)}
.sni-cta:active:not(:disabled){transform:scale(.97)}
.sni-cta:disabled{opacity:.42;cursor:not-allowed}
.sni-note{font:10px 'DM Mono',monospace;color:var(--sni-soft);text-align:center;margin:12px 0 0}
.sni-foot{display:flex;gap:18px;flex-wrap:wrap;justify-content:center;margin-top:26px}
.sni-foot span{display:inline-flex;align-items:center;gap:8px;font:10px 'DM Mono',monospace;letter-spacing:.1em;text-transform:uppercase;color:rgba(170,182,208,.72)}
.sni-foot i{width:5px;height:5px;border-radius:50%;background:var(--sni-cyan);box-shadow:0 0 10px var(--sni-cyan)}
.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}
@media (max-width:640px){
  .sni-paper{padding:26px 20px 24px}
  .sni-doc-para{max-width:none}
  .sni-scene{perspective:850px}
  .sni-head h1{font-size:clamp(44px,13vw,58px)}
  .sni-foot{gap:12px}
}
@media (prefers-reduced-motion:reduce){
  .sni-paper,.sni-idle-icon,.sni-clip-wrap.dangle,.sni-mote,.sni-glow-a,.sni-glow-b{animation:none !important}
  .is-in{animation-duration:.01s !important}
}
`
