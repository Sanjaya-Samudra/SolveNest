import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowRight, BookOpen, Brain, Check, ChevronDown, ChevronLeft, ChevronRight,
  Clock, Code2, Download, ExternalLink, FileCode, FileText, FolderOpen, GraduationCap,
  Image as ImageIcon, Lightbulb, ListChecks, Presentation, RefreshCw, Scale, Search,
  Send, ShieldCheck, Sparkles, Square, Table2, TriangleAlert, X, ZoomIn, ZoomOut,
} from 'lucide-react'
import {
  ARTIFACT_KIND_LABELS, LEARNING_MODE, LEARNING_MODES,
  anchorDisplayId, fetchRubric, fetchSessionHistory,
  fetchUsageLimits, formatFileSize, formatDate, formatRelativeTime,
  parseExplainRoute, requestFileAccess, resolveRubricLink, resumeSession, syncExplainRoute,
  useArtifactViewer, useEligibleTasks, useExplainSession, useSourceSelection, useTaskArtifacts,
} from '../../student/studentExplainData.js'
import { buildDossierRoute } from '../../student/studentFilesData.js'

const go = (path) => { window.history.pushState({}, '', path); window.dispatchEvent(new PopStateEvent('popstate')) }

const MODE_ICON = { explain: BookOpen, why: Lightbulb, quiz: Brain, lecturer: GraduationCap, defend: Scale }

const QUIZ_SCOPES = [
  { key: 'quick', label: 'Quick Check' },
  { key: 'deep', label: 'Deep Review' },
  { key: 'task', label: 'Task-wide' },
  { key: 'section', label: 'Selected Section' },
]

function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const media = window.matchMedia(query)
    const handler = (event) => setMatches(event.matches)
    media.addEventListener('change', handler)
    setMatches(media.matches)
    return () => media.removeEventListener('change', handler)
  }, [query])
  return matches
}

function ClickOutside({ onClick, children, enabled = true }) {
  const ref = useRef(null)
  useEffect(() => {
    if (!enabled) return undefined
    const handler = (event) => { if (ref.current && !ref.current.contains(event.target)) onClick() }
    document.addEventListener('mousedown', handler)
    document.addEventListener('touchstart', handler, { passive: true })
    return () => { document.removeEventListener('mousedown', handler); document.removeEventListener('touchstart', handler) }
  }, [onClick, enabled])
  return <span ref={ref} className="sn-ex-clickoutside">{children}</span>
}

function usePopoverPosition(open, anchorRef, containerSelector, { preferBelow = false } = {}) {
  const [style, setStyle] = useState({ top: -9999, left: -9999 })
  useEffect(() => {
    if (!open || !anchorRef.current) return undefined
    const compute = () => {
      const anchor = anchorRef.current
      const rect = anchor?.getBoundingClientRect()
      if (!rect) return
      const container = containerSelector ? anchor.closest(containerSelector) : null
      const cRect = container?.getBoundingClientRect()
      let width = Math.min(360, window.innerWidth - 24)
      if (cRect) width = Math.max(220, Math.min(width, cRect.width - 16))
      let left = rect.left
      if (left + width > window.innerWidth - 12) left = window.innerWidth - width - 12
      left = Math.max(12, left)
      if (cRect) left = Math.max(cRect.left + 8, Math.min(left, cRect.right - width - 8))
      const estimatedHeight = Math.min(340, window.innerHeight * 0.5)
      let top = rect.bottom + 8
      if (preferBelow) {
        const room = window.innerHeight - 12 - top
        const height = Math.max(140, Math.min(estimatedHeight, room))
        setStyle({ top, left, width, maxHeight: height })
        return
      }
      if (top + estimatedHeight > window.innerHeight - 12) top = Math.max(12, rect.top - estimatedHeight - 8)
      setStyle({ top, left, width })
    }
    compute()
    window.addEventListener('resize', compute)
    window.addEventListener('scroll', compute, true)
    return () => { window.removeEventListener('resize', compute); window.removeEventListener('scroll', compute, true) }
  }, [open, anchorRef, containerSelector, preferBelow])
  return style
}

function ArtifactIcon({ kind, size = 15 }) {
  const props = { size, strokeWidth: 1.6 }
  if (kind === 'code') return <FileCode {...props} />
  if (kind === 'presentation') return <Presentation {...props} />
  if (kind === 'dataset') return <Table2 {...props} />
  if (kind === 'image') return <ImageIcon {...props} />
  if (kind === 'report') return <FileText {...props} />
  return <FileText {...props} />
}

function deliveryLabel(task) {
  if (!task) return ''
  const parts = []
  parts.push(task.subject || task.domain || task.title)
  if (task.deliveredAt) parts.push(`Delivered ${formatDate(task.deliveredAt)}`)
  return parts.join(' · ')
}

function modeMeta(mode) {
  return LEARNING_MODES.find((m) => m.key === mode) || LEARNING_MODES[0]
}

function excerpt(text, max = 70) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim()
  return clean.length > max ? `${clean.slice(0, max)}…` : clean
}

function defaultQuestionFor(mode, selectionText, anchorLabel) {
  const focus = selectionText ? `"${excerpt(selectionText, 90)}"` : anchorLabel ? `"${anchorLabel}"` : 'this delivery'
  if (mode === LEARNING_MODE.EXPLAIN) return `Explain this in simple terms: ${focus}`
  if (mode === LEARNING_MODE.WHY) return `Why was this approach used: ${focus}?`
  if (mode === LEARNING_MODE.QUIZ) return `Test my understanding of ${focus}`
  if (mode === LEARNING_MODE.DEFEND) return `Help me defend the decision behind ${focus}`
  return `What might my lecturer ask about ${focus}?`
}

function ExplainToast({ notice, onDismiss }) {
  useEffect(() => {
    if (!notice) return undefined
    const timer = setTimeout(onDismiss, 4200)
    return () => clearTimeout(timer)
  }, [notice, onDismiss])
  if (!notice) return null
  return (
    <motion.div className={`sn-ex-toast sn-ex-toast--${notice.kind}`} initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} role="status">
      <span>{notice.message}</span>
      <button onClick={onDismiss} aria-label="Dismiss notice"><X size={14} /></button>
    </motion.div>
  )
}

function ExplainTaskSelector({ tasks, selectedId, onSelect, loading }) {
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const buttonRef = useRef(null)
  const listRef = useRef(null)
  const position = usePopoverPosition(open, buttonRef)
  const selected = tasks.find((t) => t.id === selectedId) || null
  const list = tasks
  useEffect(() => { if (open && listRef.current) listRef.current.focus() }, [open])
  useEffect(() => {
    if (!open || !listRef.current) return
    const el = listRef.current.children[activeIndex]
    if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest' })
  }, [activeIndex, open])

  if (loading && !selected) return <div className="sn-ex-task-select is-loading"><span className="sn-ex-skeleton-inline" /></div>
  if (!selected) return null

  const choose = (task) => {
    if (!task.eligible) return
    onSelect(task.id)
    setOpen(false)
    buttonRef.current?.focus()
  }

  const onKeyDown = (event) => {
    if (event.key === 'Escape') { setOpen(false); buttonRef.current?.focus(); return }
    if (!['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) return
    event.preventDefault()
    if (event.key === 'Enter' || event.key === ' ') {
      if (open) choose(list[activeIndex])
      else setOpen(true)
      return
    }
    if (!open) { setOpen(true); return }
    const dir = event.key === 'ArrowDown' ? 1 : -1
    setActiveIndex((i) => {
      let next = i
      for (let step = 0; step < list.length; step += 1) {
        next = (next + dir + list.length) % list.length
        if (list[next].eligible) return next
      }
      return i
    })
  }

  return (
    <div className="sn-ex-task-select">
      <button
        ref={buttonRef}
        className="sn-ex-task-select-trigger"
        onClick={() => setOpen((v) => !v)}
        onKeyDown={onKeyDown}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label="Select task for Explain & Defend"
      >
        <span className="sn-ex-task-select-label">
          <strong>{selected.title}</strong>
          <span>{deliveryLabel(selected)}</span>
        </span>
        <ChevronDown size={15} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            className="sn-ex-popover sn-ex-task-popover"
            style={position}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}
          >
            <div className="sn-ex-popover-head"><p className="student-overline">ELIGIBLE DELIVERIES</p></div>
            <ul ref={listRef} role="listbox" tabIndex={-1} aria-label="Eligible tasks" className="sn-ex-task-list">
              {list.map((task, index) => (
                <li key={task.id}>
                  <button
                    role="option"
                    aria-selected={task.id === selectedId}
                    aria-disabled={!task.eligible}
                    className={`sn-ex-task-option ${task.id === selectedId ? 'is-selected' : ''} ${task.eligible ? '' : 'is-disabled'}`}
                    onClick={() => choose(task)}
                    onMouseEnter={() => task.eligible && setActiveIndex(index)}
                  >
                    <span className="sn-ex-task-option-main">
                      <strong>{task.title}</strong>
                      <small>{[task.subject || task.domain, task.deliveredAt ? `Delivered ${formatDate(task.deliveredAt)}` : task.display?.label].filter(Boolean).join(' · ')}</small>
                      {!task.eligible && <em>{task.reason}</em>}
                    </span>
                    <span className={`sn-ex-task-option-state ${task.eligible ? 'is-on' : ''}`}>
                      {task.eligible ? 'Available' : task.availability === 'processing' ? 'Preparing' : 'Unavailable'}
                    </span>
                    {task.id === selectedId && <Check size={14} className="sn-ex-task-check" />}
                  </button>
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function LearningModeRail({ mode, onChange }) {
  const railRef = useRef(null)
  const buttonRefs = useRef({})
  useEffect(() => {
    const rail = railRef.current
    const button = buttonRefs.current[mode]
    if (!rail || !button) return
    const target = button.offsetLeft - 16
    if (button.offsetLeft < rail.scrollLeft || button.offsetLeft + button.offsetWidth > rail.scrollLeft + rail.clientWidth) {
      rail.scrollTo({ left: target, behavior: 'smooth' })
    }
  }, [mode])

  const onKeyDown = (event) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    const index = LEARNING_MODES.findIndex((m) => m.key === mode)
    let next = index
    if (event.key === 'ArrowRight') next = Math.min(LEARNING_MODES.length - 1, index + 1)
    if (event.key === 'ArrowLeft') next = Math.max(0, index - 1)
    if (event.key === 'Home') next = 0
    if (event.key === 'End') next = LEARNING_MODES.length - 1
    onChange(LEARNING_MODES[next].key)
    buttonRefs.current[LEARNING_MODES[next].key]?.focus()
  }

  return (
    <div className="sn-ex-mode-rail" role="tablist" aria-label="Learning modes" ref={railRef} onKeyDown={onKeyDown}>
      {LEARNING_MODES.map((item) => {
        const Icon = MODE_ICON[item.key]
        const active = item.key === mode
        return (
          <button
            key={item.key}
            ref={(el) => { buttonRefs.current[item.key] = el }}
            role="tab"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            className={`sn-ex-mode-tab ${active ? 'is-active' : ''}`}
            onClick={() => onChange(item.key)}
            title={item.purpose}
          >
            <Icon size={15} strokeWidth={1.8} />
            <span className="sn-ex-mode-tab-text">
              <span className="sn-ex-mode-tab-label">{item.label}</span>
              <span className="sn-ex-mode-tab-purpose">{item.purpose}</span>
            </span>
            <i aria-hidden="true" />
          </button>
        )
      })}
    </div>
  )
}

function MobileSourceStudioToggle({ pane, onChange }) {
  return (
    <div className="sn-ex-mobile-toggle" role="tablist" aria-label="Source or studio view">
      <button role="tab" aria-selected={pane === 'source'} className={pane === 'source' ? 'is-active' : ''} onClick={() => onChange('source')}>SOURCE</button>
      <button role="tab" aria-selected={pane === 'studio'} className={pane === 'studio' ? 'is-active' : ''} onClick={() => onChange('studio')}>STUDIO</button>
    </div>
  )
}

function ArtifactSelector({ artifacts, selectedId, onSelect, variant = 'popover' }) {
  const [open, setOpen] = useState(false)
  const buttonRef = useRef(null)
  const position = usePopoverPosition(open, buttonRef)
  if (!artifacts || artifacts.length <= 1) return null
  const selected = artifacts.find((a) => a.id === selectedId) || artifacts[0]

  const list = (
    <div className="sn-ex-artifact-options" role="listbox" aria-label="Delivery files">
      {artifacts.map((artifact) => (
        <button
          key={artifact.id}
          role="option"
          aria-selected={artifact.id === selectedId}
          className={`sn-ex-artifact-option ${artifact.id === selectedId ? 'is-selected' : ''}`}
          onClick={() => { onSelect(artifact.id); setOpen(false) }}
        >
          <ArtifactIcon kind={artifact.kind} />
          <span><strong>{artifact.name}</strong><small>{artifact.kindLabel} · {formatFileSize(artifact.size)}</small></span>
          {artifact.id === selectedId && <Check size={14} />}
        </button>
      ))}
    </div>
  )

  if (variant === 'sheet') {
    return (
      <AnimatePresence>
        {open && (
          <motion.div className="sn-ex-sheet-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)}>
            <motion.div className="sn-ex-sheet" initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ duration: 0.24 }} onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Switch delivery file">
              <div className="sn-ex-sheet-head">
                <p className="student-overline">DELIVERY FILES</p>
                <button className="sn-ex-icon-btn" onClick={() => setOpen(false)} aria-label="Close"><X size={16} /></button>
              </div>
              {list}
            </motion.div>
          </motion.div>
        )}
        <button ref={buttonRef} className="sn-ex-icon-btn" onClick={() => setOpen(true)} aria-label="Switch file" title={selected?.name}><ListChecks size={16} /></button>
      </AnimatePresence>
    )
  }

  return (
    <div className="sn-ex-artifact-select">
      <button ref={buttonRef} className="sn-ex-artifact-trigger" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-haspopup="listbox">
        <ArtifactIcon kind={selected?.kind} size={14} />
        <span>{selected?.kindLabel || 'File'}</span>
        <ChevronDown size={13} />
      </button>
      <ClickOutside onClick={() => setOpen(false)} enabled={open}>
        <AnimatePresence>
          {open && (
            <motion.div className="sn-ex-popover sn-ex-artifact-popover" style={position} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18 }}>
              <div className="sn-ex-popover-head"><p className="student-overline">DELIVERY FILES</p></div>
              {list}
            </motion.div>
          )}
        </AnimatePresence>
      </ClickOutside>
    </div>
  )
}

function SourceSkeleton() {
  return (
    <div className="sn-ex-source-skeleton" aria-hidden="true">
      <span className="sk sk-head" />
      <span className="sk" />
      <span className="sk" />
      <span className="sk sk-short" />
      <span className="sk" />
      <span className="sk sk-mid" />
      <span className="sk" />
      <span className="sk sk-short" />
    </div>
  )
}

function DocumentView({ content, viewer, zoom, activeAnchor, searchQuery }) {
  const pageRefs = useRef([])
  useEffect(() => {
    const root = viewer.scrollRef.current
    if (!root || !content.pages?.length) return undefined
    const onScroll = () => {
      const rootTop = root.getBoundingClientRect().top
      let current = content.pages[0].n
      pageRefs.current.forEach((el) => {
        if (el && el.getBoundingClientRect().top - rootTop <= 90) current = Number(el.getAttribute('data-page'))
      })
      if (current !== viewer.page) viewer.setPage(current)
    }
    root.addEventListener('scroll', onScroll, { passive: true })
    return () => root.removeEventListener('scroll', onScroll)
  }, [content, viewer])

  const matchIds = useMemo(() => new Set(viewer.matches.filter((m) => m.type === 'block').map((m) => m.id)), [viewer.matches])
  const query = searchQuery.trim().toLowerCase()

  return (
    <div className="sn-ex-doc" style={{ '--sn-ex-zoom': zoom }}>
      {content.pages.map((page, pageIndex) => (
        <section
          key={page.n}
          className="sn-ex-doc-page"
          data-page={page.n}
          ref={(el) => { pageRefs.current[pageIndex] = el }}
          aria-label={`Page ${page.n}`}
        >
          <span className="sn-ex-doc-page-tag">PAGE {page.n}</span>
          {page.blocks.map((block) => {
            const isActive = activeAnchor && (String(activeAnchor.ref) === String(block.id) || (activeAnchor.page && Number(activeAnchor.page) === Number(block.page) && activeAnchor.label && block.text.includes(String(activeAnchor.label).slice(0, 24))))
            const isMatch = matchIds.has(block.id)
            const Tag = block.type === 'heading' || block.type === 'title' || block.type === 'h1' || block.type === 'h2' ? 'h3' : 'p'
            const highlighted = query ? highlightText(block.text, query) : block.text
            return (
              <div key={block.id} className={`sn-ex-doc-block ${isActive ? 'is-active' : ''} ${isMatch ? 'is-match' : ''}`} data-block-id={block.id} data-page={block.page || page.n}>
                {isActive && activeAnchor?.uiId != null && <span className="sn-ex-anchor-marker">{anchorDisplayId({ uiId: activeAnchor.uiId })}</span>}
                <Tag>{highlighted}</Tag>
              </div>
            )
          })}
        </section>
      ))}
    </div>
  )
}

function highlightText(text, query) {
  const idx = text.toLowerCase().indexOf(query)
  if (idx === -1) return text
  return (
    <>
      {text.slice(0, idx)}
      <mark>{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  )
}

function CodeView({ content, viewer, zoom, activeAnchor }) {
  const files = content.files || []
  const activeFile = files.find((f) => f.path === viewer.activePath) || files[0]
  const query = viewer.query.trim().toLowerCase()
  const matchLines = useMemo(() => new Set(viewer.matches.filter((m) => m.type === 'line').map((m) => m.n)), [viewer.matches])
  const range = activeAnchor?.kind === 'code' || activeAnchor?.lines ? activeAnchor.lines : null
  return (
    <div className="sn-ex-code">
      {files.length > 1 && (
        <aside className="sn-ex-code-tree" aria-label="Project files">
          <p className="student-overline">FILES</p>
          {files.map((file) => (
            <button key={file.path} className={`sn-ex-code-file ${file.path === activeFile?.path ? 'is-active' : ''}`} onClick={() => viewer.setActivePath(file.path)}>
              <Code2 size={13} />
              <span>{file.path}</span>
            </button>
          ))}
        </aside>
      )}
      <div className="sn-ex-code-main">
        <div className="sn-ex-code-path">{activeFile?.path}</div>
        <div className="sn-ex-code-lines" style={{ '--sn-ex-zoom': zoom }}>
          {activeFile?.lines.map((line) => {
            const inRange = range && line.n >= range[0] && line.n <= range[1] && (!activeAnchor?.file || activeFile.path === activeAnchor.file)
            const isMatch = matchLines.has(line.n)
            const currentMatch = viewer.matches[viewer.matchIndex]
            const isCurrent = currentMatch?.type === 'line' && currentMatch.n === line.n
            return (
              <div key={line.n} data-line={line.n} className={`sn-ex-code-line ${inRange ? 'is-active' : ''} ${isMatch ? 'is-match' : ''} ${isCurrent ? 'is-current' : ''}`}>
                <span className="sn-ex-code-ln">{line.n}</span>
                <span className="sn-ex-code-lt">{query ? highlightText(line.text, query) : line.text || ' '}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function SlidesView({ content, viewer, zoom, activeAnchor }) {
  return (
    <div className="sn-ex-slides" style={{ '--sn-ex-zoom': zoom }}>
      {content.slides.map((slide) => {
        const isActive = activeAnchor && Number(activeAnchor.page || activeAnchor.ref) === Number(slide.n)
        return (
          <article key={slide.n} data-slide={slide.n} className={`sn-ex-slide ${isActive ? 'is-active' : ''}`}>
            <span className="sn-ex-slide-tag">SLIDE {slide.n}</span>
            <h3>{slide.title}</h3>
            {slide.bullets.length > 0 && (
              <ul>{slide.bullets.map((b, i) => <li key={i}>{b}</li>)}</ul>
            )}
          </article>
        )
      })}
    </div>
  )
}

function DatasetView({ content, viewer, zoom }) {
  const query = viewer.query.trim().toLowerCase()
  return (
    <div className="sn-ex-dataset" style={{ '--sn-ex-zoom': zoom }}>
      {content.truncated && <p className="sn-ex-dataset-note">Preview of {content.totalRows ?? content.rows.length} rows — showing the first {content.rows.length}.</p>}
      <div className="sn-ex-dataset-scroll">
        <table>
          <thead>
            <tr>{content.columns.map((c, i) => <th key={i}>{c}</th>)}</tr>
          </thead>
          <tbody>
            {content.rows.map((row, ri) => {
              const isMatch = query && row.some((cell) => String(cell).toLowerCase().includes(query))
              return (
                <tr key={ri} data-row={ri} className={isMatch ? 'is-match' : ''}>
                  {content.columns.length
                    ? content.columns.map((_, ci) => <td key={ci}>{row[ci] ?? ''}</td>)
                    : row.map((cell, ci) => <td key={ci}>{cell}</td>)}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function EmbeddedView({ viewer, artifact }) {
  if (!viewer.signedUrl) return null
  if (viewer.previewType === 'image') return <img className="sn-ex-embed sn-ex-embed-img" src={viewer.signedUrl} alt={artifact?.name || 'Delivery file'} />
  return <iframe className="sn-ex-embed" src={viewer.signedUrl} title={artifact?.name || 'Delivery file'} />
}

function SourceViewerBody({ viewer, artifact, searchQuery }) {
  if (viewer.status === 'loading') return <SourceSkeleton />
  if (viewer.status === 'error') {
    return (
      <div className="sn-ex-source-state">
        <TriangleAlert size={26} strokeWidth={1.5} />
        <p className="student-overline">SOURCE LOAD FAILURE</p>
        <h3>We couldn't open this source.</h3>
        <div className="sn-ex-state-actions">
          <button className="student-button" onClick={viewer.reload}>Retry <RefreshCw size={14} /></button>
          <button className="student-button student-button--secondary" onClick={() => viewer.download(artifact)}>Download <Download size={14} /></button>
        </div>
      </div>
    )
  }
  if (viewer.status === 'unsupported') {
    return (
      <div className="sn-ex-source-state">
        <FolderOpen size={26} strokeWidth={1.5} />
        <p className="student-overline">UNSUPPORTED FILE</p>
        <h3>This file can be downloaded, but it is not currently available for Explain & Defend.</h3>
        <div className="sn-ex-state-actions">
          <button className="student-button" onClick={() => viewer.download(artifact)}>Download <Download size={14} /></button>
          <button className="student-button student-button--secondary" onClick={viewer.reload}>Try again <RefreshCw size={14} /></button>
        </div>
      </div>
    )
  }
  if (viewer.status === 'ready' && viewer.mode === 'embedded') return <EmbeddedView viewer={viewer} artifact={artifact} />
  if (viewer.status === 'ready' && viewer.content) {
    const content = viewer.content
    if (content.kind === 'code') return <CodeView content={content} viewer={viewer} zoom={viewer.zoom} activeAnchor={viewer.activeAnchor} />
    if (content.kind === 'slides') return <SlidesView content={content} viewer={viewer} zoom={viewer.zoom} activeAnchor={viewer.activeAnchor} />
    if (content.kind === 'dataset') return <DatasetView content={content} viewer={viewer} zoom={viewer.zoom} />
    return <DocumentView content={content} viewer={viewer} zoom={viewer.zoom} activeAnchor={viewer.activeAnchor} searchQuery={searchQuery} />
  }
  return <SourceSkeleton />
}

function ExplainSourceViewer({ task, artifacts, artifactId, onSelectArtifact, viewer, isMobile, onDownload, loadingArtifacts, artifactError }) {
  const artifact = artifacts.find((a) => a.id === artifactId) || artifacts[0] || null
  const canPage = Boolean(viewer.content?.pages?.length)
  const canZoom = viewer.mode === 'parsed' && viewer.content?.kind !== 'dataset'

  return (
    <section className="sn-ex-source" aria-label="Delivered source">
      <header className="sn-ex-source-header">
        <div className="sn-ex-source-identity">
          {artifact ? (
            <>
              <p className="sn-ex-source-name" title={artifact.name}>
                <strong>{artifact.name}</strong>
                <span className="sn-ex-source-meta">Delivery V{artifact.version ?? '—'} • Current</span>
              </p>
              <p className="sn-ex-source-type">{ARTIFACT_KIND_LABELS[artifact.kind] || artifact.ext?.toUpperCase() || 'FILE'}{artifact.size ? ` · ${formatFileSize(artifact.size)}` : ''}</p>
            </>
          ) : (
            <p className="sn-ex-source-name"><strong>{task?.title || 'Delivery'}</strong></p>
          )}
        </div>
        <div className="sn-ex-source-actions">
          <ArtifactSelector artifacts={artifacts} selectedId={artifactId} onSelect={onSelectArtifact} variant={isMobile ? 'sheet' : 'popover'} />
          <button className="sn-ex-icon-btn" onClick={() => go(buildDossierRoute({ taskId: task?.id, section: 'delivery' }))} title="Open in Files & Deliveries" aria-label="Open in Files & Deliveries"><ExternalLink size={15} /></button>
          {artifact && <button className="sn-ex-icon-btn" onClick={() => onDownload(artifact)} title="Download" aria-label="Download file"><Download size={15} /></button>}
        </div>
      </header>

      {artifacts.length > 1 && !isMobile && (
        <div className="sn-ex-file-rail" role="tablist" aria-label="Delivery files">
          {artifacts.map((item) => (
            <button key={item.id} role="tab" aria-selected={item.id === artifactId} className={`sn-ex-file-chip ${item.id === artifactId ? 'is-active' : ''}`} onClick={() => onSelectArtifact(item.id)}>
              <ArtifactIcon kind={item.kind} size={13} />
              <span>{item.kindLabel}</span>
            </button>
          ))}
        </div>
      )}

      <div className="sn-ex-source-toolbar">
        <div className="sn-ex-source-search">
          <Search size={14} />
          <input type="search" value={viewer.query} onChange={(e) => viewer.setQuery(e.target.value)} placeholder="Search in source…" aria-label="Search in source" disabled={viewer.mode !== 'parsed'} />
          {viewer.query && viewer.matches.length > 0 && (
            <span className="sn-ex-search-count">{viewer.matchIndex + 1}/{viewer.matches.length}</span>
          )}
          {viewer.query && viewer.matches.length > 1 && (
            <>
              <button onClick={viewer.prevMatch} aria-label="Previous match"><ChevronLeft size={13} /></button>
              <button onClick={viewer.nextMatch} aria-label="Next match"><ChevronRight size={13} /></button>
            </>
          )}
          {viewer.query && <button onClick={() => viewer.setQuery('')} aria-label="Clear search"><X size={13} /></button>}
        </div>
        <div className="sn-ex-source-viewer-tools">
          {canPage && (
            <span className="sn-ex-page-indicator">
              <button onClick={() => viewer.setPage(Math.max(1, viewer.page - 1))} disabled={viewer.page <= 1} aria-label="Previous page"><ChevronLeft size={13} /></button>
              {viewer.page}{viewer.pageCount ? ` / ${viewer.pageCount}` : ''}
              <button onClick={() => viewer.setPage(Math.min(viewer.pageCount || viewer.page + 1, viewer.page + 1))} disabled={viewer.pageCount > 0 && viewer.page >= viewer.pageCount} aria-label="Next page"><ChevronRight size={13} /></button>
            </span>
          )}
          {canZoom && (
            <span className="sn-ex-zoom-tools">
              <button onClick={viewer.zoomOut} aria-label="Zoom out"><ZoomOut size={14} /></button>
              <button onClick={viewer.zoomIn} aria-label="Zoom in"><ZoomIn size={14} /></button>
            </span>
          )}
          <button className="sn-ex-icon-btn" onClick={viewer.reload} aria-label="Reload source" title="Reload"><RefreshCw size={14} /></button>
        </div>
      </div>

      {viewer.activeAnchor && (
        <div className="sn-ex-source-anchorbar">
          <span className="sn-ex-anchor-id">{anchorDisplayId(viewer.activeAnchor) || 'SOURCE'}</span>
          <span className="sn-ex-anchor-label">{viewer.activeAnchor.label}</span>
          <button onClick={() => viewer.focusAnchor(viewer.activeAnchor)}>Show in source <ArrowRight size={12} /></button>
        </div>
      )}

      <div className="sn-ex-source-scroll" ref={viewer.scrollRef}>
        {loadingArtifacts && !artifact ? <SourceSkeleton />
          : artifactError && !artifact ? (
            <div className="sn-ex-source-state">
              <TriangleAlert size={26} strokeWidth={1.5} />
              <p className="student-overline">SOURCE UNAVAILABLE</p>
              <h3>We couldn't list the delivery files for this task.</h3>
              <button className="student-button" onClick={() => go('/student/files')}>Open Files & Deliveries <ArrowRight size={14} /></button>
            </div>
          ) : !artifact && artifacts.length === 0 && !loadingArtifacts ? (
            <div className="sn-ex-source-state">
              <FolderOpen size={26} strokeWidth={1.5} />
              <p className="student-overline">NO DELIVERY FILES</p>
              <h3>This delivery has no files available to explain yet.</h3>
              <button className="student-button student-button--secondary" onClick={() => go('/student/files')}>Open Files & Deliveries <ArrowRight size={14} /></button>
            </div>
          ) : (
            <SourceViewerBody viewer={viewer} artifact={artifact} searchQuery={viewer.query} />
          )}
      </div>
    </section>
  )
}

function SourceSelectionBar({ selection, isMobile, onAction, onDismiss }) {
  const barRef = useRef(null)
  const [style, setStyle] = useState(null)
  useEffect(() => {
    if (!selection || isMobile) { setStyle(null); return undefined }
    const compute = () => {
      const rect = selection.rect
      if (!rect) return
      const estWidth = 320
      const estHeight = 44
      let top = rect.bottom + 10
      if (top + estHeight > window.innerHeight - 12) top = Math.max(12, rect.top - estHeight - 10)
      let left = rect.left + rect.width / 2 - estWidth / 2
      left = Math.max(12, Math.min(left, window.innerWidth - estWidth - 12))
      setStyle({ top, left })
    }
    compute()
    window.addEventListener('resize', compute)
    window.addEventListener('scroll', compute, true)
    return () => { window.removeEventListener('resize', compute); window.removeEventListener('scroll', compute, true) }
  }, [selection, isMobile])

  if (!selection) return null
  const actions = [
    { mode: LEARNING_MODE.EXPLAIN, label: 'Explain' },
    { mode: LEARNING_MODE.WHY, label: 'Why?' },
    { mode: LEARNING_MODE.QUIZ, label: 'Quiz me' },
    { mode: LEARNING_MODE.DEFEND, label: 'Defend This' },
  ]

  if (isMobile) {
    return (
      <motion.div className="sn-ex-selbar sn-ex-selbar--sheet" initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }} role="toolbar" aria-label="Selection actions">
        <p className="sn-ex-selbar-text">“{excerpt(selection.text, 60)}”</p>
        <div className="sn-ex-selbar-actions">
          {actions.map((a) => <button key={a.mode} onClick={() => onAction(a.mode, selection.text)}>{a.label}</button>)}
          <button className="is-ghost" onClick={onDismiss} aria-label="Dismiss selection"><X size={15} /></button>
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div ref={barRef} className="sn-ex-selbar" style={style} initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.16 }} role="toolbar" aria-label="Selection actions">
      {actions.map((a) => <button key={a.mode} onClick={() => onAction(a.mode, selection.text)}>{a.label}</button>)}
      <button className="is-ghost" onClick={onDismiss} aria-label="Dismiss selection"><X size={14} /></button>
    </motion.div>
  )
}

function SourceStreamingIndicator({ canStop, onStop }) {
  return (
    <div className="sn-ex-streaming" role="status">
      <div className="sn-ex-streaming-head">
        <p className="student-overline">SOLVY IS WORKING THROUGH THIS SECTION…</p>
        {canStop && <button className="sn-ex-stop-btn" onClick={onStop}><Square size={11} /> Stop</button>}
      </div>
      <span className="sn-ex-line" />
      <span className="sn-ex-line sn-ex-line--mid" />
      <span className="sn-ex-line sn-ex-line--short" />
    </div>
  )
}

function IntegrityNotice({ integrity, onAction }) {
  const actions = [
    { label: 'Explain the concept', mode: LEARNING_MODE.EXPLAIN, question: 'Explain the key concept behind this part of the delivery so I understand it.' },
    { label: 'Quiz me', mode: LEARNING_MODE.QUIZ, scope: 'quick' },
    { label: 'Help me practise', mode: LEARNING_MODE.LECTURER },
  ]
  return (
    <div className="sn-ex-integrity" role="note">
      <div className="sn-ex-integrity-head">
        <ShieldCheck size={18} />
        <p className="student-overline">LET'S KEEP THIS IN LEARNING MODE</p>
      </div>
      <p>{integrity?.message || "I can help you understand, practise or review this work, but I can't assist with that request in its current form."}</p>
      <div className="sn-ex-integrity-actions">
        {actions.map((a) => (
          <button key={a.label} className="student-button student-button--secondary" onClick={() => onAction(a)}>{a.label}</button>
        ))}
      </div>
    </div>
  )
}

function ExplainFailure({ onRetry, message }) {
  return (
    <div className="sn-ex-failure" role="alert">
      <TriangleAlert size={20} strokeWidth={1.6} />
      <div>
        <p className="student-overline">REQUEST NOT COMPLETED</p>
        <h3>{message || "We couldn't complete this explanation."}</h3>
      </div>
      <button className="student-button" onClick={onRetry}>Retry <ArrowRight size={14} /></button>
    </div>
  )
}

function GroundingLine({ data }) {
  if (!data) return null
  const parts = []
  if (data.groundingLabel) parts.push(data.groundingLabel)
  const anchorFile = data.anchor?.file
  if (anchorFile || data.anchor?.label) parts.push([anchorFile, data.anchor?.page ? `Page ${data.anchor.page}` : data.anchor?.label].filter(Boolean).join(' • '))
  if (!parts.length && data.source) parts.push(String(data.source))
  if (!parts.length) return null
  return <p className="sn-ex-grounding-line">SOURCE — {parts.join(' · ')}</p>
}

function SourceSection({ data, anchor, onShowSource }) {
  const displayId = anchorDisplayId(anchor)
  const showJump = Boolean(anchor && onShowSource)
  const grounded = Boolean(anchor || data.source)
  if (!grounded && !data.groundingLabel) return null
  return (
    <section className="sn-ex-res-section">
      <p className="student-overline">SOURCE</p>
      <div className="sn-ex-source-ref">
        <span className="sn-ex-source-ref-id">{displayId || (data.groundingLabel ? data.groundingLabel : 'SOURCE')}</span>
        <span className="sn-ex-source-ref-label">{anchor?.label || data.source || 'Task & delivery context'}</span>
        {showJump && <button className="sn-ex-inline-link" onClick={onShowSource}>Show in Document <ArrowRight size={12} /></button>}
      </div>
      {!anchor && (
        <p className="sn-ex-source-context">SOURCE CONTEXT — This explanation is based on the task/delivery context rather than a single identifiable passage.</p>
      )}
      {data.uncertainty && <p className="sn-ex-source-context">{data.uncertainty}</p>}
    </section>
  )
}

function ExplainResponse({ data, anchor, onShowSource, onPractice, onRetry }) {
  if (!data) return null
  return (
    <motion.div className="sn-ex-response" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.24 }}>
      <GroundingLine data={data} />
      {data.plain && (
        <section className="sn-ex-res-section">
          <p className="student-overline">PLAIN EXPLANATION</p>
          {data.plain.paragraphs.map((p, i) => <p key={i} className="sn-ex-res-p">{p}</p>)}
          {data.plain.bullets.length > 0 && <ul className="sn-ex-res-list">{data.plain.bullets.map((b, i) => <li key={i}>{b}</li>)}</ul>}
          {data.plain.formula && <pre className="sn-ex-res-code">{data.plain.formula}</pre>}
          {data.plain.example && <p className="sn-ex-res-example"><span>Example</span>{data.plain.example}</p>}
        </section>
      )}
      {data.whyItMatters && (
        <section className="sn-ex-res-section">
          <p className="student-overline">WHY IT MATTERS</p>
          {data.whyItMatters.paragraphs.map((p, i) => <p key={i} className="sn-ex-res-p">{p}</p>)}
          {data.whyItMatters.bullets.length > 0 && <ul className="sn-ex-res-list">{data.whyItMatters.bullets.map((b, i) => <li key={i}>{b}</li>)}</ul>}
        </section>
      )}
      <SourceSection data={data} anchor={anchor} onShowSource={onShowSource} />
      {data.trySayingIt && (
        <section className="sn-ex-res-section sn-ex-res-practice">
          <p className="student-overline">TRY SAYING IT YOURSELF</p>
          <p className="sn-ex-res-p">{data.trySayingIt}</p>
          {onPractice && <button className="sn-ex-inline-link" onClick={onPractice}>Practise this out loud <ArrowRight size={12} /></button>}
        </section>
      )}
      {!data.plain && !data.whyItMatters && !data.source && !data.trySayingIt && (
        <ExplainFailure onRetry={onRetry || (() => {})} message="We received an empty explanation. Try again." />
      )}
    </motion.div>
  )
}

function WhyResponse({ data, anchor, onShowSource, onRetry }) {
  if (!data) return null
  const section = (label, value) => value && (
    <section className="sn-ex-res-section">
      <p className="student-overline">{label}</p>
      {value.paragraphs.map((p, i) => <p key={i} className="sn-ex-res-p">{p}</p>)}
      {value.bullets.length > 0 && <ul className="sn-ex-res-list">{value.bullets.map((b, i) => <li key={i}>{b}</li>)}</ul>}
    </section>
  )
  return (
    <motion.div className="sn-ex-response" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.24 }}>
      <GroundingLine data={data} />
      {data.decision && (
        <section className="sn-ex-res-section sn-ex-res-decision">
          <p className="student-overline">DECISION</p>
          <p className="sn-ex-res-decision-text">{data.decision}</p>
        </section>
      )}
      {section('REASON', data.reason)}
      {section('ALTERNATIVE', data.alternative)}
      {section('TRADE-OFF', data.tradeOff)}
      <SourceSection data={data} anchor={anchor} onShowSource={onShowSource} />
      {!data.decision && !data.reason && !data.alternative && !data.tradeOff && (
        <ExplainFailure onRetry={onRetry || (() => {})} message="We received an empty response. Try again." />
      )}
    </motion.div>
  )
}

function QuizWorkspace({ data, stream, view, setView, scope, setScope, anchor, onShowSource, onAsk, hasAsked, draft, setDraft, onSwitchMode }) {
  const submit = () => {
    if (!draft.trim()) return
    onAsk({ question: draft.trim(), prompt: data?.question?.prompt || null, scope })
    setDraft('')
  }

  if (view === 'complete' && data?.completion) {
    const completion = data.completion
    return (
      <motion.div className="sn-ex-response sn-ex-quiz" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <p className="student-overline">REVIEW COMPLETE</p>
        {completion.strongAreas.length > 0 && (
          <section className="sn-ex-res-section">
            <p className="student-overline">STRONG AREAS</p>
            <ul className="sn-ex-res-list">{completion.strongAreas.map((s, i) => <li key={i}>{s}</li>)}</ul>
          </section>
        )}
        {completion.reviewAgain.length > 0 && (
          <section className="sn-ex-res-section">
            <p className="student-overline">REVIEW AGAIN</p>
            <ul className="sn-ex-res-list">{completion.reviewAgain.map((s, i) => <li key={i}>{s}</li>)}</ul>
          </section>
        )}
        {completion.nextMode && (
          <section className="sn-ex-res-section">
            <p className="student-overline">SUGGESTED NEXT MODE</p>
            <button className="student-button" onClick={() => onSwitchMode(completion.nextMode.mode || LEARNING_MODE.LECTURER)}>
              {completion.nextMode.label} <ArrowRight size={14} />
            </button>
          </section>
        )}
      </motion.div>
    )
  }

  if (view === 'reveal' && data?.reveal) {
    const reveal = data.reveal
    return (
      <motion.div className="sn-ex-response sn-ex-quiz" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <GroundingLine data={data} />
        {reveal.yourAnswer && (
          <section className="sn-ex-res-section">
            <p className="student-overline">YOUR ANSWER</p>
            <p className="sn-ex-res-p sn-ex-your-answer">{reveal.yourAnswer}</p>
          </section>
        )}
        {reveal.strong.length > 0 && (
          <section className="sn-ex-res-section">
            <p className="student-overline">WHAT WAS STRONG</p>
            <ul className="sn-ex-res-list sn-ex-res-list--good">{reveal.strong.map((s, i) => <li key={i}>{s}</li>)}</ul>
          </section>
        )}
        {reveal.improve.length > 0 && (
          <section className="sn-ex-res-section">
            <p className="student-overline">WHAT TO IMPROVE</p>
            <ul className="sn-ex-res-list">{reveal.improve.map((s, i) => <li key={i}>{s}</li>)}</ul>
          </section>
        )}
        {reveal.model && (
          <section className="sn-ex-res-section">
            <p className="student-overline">MODEL EXPLANATION</p>
            <p className="sn-ex-res-p">{reveal.model}</p>
          </section>
        )}
        <SourceSection data={{ ...data, source: reveal.source || data.source }} anchor={anchor} onShowSource={onShowSource} />
        {reveal.scoreLabel && <p className="sn-ex-score-label">{reveal.scoreLabel}</p>}
        <div className="sn-ex-action-row">
          <button className="student-button student-button--secondary" onClick={() => setView('question')}>Try Again</button>
          <button className="student-button student-button--secondary" onClick={() => onSwitchMode(LEARNING_MODE.EXPLAIN, { question: `Explain this so I understand it: ${data?.question?.prompt || ''}` })}>Explain This</button>
          <button className="student-button" onClick={() => onAsk({ scope, prompt: data?.question?.prompt || null })}>Next Question <ArrowRight size={14} /></button>
        </div>
      </motion.div>
    )
  }

  if (view === 'question' && data?.question) {
    const question = data.question
    return (
      <motion.div className="sn-ex-response sn-ex-quiz" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <div className="sn-ex-q-head">
          <span className="sn-ex-q-count">{question.total ? `QUESTION ${question.index} OF ${question.total}` : question.index ? `QUESTION ${question.index}` : 'QUESTION'}</span>
          {question.sourceTag && <span className="sn-ex-q-tag">{question.sourceTag}</span>}
        </div>
        <h3 className="sn-ex-q-prompt">{question.prompt}</h3>
        {question.context && <p className="sn-ex-q-context">{question.context}</p>}
        {question.choices.length > 0 ? (
          <div className="sn-ex-q-choices">
            {question.choices.map((choice, i) => (
              <button
                key={choice.id}
                className={`sn-ex-q-choice ${draft === choice.label ? 'is-selected' : ''}`}
                onClick={() => setDraft(choice.label)}
              >
                <span>{String.fromCharCode(65 + i)}</span>{choice.label}
              </button>
            ))}
          </div>
        ) : (
          <textarea className="sn-ex-q-input" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Write your answer in your own words…" rows={4} />
        )}
        <div className="sn-ex-action-row">
          <button className="student-button" onClick={submit} disabled={!draft.trim() || stream.canStop}>Submit Answer <Send size={14} /></button>
          {stream.canStop && <button className="student-button student-button--secondary" onClick={stream.stop}><Square size={12} /> Stop</button>}
        </div>
      </motion.div>
    )
  }

  if (!hasAsked || view === 'setup') {
    return (
      <div className="sn-ex-quiz-setup">
        <ModeIntro
          mode={LEARNING_MODE.QUIZ}
          onPrimary={() => onAsk({ scope })}
          compact
        />
        <p className="student-overline">CHOOSE YOUR SCOPE</p>
        <div className="sn-ex-scope-row">
          {QUIZ_SCOPES.map((item) => (
            <button
              key={item.key}
              className={`sn-ex-scope-chip ${scope === item.key ? 'is-active' : ''} ${item.key === 'section' && !anchor ? 'is-disabled' : ''}`}
              disabled={item.key === 'section' && !anchor}
              onClick={() => setScope(item.key)}
            >{item.label}</button>
          ))}
        </div>
        <button className="student-button sn-ex-start-btn" onClick={() => onAsk({ scope })}>Start Quiz <ArrowRight size={14} /></button>
        <p className="sn-ex-setup-note">Questions are generated from this delivery, its requirements and rubric where available.</p>
      </div>
    )
  }
  return null
}

function LecturerQuestionsWorkspace({ data, stream, view, setView, anchor, onShowSource, onAsk, draft, setDraft, onSwitchMode }) {
  const submit = (prompt) => {
    if (!draft.trim()) return
    onAsk({ question: draft.trim(), prompt: prompt || null })
    setDraft('')
  }

  if (view === 'coaching' && data?.coaching) {
    const coaching = data.coaching
    const followUp = data.followUp
    return (
      <motion.div className="sn-ex-response" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <GroundingLine data={data} />
        {coaching.covered.length > 0 && (
          <section className="sn-ex-res-section">
            <p className="student-overline">WHAT YOU COVERED</p>
            <ul className="sn-ex-res-list sn-ex-res-list--good">{coaching.covered.map((s, i) => <li key={i}>{s}</li>)}</ul>
          </section>
        )}
        {coaching.missing.length > 0 && (
          <section className="sn-ex-res-section">
            <p className="student-overline">WHAT IS MISSING</p>
            <ul className="sn-ex-res-list">{coaching.missing.map((s, i) => <li key={i}>{s}</li>)}</ul>
          </section>
        )}
        {coaching.stronger && (
          <section className="sn-ex-res-section">
            <p className="student-overline">STRONGER WAY TO EXPLAIN IT</p>
            <p className="sn-ex-res-p">{coaching.stronger}</p>
          </section>
        )}
        <SourceSection data={{ ...data, source: coaching.source || data.source }} anchor={anchor} onShowSource={onShowSource} />
        {followUp ? (
          <section className="sn-ex-res-section sn-ex-followup">
            <p className="student-overline">FOLLOW-UP</p>
            <h3 className="sn-ex-q-prompt">{followUp.prompt}</h3>
            <textarea className="sn-ex-q-input" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Answer the follow-up…" rows={3} />
            <div className="sn-ex-action-row">
              <button className="student-button" onClick={() => submit(followUp.prompt)} disabled={!draft.trim()}>Submit Answer <Send size={14} /></button>
            </div>
          </section>
        ) : (
          <div className="sn-ex-action-row">
            <button className="student-button student-button--secondary" onClick={() => onAsk({})}>Another Question <ArrowRight size={14} /></button>
            <button className="student-button student-button--secondary" onClick={() => onSwitchMode(LEARNING_MODE.DEFEND)}>Practise Defending <ArrowRight size={14} /></button>
          </div>
        )}
        {data.complete && !followUp && <p className="sn-ex-complete-note">Practice round complete.</p>}
      </motion.div>
    )
  }

  if (view === 'question' && data?.question) {
    const question = data.question
    return (
      <motion.div className="sn-ex-response" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <div className="sn-ex-q-head">
          <span className="sn-ex-q-count">{question.total ? `QUESTION ${question.index} OF ${question.total}` : 'LECTURER QUESTION'}</span>
          {question.sourceTag && <span className="sn-ex-q-tag">{question.sourceTag}</span>}
        </div>
        <h3 className="sn-ex-q-prompt">{question.prompt}</h3>
        <textarea className="sn-ex-q-input" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Answer as you would in a viva…" rows={4} />
        <div className="sn-ex-action-row">
          <button className="student-button" onClick={() => submit()} disabled={!draft.trim() || stream.canStop}>Submit Answer <Send size={14} /></button>
          {stream.canStop && <button className="student-button student-button--secondary" onClick={stream.stop}><Square size={12} /> Stop</button>}
        </div>
      </motion.div>
    )
  }

  if (!data) {
    return (
      <div className="sn-ex-quiz-setup">
        <ModeIntro mode={LEARNING_MODE.LECTURER} onPrimary={() => onAsk({})} compact />
        <button className="student-button sn-ex-start-btn" onClick={() => onAsk({})}>Start Practising <ArrowRight size={14} /></button>
        <p className="sn-ex-setup-note">Questions are drawn from your delivery, requirements and rubric where the backend supports them. Answer in your own words — you are practising, not being graded.</p>
      </div>
    )
  }
  return null
}

function DefendWorkspace({ data, stream, view, setView, anchor, onShowSource, onAsk, draft, setDraft }) {
  const submit = () => {
    if (!draft.trim()) return
    onAsk({ question: draft.trim(), prompt: data?.question?.prompt || null })
    setDraft('')
  }

  if (view === 'feedback' && data?.feedback) {
    const feedback = data.feedback
    const rows = [
      { label: 'CLEAR', items: feedback.clearAll?.length ? feedback.clearAll : feedback.clear ? [feedback.clear] : [], tone: 'good' },
      { label: 'MISSING', items: feedback.missing, tone: 'warn' },
      { label: 'STRENGTHEN', items: feedback.strengthen, tone: 'tip' },
    ].filter((r) => r.items.length > 0)
    return (
      <motion.div className="sn-ex-response sn-ex-defend" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.26 }}>
        <GroundingLine data={data} />
        {rows.map((row) => (
          <section className="sn-ex-res-section" key={row.label}>
            <p className={`student-overline sn-ex-fb-${row.tone}`}>{row.label}</p>
            <ul className={`sn-ex-res-list ${row.tone === 'good' ? 'sn-ex-res-list--good' : ''}`}>{row.items.map((item, i) => <li key={i}>{item}</li>)}</ul>
          </section>
        ))}
        <SourceSection data={{ ...data, source: feedback.source || data.source }} anchor={anchor} onShowSource={onShowSource} />
        <div className="sn-ex-action-row">
          {data.complete ? (
            <>
              <p className="sn-ex-complete-note">Defence practice complete for this decision.</p>
              <button className="student-button student-button--secondary" onClick={() => setView('question')}>Practise Again</button>
            </>
          ) : (
            <button className="student-button" onClick={() => onAsk({})}>Next Defence Question <ArrowRight size={14} /></button>
          )}
        </div>
      </motion.div>
    )
  }

  if (view === 'question' && data?.question) {
    const question = data.question
    return (
      <motion.div className="sn-ex-response sn-ex-defend" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        {data.decision && (
          <div className="sn-ex-decision-panel">
            <p className="student-overline">DECISION UNDER REVIEW</p>
            <p className="sn-ex-decision-title">{data.decision}</p>
          </div>
        )}
        <div className="sn-ex-q-head">
          <span className="sn-ex-q-count">{question.total ? `QUESTION ${question.index} OF ${question.total}` : 'DEFENCE QUESTION'}</span>
          {question.sourceTag && <span className="sn-ex-q-tag">{question.sourceTag}</span>}
        </div>
        <h3 className="sn-ex-q-prompt">{question.prompt}</h3>
        <textarea className="sn-ex-q-input" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Explain and justify your decision…" rows={4} />
        <div className="sn-ex-action-row">
          <button className="student-button" onClick={submit} disabled={!draft.trim() || stream.canStop}>Submit Answer <Send size={14} /></button>
          {stream.canStop && <button className="student-button student-button--secondary" onClick={stream.stop}><Square size={12} /> Stop</button>}
        </div>
      </motion.div>
    )
  }

  return (
    <div className="sn-ex-defend-brief">
      <ModeIntro mode={LEARNING_MODE.DEFEND} onPrimary={() => onAsk({})} compact />
      <div className="sn-ex-decision-panel">
        <p className="student-overline">DEFENCE PANEL</p>
        <ul className="sn-ex-defend-outline">
          <li>DECISION UNDER REVIEW</li>
          <li>WHY THIS DECISION?</li>
          <li>WHAT TRADE-OFF DID IT CREATE?</li>
          <li>WHAT WOULD YOU CHANGE?</li>
          <li>WHAT EVIDENCE SUPPORTS IT?</li>
        </ul>
        <p className="sn-ex-setup-note">Targets come from your real delivery: methods, architecture, analysis and design choices. Feedback guides your explanation — it does not grade it.</p>
      </div>
      <button className="student-button sn-ex-start-btn" onClick={() => onAsk({})}>Start Defence <ArrowRight size={14} /></button>
    </div>
  )
}

function Composer({ mode, value, onChange, onSubmit, busy, onStop, canStop }) {
  const textareaRef = useRef(null)
  const meta = modeMeta(mode)
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 132)}px`
  }, [value])
  return (
    <form className="sn-ex-composer" onSubmit={(e) => { e.preventDefault(); onSubmit() }}>
      <label className="sn-visually-hidden" htmlFor="sn-ex-composer-input">Ask about this delivery</label>
      <div className="sn-ex-composer-row">
        <textarea
          id="sn-ex-composer-input"
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={meta.placeholder}
          rows={1}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSubmit() } }}
        />
        {canStop ? (
          <button type="button" className="sn-ex-composer-send is-stop" onClick={onStop}><Square size={13} /> Stop</button>
        ) : (
          <button type="submit" className="sn-ex-composer-send" disabled={!value.trim() || busy}>Ask Solvy <Send size={14} /></button>
        )}
      </div>
    </form>
  )
}

function OrientationPanel({ task, artifacts, mode, onPick, onSwitchMode }) {
  const meta = modeMeta(mode)
  const steps = [
    {
      n: '01',
      title: 'Read your delivery',
      body: 'The left pane is the real work you submitted — report, code, slides, or data. Select any passage to focus on it.',
      side: 'source',
    },
    {
      n: '02',
      title: 'Choose how to learn',
      body: 'Pick a mode above. Each one is a different way to engage: understand, reason, check, practise, or defend.',
      side: 'mode',
    },
    {
      n: '03',
      title: 'Practise out loud',
      body: 'Ask questions, answer prompts, and build a learning trail — grounded only in this delivery and its rubric.',
      side: 'studio',
    },
  ]

  const modeCards = LEARNING_MODES.map((item) => ({
    ...item,
    Icon: MODE_ICON[item.key],
    active: item.key === mode,
  }))

  return (
    <div className="sn-ex-orient">
      <p className="student-overline">HOW THIS WORKSPACE WORKS</p>
      <h3>Own the work you submitted — before anyone asks you about it.</h3>
      <p className="sn-ex-orient-lead">
        Explain &amp; Defend is a practice studio for delivered tasks. You do not rewrite the work here.
        You learn it well enough to explain it, justify it, and answer questions about it.
      </p>

      <ol className="sn-ex-orient-steps">
        {steps.map((step) => (
          <li key={step.n}>
            <span className="sn-ex-orient-n">{step.n}</span>
            <div>
              <strong>{step.title}</strong>
              <p>{step.body}</p>
            </div>
          </li>
        ))}
      </ol>

      <div className="sn-ex-orient-modes">
        <p className="student-overline">FIVE WAYS TO ENGAGE</p>
        <div className="sn-ex-orient-mode-grid">
          {modeCards.map(({ key, Icon, label, purpose, step, active }) => (
            <button
              key={key}
              type="button"
              className={`sn-ex-orient-mode ${active ? 'is-active' : ''}`}
              onClick={() => onSwitchMode(key)}
            >
              <span className="sn-ex-orient-mode-top">
                <Icon size={16} strokeWidth={1.7} />
                <em>{step}</em>
              </span>
              <strong>{label}</strong>
              <span>{purpose}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="sn-ex-orient-start">
        <p className="student-overline">START HERE — {meta.header}</p>
        <div className="sn-ex-prompt-rows">
          {(function buildPrompts() {
            const artifactName = artifacts[0]?.name || null
            const prompts = []
            prompts.push({ mode: LEARNING_MODE.EXPLAIN, label: 'Explain the methodology in plain language' })
            if (artifactName) prompts.push({ mode: LEARNING_MODE.WHY, label: `Why was this structure used in ${excerpt(artifactName, 36)}?` })
            prompts.push({ mode: LEARNING_MODE.QUIZ, label: 'Quiz me on the main findings' })
            prompts.push({ mode: LEARNING_MODE.LECTURER, label: 'What might my lecturer ask about this?' })
            prompts.push({ mode: LEARNING_MODE.DEFEND, label: task ? `Help me defend the key decisions in ${excerpt(task.title, 36)}` : 'Help me defend my key decisions' })
            return prompts
          })().map((prompt) => (
            <button key={prompt.label} className="sn-ex-prompt-row" onClick={() => onPick(prompt)}>
              <span className="sn-ex-prompt-mode">{modeMeta(prompt.mode).label}</span>
              <span className="sn-ex-prompt-label">{prompt.label}</span>
              <ArrowRight size={14} />
            </button>
          ))}
        </div>
        {task && (
          <p className="sn-ex-default-meta">
            Grounded in {task.title}{task.subject ? ` · ${task.subject}` : ''}{task.reference ? ` · ${task.reference}` : ''}.
            Answers only use this delivery, its requirements, and rubric where available.
          </p>
        )}
      </div>
    </div>
  )
}

function ModeIntro({ mode, anchor, onPrimary, compact = false }) {
  const meta = modeMeta(mode)
  const Icon = MODE_ICON[mode]
  const primary = {
    explain: { label: 'Explain the methodology', question: 'Explain the methodology in plain language' },
    why: { label: 'Show a key design choice', question: 'Why was the main approach chosen?' },
    quiz: { label: 'Start a quick quiz', ask: true },
    lecturer: { label: 'Practise viva questions', ask: true },
    defend: { label: 'Start defence practice', ask: true },
  }[mode]
  const body = {
    explain: 'Get a clear, repeatable explanation of any part of this delivery — grounded in the actual document or code on the left.',
    why: 'Understand the reasoning: what decision was made, why, what alternatives existed, and what trade-off was accepted.',
    quiz: 'Test yourself with short questions drawn from this delivery. Reveal answers only when you are ready.',
    lecturer: 'Rehearse the questions a lecturer or panel might ask — then get coaching on how strong your answer was.',
    defend: 'Practise justifying your decisions out loud. Feedback highlights what was clear, what was missing, and how to strengthen it.',
  }[mode]

  return (
    <div className={`sn-ex-mode-intro ${compact ? 'is-compact' : ''}`}>
      <div className="sn-ex-mode-intro-icon"><Icon size={compact ? 18 : 22} strokeWidth={1.6} /></div>
      <div className="sn-ex-mode-intro-copy">
        <p className="student-overline">{meta.header}</p>
        <h3>{meta.tagline}</h3>
        <p className="sn-ex-mode-intro-body">{body}</p>
        {anchor && (
          <p className="sn-ex-mode-intro-anchor">
            Currently focused on <strong>{anchor.label}</strong>
          </p>
        )}
        {!compact && (
          <div className="sn-ex-action-row">
            <button className="student-button" onClick={onPrimary}>
              {primary?.label || 'Get started'} <ArrowRight size={14} />
            </button>
            <span className="sn-ex-mode-intro-hint">Or pick a suggestion below · or select text in the source</span>
          </div>
        )}
      </div>
    </div>
  )
}

function DefaultPrompts({ task, anchor, artifacts, onPick, mode, onSwitchMode, sessionHasData }) {
  if (!sessionHasData) {
    return (
      <ModeIntro
        mode={mode}
        anchor={anchor}
        onPrimary={() => onPick({ mode, label: defaultQuestionFor(mode, null, anchor?.label) })}
      />
    )
  }
  const artifactName = artifacts[0]?.name || null
  const prompts = []
  if (anchor) prompts.push({ mode: LEARNING_MODE.EXPLAIN, label: `Explain this passage: ${excerpt(anchor.label, 48)}` })
  if (artifactName) prompts.push({ mode: LEARNING_MODE.WHY, label: `Why was this structure used in ${excerpt(artifactName, 36)}?` })
  prompts.push({ mode: LEARNING_MODE.EXPLAIN, label: 'Explain the methodology simply' })
  if (prompts.length < 4) prompts.push({ mode: LEARNING_MODE.QUIZ, label: 'Quiz me on the main findings' })
  if (prompts.length < 4) prompts.push({ mode: LEARNING_MODE.LECTURER, label: 'What might my lecturer ask?' })
  if (prompts.length < 4 && task) prompts.push({ mode: LEARNING_MODE.DEFEND, label: `Help me defend the key decisions in ${excerpt(task.title, 32)}` })
  return (
    <div className="sn-ex-default">
      <p className="student-overline">TRY NEXT</p>
      <h3>Keep going with your delivery</h3>
      <div className="sn-ex-prompt-rows">
        {prompts.slice(0, 4).map((prompt) => (
          <button key={prompt.label} className="sn-ex-prompt-row" onClick={() => onPick(prompt)}>
            <span className="sn-ex-prompt-mode">{modeMeta(prompt.mode).label}</span>
            <span className="sn-ex-prompt-label">{prompt.label}</span>
            <ArrowRight size={14} />
          </button>
        ))}
      </div>
      {task && <p className="sn-ex-default-meta">Grounded in {task.title}{task.subject ? ` · ${task.subject}` : ''}{task.reference ? ` · ${task.reference}` : ''}.</p>}
    </div>
  )
}

function LearningTrail({ trail, open, onToggle }) {
  const buttonRef = useRef(null)
  const position = usePopoverPosition(open, buttonRef, '.sn-ex-studio-pane', { preferBelow: true })
  return (
    <div className="sn-ex-trail">
      <button ref={buttonRef} className="sn-ex-tool-btn" onClick={onToggle} aria-expanded={open} aria-haspopup="dialog">
        <ListChecks size={14} /> LEARNING TRAIL{trail.length ? ` — ${trail.length}` : ''}
        <ChevronDown size={13} className={open ? 'is-open' : ''} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div className="sn-ex-trail-panel" style={position} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18 }} role="dialog" aria-label="Learning trail">
            <div className="sn-ex-popover-head">
              <p className="student-overline">LEARNING TRAIL</p>
              <button className="sn-ex-icon-btn" onClick={onToggle} aria-label="Close trail"><X size={14} /></button>
            </div>
            {trail.length === 0 ? (
              <p className="sn-ex-trail-empty">What you explore this session appears here.</p>
            ) : (
              <ul className="sn-ex-trail-list">
                {trail.map((item) => (
                  <li key={item.key} className={item.status}>
                    <span className="sn-ex-trail-mark">{item.status === 'complete' ? <Check size={12} /> : <Clock size={12} />}</span>
                    <span>{item.label}</span>
                    <em>{item.status === 'complete' ? '✓' : 'In Progress'}</em>
                  </li>
                ))}
              </ul>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function SessionHistoryPopover({ sessions, onResume }) {
  const [open, setOpen] = useState(false)
  const buttonRef = useRef(null)
  const position = usePopoverPosition(open, buttonRef, null, { preferBelow: true })
  if (sessions == null) return null
  return (
    <div className="sn-ex-sessions">
      <button ref={buttonRef} className="sn-ex-tool-btn" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <Clock size={14} /> RECENT SESSIONS
      </button>
      <ClickOutside onClick={() => setOpen(false)} enabled={open}>
        <AnimatePresence>
          {open && (
            <motion.div className="sn-ex-popover sn-ex-sessions-popover" style={position} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18 }}>
              <div className="sn-ex-popover-head"><p className="student-overline">RECENT SESSIONS</p></div>
              {sessions.length === 0 ? (
                <p className="sn-ex-trail-empty">No recent sessions for this task.</p>
              ) : (
                <ul className="sn-ex-session-list">
                  {sessions.map((session) => (
                    <li key={session.id}>
                      <button onClick={() => { setOpen(false); onResume(session.id) }}>
                        <strong>{session.title}</strong>
                        <small>{session.mode ? modeMeta(session.mode).label : 'Session'}{session.updatedAt ? ` — ${formatRelativeTime(session.updatedAt)}` : ''}</small>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </ClickOutside>
    </div>
  )
}

function RubricDrawer({ rubric, mapping, open, onClose }) {
  const panelRef = useRef(null)
  useEffect(() => {
    if (!open) return undefined
    const closeOnEsc = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', closeOnEsc)
    const first = panelRef.current?.querySelector('button')
    first?.focus()
    const trap = (e) => {
      if (e.key !== 'Tab' || !panelRef.current) return
      const focusables = panelRef.current.querySelectorAll('button, [href], input, [tabindex]:not([tabindex="-1"])')
      if (!focusables.length) return
      const firstEl = focusables[0]
      const lastEl = focusables[focusables.length - 1]
      if (e.shiftKey && document.activeElement === firstEl) { e.preventDefault(); lastEl.focus() }
      else if (!e.shiftKey && document.activeElement === lastEl) { e.preventDefault(); firstEl.focus() }
    }
    document.addEventListener('keydown', trap)
    return () => { document.removeEventListener('keydown', closeOnEsc); document.removeEventListener('keydown', trap) }
  }, [open, onClose])

  if (!rubric) return null
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="sn-ex-drawer-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
          <motion.aside
            ref={panelRef}
            className="sn-ex-drawer"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.24 }}
            role="dialog"
            aria-label="Rubric criteria"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sn-ex-drawer-head">
              <div>
                <p className="student-overline">RUBRIC — {rubric.criteria.length} criteria</p>
                <h2>Assessment criteria</h2>
              </div>
              <button className="sn-ex-icon-btn" onClick={onClose} aria-label="Close rubric"><X size={17} /></button>
            </div>
            <div className="sn-ex-drawer-body">
              {rubric.criteria.map((criterion) => {
                const isMapped = mapping && String(mapping.criterion.id) === String(criterion.id)
                return (
                  <div key={criterion.id} className={`sn-ex-rubric-criterion ${isMapped ? 'is-current' : ''}`}>
                    <div className="sn-ex-rubric-top">
                      <strong>{criterion.label}</strong>
                      {criterion.weight != null && <span>{criterion.weight}{typeof criterion.weight === 'number' && criterion.weight <= 1 ? '' : '%'}</span>}
                    </div>
                    {criterion.description && <p>{criterion.description}</p>}
                    {isMapped && <em>Current concept relates to this criterion.</em>}
                  </div>
                )
              })}
            </div>
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function ExplainEmptyStates({ variant, reason, onRetry }) {
  if (variant === 'access') {
    return (
      <section className="sn-ex-empty" role="alert">
        <p className="student-overline">ACCESS REQUIRED</p>
        <h2>Sign in to open Explain & Defend.</h2>
        <p>Your student session is missing or has expired.</p>
        <button className="student-button" onClick={() => go('/login')}>Sign in <ArrowRight size={14} /></button>
      </section>
    )
  }
  if (variant === 'processing') {
    return (
      <section className="sn-ex-empty">
        <RefreshCw size={34} strokeWidth={1.2} className="sn-ex-empty-icon" />
        <p className="student-overline">PREPARING EXPLAIN & DEFEND</p>
        <h2>Your delivery is being prepared for the learning workspace.</h2>
        <p>{reason || 'Source ingestion is still running for this delivery.'}</p>
        <button className="student-button student-button--secondary" onClick={() => go('/student/files')}>Open Files & Deliveries <ArrowRight size={14} /></button>
      </section>
    )
  }
  if (variant === 'error') {
    return (
      <section className="sn-ex-empty" role="alert">
        <TriangleAlert size={32} strokeWidth={1.3} />
        <p className="student-overline">COULD NOT LOAD</p>
        <h2>We couldn't load your eligible deliveries.</h2>
        <button className="student-button" onClick={onRetry}>Try Again <RefreshCw size={14} /></button>
      </section>
    )
  }
  if (variant === 'ineligible') {
    return (
      <section className="sn-ex-empty">
        <BookOpen size={32} strokeWidth={1.2} />
        <p className="student-overline">NOT AVAILABLE FOR THIS TASK</p>
        <h2>{reason || 'Explain & Defend is not available for this delivery.'}</h2>
        <button className="student-button student-button--secondary" onClick={() => go('/student/tasks')}>View My Tasks <ArrowRight size={14} /></button>
      </section>
    )
  }
  return (
    <section className="sn-ex-empty">
      <BookOpen size={34} strokeWidth={1.2} className="sn-ex-empty-icon" />
      <p className="student-overline">NOTHING TO EXPLAIN YET</p>
      <h2>Explain & Defend becomes available when an eligible SolveNest delivery is ready.</h2>
      <div className="sn-ex-state-actions">
        <button className="student-button" onClick={() => go('/student/tasks')}>View My Tasks <ArrowRight size={14} /></button>
        <button className="student-button student-button--secondary" onClick={() => go('/student/files')}>Files & Deliveries <ArrowRight size={14} /></button>
      </div>
    </section>
  )
}

function PageSkeleton() {
  return (
    <div className="sn-ex-page-skeleton" aria-label="Loading Explain & Defend">
      <span className="sk sk-title" />
      <span className="sk sk-sub" />
      <span className="sk sk-rail" />
      <div className="sn-ex-page-skeleton-split">
        <span className="sk sk-pane" />
        <span className="sk sk-pane" />
      </div>
    </div>
  )
}

function UnderstandingWorkspace({
  task, artifacts, anchor, session, rubric, sessions, usage, isMobile,
  onShowSource, quizState, lecturerState, defendState, onSwitchMode, onIntegrityAction, onResume,
}) {
  const [trailOpen, setTrailOpen] = useState(false)
  const [rubricOpen, setRubricOpen] = useState(false)
  const { mode, setMode, composer, setComposer, ask, retry, stream, trail } = session
  const data = stream.data
  const meta = modeMeta(mode)
  const mapping = resolveRubricLink(data, rubric)
  const busy = stream.status === 'loading' || stream.status === 'streaming'
  const focusLabel = session.focusLabel || anchor?.label || artifacts[0]?.name || task?.title || 'Delivery'

  const submitComposer = () => {
    const text = composer.trim()
    if (!text || busy) return
    const selection = anchor ? { text: null, anchor: { kind: anchor.kind, ref: anchor.ref, label: anchor.label } } : null
    ask({ question: text, selection })
    setComposer('')
  }

  const pickPrompt = (prompt) => {
    const selection = anchor ? { text: null, anchor: { kind: anchor.kind, ref: anchor.ref, label: anchor.label } } : null
    ask({ question: prompt.label, selection, mode: prompt.mode })
    if (prompt.mode !== mode) setMode(prompt.mode)
  }

  const showComposer = busy
    ? false
    : mode === LEARNING_MODE.EXPLAIN || mode === LEARNING_MODE.WHY
      ? true
      : mode === LEARNING_MODE.QUIZ
        ? !(quizState.view === 'question' || quizState.view === 'reveal')
        : mode === LEARNING_MODE.LECTURER
          ? !(lecturerState.view === 'question' || (lecturerState.view === 'coaching' && data?.followUp))
          : defendState.view !== 'question' && defendState.view !== 'feedback'

  const responseNode = () => {
    const isPractice = mode === LEARNING_MODE.QUIZ || mode === LEARNING_MODE.LECTURER || mode === LEARNING_MODE.DEFEND
    if (stream.status === 'integrity') return <IntegrityNotice integrity={data?.integrity} onAction={onIntegrityAction} />
    if (stream.status === 'error') return <ExplainFailure onRetry={retry} message={stream.error?.code === 'UNSUPPORTED' ? 'This mode is not available for Explain & Defend yet.' : undefined} />
    if (stream.status === 'stopped') return <ExplainFailure onRetry={retry} message="Generation was stopped." />
    if (busy && isPractice) return <SourceStreamingIndicator canStop={stream.canStop} onStop={stream.stop} />
    if (!data && busy) return <SourceStreamingIndicator canStop={stream.canStop} onStop={stream.stop} />
    if (!data) {
      const hasPrior = trail.length > 0
      if (mode === LEARNING_MODE.QUIZ) return <QuizWorkspace data={null} stream={stream} view={quizState.view} setView={quizState.setView} scope={quizState.scope} setScope={quizState.setScope} anchor={anchor} onShowSource={onShowSource} onAsk={quizState.onAsk} hasAsked={false} draft={quizState.draft} setDraft={quizState.setDraft} onSwitchMode={onSwitchMode} />
      if (mode === LEARNING_MODE.LECTURER) return <LecturerQuestionsWorkspace data={null} stream={stream} view={lecturerState.view} setView={lecturerState.setView} anchor={anchor} onShowSource={onShowSource} onAsk={lecturerState.onAsk} draft={lecturerState.draft} setDraft={lecturerState.setDraft} onSwitchMode={onSwitchMode} />
      if (mode === LEARNING_MODE.DEFEND) return <DefendWorkspace data={null} stream={stream} view={defendState.view} setView={defendState.setView} anchor={anchor} onShowSource={onShowSource} onAsk={defendState.onAsk} draft={defendState.draft} setDraft={defendState.setDraft} />
      if (!hasPrior) return <OrientationPanel task={task} artifacts={artifacts} mode={mode} onPick={pickPrompt} onSwitchMode={onSwitchMode} />
      return <DefaultPrompts task={task} anchor={anchor} artifacts={artifacts} onPick={pickPrompt} mode={mode} onSwitchMode={onSwitchMode} sessionHasData={false} />
    }
    if (busy && !data.question && !data.plain && !data.decision && !data.completion && !data.reveal && !data.coaching && !data.feedback) {
      return <SourceStreamingIndicator canStop={stream.canStop} onStop={stream.stop} />
    }
    if (mode === LEARNING_MODE.EXPLAIN) return <><ExplainResponse data={data} anchor={anchor} onShowSource={onShowSource} onRetry={retry} onPractice={() => setComposer(data.trySayingIt || '')} />{busy && <SourceStreamingIndicator canStop={stream.canStop} onStop={stream.stop} />}</>
    if (mode === LEARNING_MODE.WHY) return <><WhyResponse data={data} anchor={anchor} onShowSource={onShowSource} onRetry={retry} />{busy && <SourceStreamingIndicator canStop={stream.canStop} onStop={stream.stop} />}</>
    if (mode === LEARNING_MODE.QUIZ) return <QuizWorkspace data={data} stream={stream} view={quizState.view} setView={quizState.setView} scope={quizState.scope} setScope={quizState.setScope} anchor={anchor} onShowSource={onShowSource} onAsk={quizState.onAsk} hasAsked draft={quizState.draft} setDraft={quizState.setDraft} onSwitchMode={onSwitchMode} />
    if (mode === LEARNING_MODE.LECTURER) return <LecturerQuestionsWorkspace data={data} stream={stream} view={lecturerState.view} setView={lecturerState.setView} anchor={anchor} onShowSource={onShowSource} onAsk={lecturerState.onAsk} draft={lecturerState.draft} setDraft={lecturerState.setDraft} onSwitchMode={onSwitchMode} />
    return <DefendWorkspace data={data} stream={stream} view={defendState.view} setView={defendState.setView} anchor={anchor} onShowSource={onShowSource} onAsk={defendState.onAsk} draft={defendState.draft} setDraft={defendState.setDraft} />
  }

  return (
    <section className="sn-ex-workspace" aria-label="Understanding workspace">
      <header className="sn-ex-work-header">
        <div className="sn-ex-work-title">
          <div className="sn-ex-work-title-row">
            <div className="sn-ex-work-heading">
              <p className="student-overline">{meta.header}</p>
              <p className="sn-ex-work-purpose">{meta.purpose}</p>
            </div>
            <div className="sn-ex-work-tools">
              {usage && <span className="sn-ex-usage" title={usage.periodLabel ? `Resets ${usage.periodLabel}` : undefined}>{usage.remaining} left{usage.periodLabel ? ` ${usage.periodLabel}` : ''}</span>}
              <LearningTrail trail={trail} open={trailOpen} onToggle={() => setTrailOpen((v) => !v)} />
              <SessionHistoryPopover sessions={sessions} onResume={onResume} />
              {rubric && (
                <button className="sn-ex-tool-btn" onClick={() => setRubricOpen(true)} aria-label="Open rubric">
                  <ShieldCheck size={14} /> RUBRIC
                </button>
              )}
            </div>
          </div>
          <div className="sn-ex-focus-row">
            <span className="sn-ex-focus-chip">
              <Sparkles size={11} />
              <span title={focusLabel}>{excerpt(focusLabel, 42)}</span>
            </span>
            {anchor && (
              <button className="sn-ex-anchor-chip" onClick={onShowSource}>
                <span className="sn-ex-anchor-chip-id">{anchorDisplayId(anchor) || 'SOURCE'}</span>
                <span>{anchor.label}</span>
                <em>View Source →</em>
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="sn-ex-work-scroll" key={mode}>
        <AnimatePresence mode="wait">
          <motion.div
            key={mode}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            aria-live="polite"
          >
            {responseNode()}
          </motion.div>
        </AnimatePresence>
      </div>

      {showComposer && (
        <Composer mode={mode} value={composer} onChange={setComposer} onSubmit={submitComposer} busy={busy} canStop={stream.canStop} onStop={stream.stop} />
      )}

      <RubricDrawer rubric={rubric} mapping={mapping} open={rubricOpen} onClose={() => setRubricOpen(false)} />
    </section>
  )
}

export function StudentExplainPage() {
  const isStacked = useMediaQuery('(max-width: 900px)')
  const isNarrow = useMediaQuery('(max-width: 680px)')
  const tasksState = useEligibleTasks()
  const routeInitial = useMemo(() => parseExplainRoute(), [])
  const [taskId, setTaskId] = useState(routeInitial.taskId)
  const [pane, setPane] = useState('source')
  const [announcer, setAnnouncer] = useState('')
  const [quizScope, setQuizScope] = useState('quick')
  const [quizView, setQuizView] = useState('setup')
  const [quizDraft, setQuizDraft] = useState('')
  const [lecturerView, setLecturerView] = useState('start')
  const [lecturerDraft, setLecturerDraft] = useState('')
  const [defendView, setDefendView] = useState('brief')
  const [defendDraft, setDefendDraft] = useState('')
  const routeAnchorApplied = useRef(false)

  const session = useExplainSession(taskId)
  const tasks = tasksState.tasks
  const selectedTask = tasks.find((t) => t.id === taskId) || null
  const eligibleTasks = tasks.filter((t) => t.eligible)
  const artifactsState = useTaskArtifacts(selectedTask?.eligible ? taskId : null)
  const viewer = useArtifactViewer(session.artifactId)
  const selection = useSourceSelection(viewer.scrollRef, viewer.mode === 'parsed' && (!isStacked || pane === 'source'))
  const [rubric, setRubric] = useState(null)
  const [sessions, setSessions] = useState(undefined)
  const [usage, setUsage] = useState(null)

  useEffect(() => {
    if (tasksState.loading || tasks.length === 0) return
    if (taskId && tasks.some((t) => t.id === taskId && t.eligible)) return
    const fallback = tasks.find((t) => t.eligible)
    if (fallback) setTaskId(fallback.id)
    else setTaskId(null)
  }, [tasksState.loading, tasks, taskId])

  useEffect(() => {
    if (!taskId) return undefined
    const controller = new AbortController()
    fetchRubric(taskId, { signal: controller.signal }).then(setRubric).catch(() => setRubric(null))
    fetchSessionHistory(taskId, { signal: controller.signal }).then((rows) => setSessions(rows)).catch(() => setSessions(null))
    return () => controller.abort()
  }, [taskId])

  useEffect(() => {
    const controller = new AbortController()
    fetchUsageLimits({ signal: controller.signal }).then(setUsage).catch(() => setUsage(null))
    return () => controller.abort()
  }, [])

  useEffect(() => {
    if (artifactsState.loading) return
    const list = artifactsState.artifacts
    if (!list.length) return
    if (session.artifactId && list.some((a) => a.id === session.artifactId)) return
    session.setArtifactId(list[0].id)
  }, [artifactsState.loading, artifactsState.artifacts, session])

  useEffect(() => {
    syncExplainRoute({ taskId, artifactId: session.artifactId, mode: session.mode, anchor: session.anchor?.ref ?? null })
  }, [taskId, session.artifactId, session.mode, session.anchor])

  useEffect(() => {
    if (!session.anchor) return
    viewer.setActiveAnchor(session.anchor)
    const timer = setTimeout(() => viewer.focusAnchor(session.anchor), 60)
    return () => clearTimeout(timer)
  }, [session.anchor?.uiId, session.anchor?.ref])

  useEffect(() => {
    if (routeAnchorApplied.current || !routeInitial.anchor) return
    if (viewer.status !== 'ready') return
    routeAnchorApplied.current = true
    viewer.focusAnchor({ ref: routeInitial.anchor })
  }, [routeInitial.anchor, viewer])

  useEffect(() => {
    const status = session.stream.status
    if (status === 'done') setAnnouncer('Response ready.')
    else if (status === 'error') setAnnouncer("We couldn't complete this explanation.")
    else if (status === 'integrity') setAnnouncer('Request paused for academic integrity guidance.')
  }, [session.stream.status])

  useEffect(() => {
    const status = session.stream.status
    const data = session.stream.data
    if (status !== 'done' || !data) return
    if (session.mode === LEARNING_MODE.QUIZ) {
      if (data.completion) setQuizView('complete')
      else if (data.reveal) setQuizView('reveal')
      else if (data.question) setQuizView('question')
    } else if (session.mode === LEARNING_MODE.LECTURER) {
      if (data.coaching) setLecturerView('coaching')
      else if (data.question) setLecturerView('question')
      else if (data.complete) setLecturerView('coaching')
    } else if (session.mode === LEARNING_MODE.DEFEND) {
      if (data.feedback) setDefendView('feedback')
      else if (data.question) setDefendView('question')
      else if (data.complete) setDefendView('feedback')
    }
  }, [session.stream.status, session.stream.data, session.mode])

  useEffect(() => {
    if (isStacked && session.stream.status === 'done') setPane('studio')
  }, [session.stream.status, isStacked])

  const handleModeChange = useCallback((nextMode) => {
    session.setMode(nextMode)
    setQuizDraft('')
    setLecturerDraft('')
    setDefendDraft('')
    if (nextMode === LEARNING_MODE.QUIZ) setQuizView('setup')
    if (nextMode === LEARNING_MODE.LECTURER) setLecturerView('start')
    if (nextMode === LEARNING_MODE.DEFEND) setDefendView('brief')
  }, [session])

  const handleSwitchMode = useCallback((nextMode, opts = {}) => {
    handleModeChange(nextMode)
    if (opts.question) {
      session.ask({ question: opts.question, mode: nextMode })
    }
  }, [handleModeChange, session])

  const handleShowSource = useCallback(() => {
    if (isStacked) setPane('source')
    const target = session.anchor || viewer.activeAnchor
    if (!target) return
    const ok = viewer.focusAnchor(target)
    if (!ok && viewer.mode !== 'embedded') session.notify('source', "We couldn't jump to that source location.")
  }, [isStacked, session, viewer])

  const deriveAnchorFromSelection = useCallback((text) => {
    const content = viewer.content
    if (!content) return session.anchor
    if (content.kind === 'code') {
      const file = content.files.find((f) => f.path === viewer.activePath) || content.files[0]
      const line = file?.lines.find((l) => l.text.includes(text))
      if (line) return { kind: 'code', ref: line.n, lines: [line.n, line.n], file: file.path, label: `${file.path}, Line ${line.n}` }
      return session.anchor
    }
    if (content.pages) {
      const block = content.pages.flatMap((p) => p.blocks).find((b) => b.text.includes(text))
      if (block) return { kind: 'document', ref: block.id, page: block.page, label: excerpt(text, 56) }
      return session.anchor
    }
    if (content.kind === 'slides') {
      return session.anchor
    }
    return session.anchor
  }, [viewer, session.anchor])

  const handleSelectionAction = useCallback((mode, text) => {
    const derived = deriveAnchorFromSelection(text)
    if (derived) session.setAnchor(derived)
    handleModeChange(mode)
    if (isStacked) setPane('studio')
    const selectionPayload = { text, anchor: derived ? { kind: derived.kind, ref: derived.ref, label: derived.label } : null }
    session.ask({ question: defaultQuestionFor(mode, text, derived?.label), selection: selectionPayload, mode })
    selection.clear()
  }, [deriveAnchorFromSelection, handleModeChange, isStacked, session, selection])

  const handleIntegrityAction = useCallback((action) => {
    handleModeChange(action.mode)
    session.ask({ question: action.question || null, scope: action.scope || null, mode: action.mode })
  }, [handleModeChange, session])

  const onDownload = useCallback((artifact) => {
    requestFileAccess(artifact.id).then((url) => {
      if (!url) { session.notify('source', 'Download is not available for this file right now.'); return }
      const a = document.createElement('a')
      a.href = url
      a.download = artifact.name
      a.click()
    }).catch(() => session.notify('source', 'Download is not available for this file right now.'))
  }, [session])

  const resume = useCallback((sessionId) => {
    resumeSession(sessionId)
      .then((restored) => {
        session.applyResumedSession(restored)
        session.notify('session', 'Session resumed.')
      })
      .catch(() => session.notify('session', "We couldn't resume that session."))
  }, [session])

  const eligibleCount = eligibleTasks.length
  const hasProcessingOnly = tasks.length > 0 && eligibleCount === 0 && tasks.some((t) => t.availability === 'processing')

  if (tasksState.loading && tasks.length === 0) {
    return <div className="sn-ex-page"><PageSkeleton /></div>
  }
  if (tasksState.error) {
    return <div className="sn-ex-page"><ExplainEmptyStates variant={tasksState.error.message === 'STUDENT_ACCESS_REQUIRED' ? 'access' : 'error'} onRetry={tasksState.reload} /></div>
  }
  if (eligibleCount === 0) {
    return (
      <div className="sn-ex-page">
        <header className="sn-ex-header">
          <p className="student-overline">STUDENT WORKSPACE</p>
          <h1>Explain &amp; Defend</h1>
          <p className="sn-ex-subtitle">Own the work you submitted. Break it down, justify the choices, and practise explaining it — grounded in your real delivery and rubric.</p>
        </header>
        <ExplainEmptyStates variant={hasProcessingOnly ? 'processing' : 'no-task'} reason={hasProcessingOnly ? tasks.find((t) => t.availability === 'processing')?.reason : null} />
      </div>
    )
  }

  const quizState = {
    view: quizView,
    setView: setQuizView,
    scope: quizScope,
    setScope: setQuizScope,
    draft: quizDraft,
    setDraft: setQuizDraft,
    onAsk: (opts = {}) => {
      if (session.composer.trim() && !opts.question && !opts.prompt && !opts.scope) {
        session.ask({ question: session.composer.trim(), scope: quizScope })
        session.setComposer('')
      } else if (opts.question) {
        session.ask({ ...opts, scope: opts.scope || quizScope, round: 'reveal' })
      } else if (opts.prompt) {
        session.ask({ ...opts, scope: opts.scope || quizScope, round: 'complete' })
      } else {
        session.ask({ ...opts, scope: opts.scope || quizScope, round: 'question' })
      }
      setQuizView('question')
    },
  }
  const lecturerState = {
    view: lecturerView,
    setView: setLecturerView,
    draft: lecturerDraft,
    setDraft: setLecturerDraft,
    onAsk: (opts = {}) => {
      if (session.composer.trim() && !opts.question && !opts.prompt) {
        session.ask({ question: session.composer.trim() })
        session.setComposer('')
      } else {
        session.ask(opts)
      }
      setLecturerView('question')
    },
  }
  const defendState = {
    view: defendView,
    setView: setDefendView,
    draft: defendDraft,
    setDraft: setDefendDraft,
    onAsk: (opts = {}) => {
      session.ask(opts)
      setDefendView('question')
    },
  }

  const showSourcePane = !isStacked || pane === 'source'
  const showStudioPane = !isStacked || pane === 'studio'

  return (
    <div className="sn-ex-page">
      <header className="sn-ex-header">
        <div className="sn-ex-header-text">
          <p className="student-overline">STUDENT WORKSPACE</p>
          <h1>Explain &amp; Defend</h1>
          <p className="sn-ex-subtitle">Own the work you submitted. Break it down, justify the choices, and practise explaining it — grounded in your real delivery and rubric.</p>
        </div>
        <div className="sn-ex-header-controls">
          {tasks.length > 1 ? (
            <ExplainTaskSelector tasks={tasks} selectedId={taskId} onSelect={setTaskId} loading={tasksState.loading} />
          ) : selectedTask ? (
            <div className="sn-ex-task-static">
              <strong>{selectedTask.title}</strong>
              <span>{deliveryLabel(selectedTask)}</span>
            </div>
          ) : null}
        </div>
      </header>

      <LearningModeRail mode={session.mode} onChange={handleModeChange} />

      {isStacked && <MobileSourceStudioToggle pane={pane} onChange={setPane} />}

      <div className="sn-ex-studio">
        <div className={`sn-ex-source-pane ${showSourcePane ? '' : 'is-hidden'}`}>
          <ExplainSourceViewer
            task={selectedTask}
            artifacts={artifactsState.artifacts}
            artifactId={session.artifactId}
            onSelectArtifact={session.setArtifactId}
            viewer={viewer}
            isMobile={isNarrow}
            onDownload={onDownload}
            loadingArtifacts={artifactsState.loading}
            artifactError={artifactsState.error}
          />
        </div>
        <div className="sn-ex-divider" aria-hidden="true" />
        <div className={`sn-ex-studio-pane ${showStudioPane ? '' : 'is-hidden'}`}>
          <UnderstandingWorkspace
            task={selectedTask}
            artifacts={artifactsState.artifacts}
            anchor={session.anchor}
            session={session}
            rubric={rubric}
            sessions={sessions}
            usage={usage}
            isMobile={isStacked}
            onShowSource={handleShowSource}
            quizState={quizState}
            lecturerState={lecturerState}
            defendState={defendState}
            onSwitchMode={handleSwitchMode}
            onIntegrityAction={handleIntegrityAction}
            onResume={resume}
          />
        </div>
      </div>

      <AnimatePresence>
        <SourceSelectionBar selection={selection.selection} isMobile={isStacked} onAction={handleSelectionAction} onDismiss={selection.clear} />
      </AnimatePresence>

      <AnimatePresence>
        {session.notice && <ExplainToast notice={session.notice} onDismiss={session.dismissNotice} />}
      </AnimatePresence>

      <div className="sn-ex-sr-only" role="status" aria-live="polite">{announcer}</div>
    </div>
  )
}

export {
  ExplainTaskSelector, LearningModeRail, ExplainSourceViewer, SourceSelectionBar,
  UnderstandingWorkspace, ExplainResponse, WhyResponse, QuizWorkspace,
  LecturerQuestionsWorkspace, DefendWorkspace, RubricDrawer, LearningTrail,
  OrientationPanel, ModeIntro,
  SessionHistoryPopover, SourceStreamingIndicator, IntegrityNotice, ExplainEmptyStates,
  MobileSourceStudioToggle,
}
