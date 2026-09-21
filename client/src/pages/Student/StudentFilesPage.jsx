import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, ArrowRight, Check, ChevronDown, ChevronRight, Download, ExternalLink, Eye, File, FileCode, FileImage, FileSpreadsheet, FileText, Filter, FolderOpen, Lock, MessageCircle, MoreHorizontal, Plus, RefreshCw, Search, Shield, Upload, X } from 'lucide-react'
import {
  FILE_VIEWS, FILE_SORT_OPTIONS, mapDossierFile, mapDeliveryFile, mapDossier,
  resolveDossierSections, resolveDeliveryPackage, resolveRevisionState,
  taskHasNewDelivery, buildDossierRoute, parseDossierUrlState, syncDossierUrlState,
  fetchTaskDossiers, fetchTaskDossierDetail, fetchDeliveryPackage,
  requestFileAccess, uploadTaskFile, removeTaskFile, replaceTaskFile,
  requestRevision, filterDossiers, sortDossiers, formatFileSize, getFileIcon,
  canPreviewFile, formatDate, formatRelativeTime
} from '../../student/studentFilesData.js'

const go = (path) => { window.history.pushState({}, '', path); window.dispatchEvent(new PopStateEvent('popstate')) }

const REVISION_STATUSES = ['available', 'requested', 'under_review', 'approved', 'in_progress', 'completed', 'limit_reached']
const DELIVERY_STATUSES = ['ready_to_review', 'revision_in_progress', 'updated_delivery', 'accepted', 'completed']
const DELIVERY_STATUS_LABELS = { ready_to_review: 'READY TO REVIEW', revision_in_progress: 'REVISION IN PROGRESS', updated_delivery: 'UPDATED DELIVERY', accepted: 'ACCEPTED', completed: 'COMPLETED' }
const REVISION_STATUS_LABELS = { available: 'REVISION AVAILABLE', requested: 'REVISION REQUESTED', under_review: 'UNDER REVIEW', approved: 'APPROVED', in_progress: 'IN PROGRESS', completed: 'COMPLETED', limit_reached: 'LIMIT REACHED' }
const ORIGIN_LABELS = { you: 'YOU', student: 'YOU', expert: 'EXPERT', solvenest: 'SOLVENEST', system: 'SOLVENEST' }

/* ── Shared UI Primitives ──────────────────────────────────────────────── */

function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches)
  useEffect(() => { const m = window.matchMedia(query); const handler = (e) => setMatches(e.matches); m.addEventListener('change', handler); return () => m.removeEventListener('change', handler) }, [query])
  return matches
}

function DossierIcon({ filename, size = 16 }) {
  const kind = getFileIcon(filename)
  const props = { size, strokeWidth: 1.5, className: 'sn-files-icon' }
  if (kind === 'pdf') return <FileText {...props} />
  if (kind === 'doc') return <FileText {...props} />
  if (kind === 'xls') return <FileSpreadsheet {...props} />
  if (kind === 'img') return <FileImage {...props} />
  if (kind === 'code') return <FileCode {...props} />
  if (kind === 'zip') return <FolderOpen {...props} />
  return <File {...props} />
}

function ClickOutside({ onClick, children }) {
  const ref = useRef(null)
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) onClick() }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClick])
  return <span ref={ref}>{children}</span>
}

/* ── 01 · PAGE HEADER ──────────────────────────────────────────────────── */

function FilesHeader({ dossierCount, newDeliveries, onFocusDelivery }) {
  return (
    <section className="sn-files-header">
      <p className="sn-files-overline">STUDENT WORKSPACE</p>
      <h1>Files & Deliveries</h1>
      <p className="sn-files-subtitle">Everything connected to your SolveNest tasks, from the original brief to final delivery.</p>
      {newDeliveries > 0 && (
        <button className="sn-files-delivery-alert" onClick={onFocusDelivery}>
          {newDeliveries === 1 ? '1 new delivery is ready.' : `${newDeliveries} new deliveries are ready.`}
          <ChevronRight size={14} />
        </button>
      )}
    </section>
  )
}

/* ── 02 · DOSSIER COMMAND BAR ──────────────────────────────────────────── */

function FilterPopover({ filters, onApply, onClear, onClose }) {
  const [draft, setDraft] = useState({ ...filters })
  const set = (key, val) => setDraft((d) => ({ ...d, [key]: val }))
  const fileTypeOptions = ['pdf', 'doc', 'xls', 'ppt', 'img', 'zip', 'code', 'text', 'other']
  const fileRoleOptions = ['brief', 'rubric', 'reference', 'supporting', 'exchange', 'deliverable']
  return (
    <div className="sn-files-popover" role="dialog" aria-label="Filter files">
      <div className="sn-files-popover-head"><p className="sn-files-overline">FILTER</p><button className="sn-files-icon-btn" onClick={onClose} aria-label="Close"><X size={15} /></button></div>
      <div className="sn-files-filter-section">
        <p className="sn-files-filter-label">File Type</p>
        <div className="sn-files-filter-chips">{fileTypeOptions.map((t) => <button key={t} className={`sn-files-chip ${draft.fileType === t ? 'is-active' : ''}`} onClick={() => set('fileType', draft.fileType === t ? null : t)}>{t}</button>)}</div>
      </div>
      <div className="sn-files-filter-section">
        <p className="sn-files-filter-label">File Role</p>
        <div className="sn-files-filter-chips">{fileRoleOptions.map((r) => <button key={r} className={`sn-files-chip ${draft.fileRole === r ? 'is-active' : ''}`} onClick={() => set('fileRole', draft.fileRole === r ? null : r)}>{r}</button>)}</div>
      </div>
      <div className="sn-files-filter-section">
        <p className="sn-files-filter-label">Delivery Version</p>
        <div className="sn-files-filter-chips">
          {['latest', 'all'].map((v) => <button key={v} className={`sn-files-chip ${draft.deliveryVersion === v ? 'is-active' : ''}`} onClick={() => set('deliveryVersion', draft.deliveryVersion === v ? null : v)}>{v}</button>)}
        </div>
      </div>
      <div className="sn-files-filter-actions">
        <button className="sn-files-btn sn-files-btn--ghost" onClick={onClear}>Clear All</button>
        <button className="sn-files-btn sn-files-btn--primary" onClick={() => { onApply(draft); onClose() }}>Apply Filters</button>
      </div>
    </div>
  )
}

function SortDropdown({ sort, onSort, onClose }) {
  return (
    <ClickOutside onClick={onClose}>
      <div className="sn-files-popover sn-files-sort-popover" role="listbox" aria-label="Sort files">
        {FILE_SORT_OPTIONS.map(([key, label]) => (
          <button key={key} className={`sn-files-sort-option ${sort === key ? 'is-active' : ''}`} role="option" aria-selected={sort === key} onClick={() => { onSort(key); onClose() }}>
            {label}{sort === key && <Check size={14} />}
          </button>
        ))}
      </div>
    </ClickOutside>
  )
}

function DossierCommandBar({ view, onViewChange, search, onSearchChange, sort, onSortChange, filters, onFiltersChange, activeFilterCount }) {
  const [filterOpen, setFilterOpen] = useState(false)
  const [sortOpen, setSortOpen] = useState(false)
  const sortLabel = FILE_SORT_OPTIONS.find(([k]) => k === sort)?.[1] || 'Recently Updated'
  return (
    <div className="sn-files-command-bar">
      <div className="sn-files-search">
        <Search size={15} />
        <input type="search" placeholder="Search files or tasks…" value={search} onChange={(e) => onSearchChange(e.target.value)} aria-label="Search files or tasks" />
        {search && <button className="sn-files-search-clear" onClick={() => onSearchChange('')} aria-label="Clear search"><X size={14} /></button>}
      </div>
      <div className="sn-files-view-rail" role="tablist" aria-label="File view">
        {FILE_VIEWS.map(([key, label]) => (
          <button key={key} role="tab" aria-selected={view === key} className={`sn-files-view-tab ${view === key ? 'is-active' : ''}`} onClick={() => onViewChange(key)}>{label}</button>
        ))}
      </div>
      <div className="sn-files-right-controls">
        <ClickOutside onClick={() => setFilterOpen(false)}>
          <div className="sn-files-filter-wrap">
            <button className="sn-files-btn sn-files-btn--subtle" onClick={() => setFilterOpen(!filterOpen)} aria-expanded={filterOpen}>
              <Filter size={15} /> Filter {activeFilterCount > 0 && <span className="sn-files-filter-count">{activeFilterCount}</span>}
            </button>
            {filterOpen && <FilterPopover filters={filters} onApply={onFiltersChange} onClear={() => onFiltersChange({})} onClose={() => setFilterOpen(false)} />}
          </div>
        </ClickOutside>
        <ClickOutside onClick={() => setSortOpen(false)}>
          <div className="sn-files-sort-wrap">
            <button className="sn-files-btn sn-files-btn--subtle" onClick={() => setSortOpen(!sortOpen)} aria-expanded={sortOpen}>
              {sortLabel} <ChevronDown size={14} />
            </button>
            {sortOpen && <SortDropdown sort={sort} onSort={onSortChange} onClose={() => setSortOpen(false)} />}
          </div>
        </ClickOutside>
      </div>
    </div>
  )
}

/* ── 03a · TASK DOSSIER NAVIGATOR ──────────────────────────────────────── */

function TaskDossierNavigator({ dossiers, selectedId, onSelect, loading }) {
  if (loading) return (
    <aside className="sn-files-navigator">
      <div className="sn-files-nav-header"><p className="sn-files-overline">TASK DOSSIERS</p></div>
      {[1, 2, 3].map((i) => <div key={i} className="sn-files-nav-skeleton"><div className="sn-files-skeleton-line" style={{ width: '70%' }} /><div className="sn-files-skeleton-line sn-files-skeleton-line--short" /></div>)}
    </aside>
  )
  return (
    <aside className="sn-files-navigator">
      <div className="sn-files-nav-header"><p className="sn-files-overline">TASK DOSSIERS</p></div>
      <div className="sn-files-nav-list" role="listbox" aria-label="Task dossiers">
        {dossiers.map((d) => {
          const selected = d.taskId === selectedId
          return (
            <button key={d.taskId} role="option" aria-selected={selected} className={`sn-files-nav-row ${selected ? 'is-selected' : ''}`} onClick={() => onSelect(d.taskId)}>
              <div className="sn-files-nav-title">{d.task.title}</div>
              <div className="sn-files-nav-meta">
                <span className={`sn-files-status-dot tone-${d.display.tone}`} /><span>{d.display.label}</span>
                <span className="sn-files-nav-count">{d.fileCount} file{d.fileCount === 1 ? '' : 's'}</span>
              </div>
              {d.hasNewDelivery && <span className="sn-files-new-badge">NEW DELIVERY</span>}
            </button>
          )
        })}
        {dossiers.length === 0 && !loading && <p className="sn-files-nav-empty">No tasks with files.</p>}
      </div>
    </aside>
  )
}

/* ── 03b · DOSSIER WORKSPACE ───────────────────────────────────────────── */

function FileLedgerRow({ file, section, onPreview, onDownload, onReplace, onRemove, onConversation }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const actions = []
  actions.push({ label: 'Preview', icon: Eye, onClick: () => { onPreview(file); setMenuOpen(false) } })
  actions.push({ label: 'Download', icon: Download, onClick: () => { onDownload(file); setMenuOpen(false) } })
  if (section === 'source' && file.origin === 'you' && file.canReplace) actions.push({ label: 'Replace', icon: RefreshCw, onClick: () => { onReplace(file); setMenuOpen(false) } })
  if (section === 'source' && file.origin === 'you' && file.canRemove) actions.push({ label: 'Remove', icon: X, onClick: () => { onRemove(file); setMenuOpen(false) } })
  if (section === 'exchanges' && file.conversationId) actions.push({ label: 'View in Conversation', icon: MessageCircle, onClick: () => { onConversation(file.conversationId); setMenuOpen(false) } })
  return (
    <div className={`sn-files-row ${file.locked ? 'is-locked' : ''}`}>
      <div className="sn-files-row-main">
        <DossierIcon filename={file.name} size={16} />
        <span className="sn-files-row-name" title={file.name}>{file.name}</span>
        <span className="sn-files-row-role">{file.role || file.type || ''}</span>
        <span className="sn-files-row-date">{formatDate(file.uploadedAt, { year: undefined })}</span>
        <span className="sn-files-row-size">{formatFileSize(file.size)}</span>
      </div>
      <div className="sn-files-row-actions">
        {file.locked && <span className="sn-files-locked-badge" title={file.lockReason || 'Locked to confirmed scope'}><Lock size={13} /> Locked</span>}
        {actions.length > 0 && (
          <ClickOutside onClick={() => setMenuOpen(false)}>
            <button className="sn-files-menu-trigger" onClick={() => setMenuOpen(!menuOpen)} aria-label="File actions" aria-expanded={menuOpen}><MoreHorizontal size={16} /></button>
            {menuOpen && (
              <div className="sn-files-context-menu" role="menu">
                {actions.map((a) => <button key={a.label} role="menuitem" className="sn-files-context-item" onClick={a.onClick}><a.icon size={14} /> {a.label}</button>)}
              </div>
            )}
          </ClickOutside>
        )}
      </div>
    </div>
  )
}

function FileLedger({ files, section, onPreview, onDownload, onReplace, onRemove, onConversation, emptyLabel }) {
  if (files.length === 0) return <div className="sn-files-section-empty"><p className="sn-files-overline">{section === 'source' ? 'SOURCE MATERIALS' : 'TASK EXCHANGES'}</p><p className="sn-files-muted-copy">{emptyLabel || 'No files in this section.'}</p></div>
  return (
    <div className="sn-files-section">
      <div className="sn-files-section-header">
        <p className="sn-files-overline">{section === 'source' ? 'SOURCE MATERIALS' : 'TASK EXCHANGES'}</p>
        <p className="sn-files-section-subtitle">{section === 'source' ? 'Files supplied for this task.' : 'Files shared during task collaboration.'}</p>
      </div>
      <div className="sn-files-ledger">
        <div className="sn-files-ledger-header sn-files-row">
          <div className="sn-files-row-main">
            <span className="sn-files-col-label">FILE</span>
            <span className="sn-files-col-label sn-files-col-role">ROLE</span>
            <span className="sn-files-col-label sn-files-col-date">ADDED</span>
            <span className="sn-files-col-label sn-files-col-size">SIZE</span>
          </div>
          <div className="sn-files-row-actions"><span className="sn-files-col-label">ACTION</span></div>
        </div>
        {files.map((f) => <FileLedgerRow key={f.id} file={f} section={section} onPreview={onPreview} onDownload={onDownload} onReplace={onReplace} onRemove={onRemove} onConversation={onConversation} />)}
      </div>
    </div>
  )
}

function UploadRow({ taskId, section, onUploaded }) {
  const [uploading, setUploading] = useState(null)
  const [progress, setProgress] = useState(0)
  const inputRef = useRef(null)
  const handleFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(file.name)
    setProgress(0)
    try {
      await uploadTaskFile(taskId, file, { section, onProgress: (p) => setProgress(p.percent) })
      setUploading(null)
      onUploaded?.()
    } catch (err) {
      setUploading(null)
      setProgress(0)
    }
    if (inputRef.current) inputRef.current.value = ''
  }
  return (
    <div className="sn-files-upload-row">
      {uploading ? (
        <div className="sn-files-upload-progress">
          <Upload size={14} />
          <span>{uploading}</span>
          <div className="sn-files-progress-bar"><div className="sn-files-progress-fill" style={{ width: `${progress}%` }} /></div>
          <span className="sn-files-progress-pct">{progress}%</span>
        </div>
      ) : (
        <button className="sn-files-add-btn" onClick={() => inputRef.current?.click()}><Plus size={14} /> Add Supporting File</button>
      )}
      <input ref={inputRef} type="file" className="sn-files-hidden-input" onChange={handleFile} aria-hidden="true" tabIndex={-1} />
    </div>
  )
}

/* ── 04 · DELIVERY PACKAGE ─────────────────────────────────────────────── */

function DeliveryVersionRail({ versions, current, onSelect }) {
  if (versions.length <= 1) return null
  return (
    <div className="sn-files-version-rail" role="tablist" aria-label="Delivery versions">
      {versions.map((v) => {
        const isCurrent = v.version === current.version
        return (
          <button key={v.version} role="tab" aria-selected={isCurrent} className={`sn-files-version-tab ${isCurrent ? 'is-current' : ''}`} onClick={() => onSelect(v)}>
            V{v.version} <span className="sn-files-version-date">{formatDate(v.deliveredAt, { year: undefined })}</span>
            {isCurrent && <span className="sn-files-version-current">CURRENT</span>}
          </button>
        )
      })}
    </div>
  )
}

function DeliveryPackage({ dossier, version, onPreview, onDownload, onRevision }) {
  const delivery = resolveDeliveryPackage(dossier, version)
  const revState = resolveRevisionState(delivery)
  if (!delivery) return (
    <div className="sn-files-section sn-files-delivery-empty">
      <p className="sn-files-overline">DELIVERY PACKAGE</p>
      <p className="sn-files-muted-copy">Not available yet. Current task stage: {dossier.display.label}. Delivery files will appear here when approved.</p>
    </div>
  )
  const isCurrent = version === null || version === delivery.version
  return (
    <div className="sn-files-section sn-files-delivery-section">
      <div className="sn-files-delivery-header">
        <p className="sn-files-overline">DELIVERY PACKAGE {delivery.version ? `— VERSION ${delivery.version}` : ''}</p>
        <p className="sn-files-delivery-meta">
          Delivered {formatDate(delivery.deliveredAt)}
          {delivery.deliveredAt && <span className="sn-files-delivery-time">{new Date(delivery.deliveredAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</span>}
          {!isCurrent && <span className="sn-files-prev-version-badge">PREVIOUS VERSION</span>}
        </p>
      </div>
      <DeliveryVersionRail versions={dossier.deliveryVersions} current={delivery} onSelect={() => {}} />
      <div className="sn-files-delivery-status-bar">
        <span className={`sn-files-delivery-status tone-${delivery.status === 'ready_to_review' ? 'attention' : delivery.status === 'accepted' || delivery.status === 'completed' ? 'complete' : 'active'}`}>
          {DELIVERY_STATUS_LABELS[delivery.status] || delivery.status}
        </span>
      </div>
      {delivery.files.length > 0 && (
        <div className="sn-files-delivery-files">
          {delivery.files.map((f) => (
            <div key={f.id} className="sn-files-delivery-file-row">
              <DossierIcon filename={f.name} size={16} />
              <span className="sn-files-row-name" title={f.name}>{f.name}</span>
              <span className="sn-files-row-type">{f.type || ''}</span>
              <span className="sn-files-row-size">{formatFileSize(f.size)}</span>
              <div className="sn-files-delivery-file-actions">
                <button className="sn-files-action-link" onClick={() => onPreview(f)}><Eye size={13} /> Preview</button>
                <button className="sn-files-action-link" onClick={() => onDownload(f)}><Download size={13} /> Download</button>
              </div>
            </div>
          ))}
        </div>
      )}
      {delivery.qa && (
        <div className="sn-files-delivery-qa">
          <p className="sn-files-overline">QUALITY CHECK</p>
          <div className="sn-files-qa-items">
            {delivery.qa.checks?.map((c, i) => <span key={i} className={`sn-files-qa-item ${c.pass ? 'is-pass' : 'is-fail'}`}>{c.label}</span>)}
            {!delivery.qa.checks && delivery.qa.complete && <span className="sn-files-qa-item is-pass">Requirements reviewed</span>}
          </div>
        </div>
      )}
      {delivery.note && <div className="sn-files-delivery-note"><p className="sn-files-overline">DELIVERY NOTE</p><p>{delivery.note}</p></div>}
      {revState.status && (
        <div className={`sn-files-revision-notice sn-files-revision-${revState.status}`}>
          <div className="sn-files-revision-header">
            <p className="sn-files-overline">{REVISION_STATUS_LABELS[revState.status] || 'REVISION'}</p>
          </div>
          <p className="sn-files-revision-copy">{revState.copy}</p>
          {revState.status === 'available' && <button className="sn-files-btn sn-files-btn--primary" onClick={() => onRevision(dossier.taskId)}>Request Revision →</button>}
        </div>
      )}
      {delivery.explainAndDefend && (
        <div className="sn-files-explain-bridge">
          <p className="sn-files-overline">UNDERSTAND YOUR DELIVERY</p>
          <p>Go beyond the files. Review concepts, practise questions and prepare to explain your work.</p>
          <button className="sn-files-btn sn-files-btn--primary" onClick={() => go(delivery.explainAndDefend.route || '/student/explain')}>Open Explain & Defend →</button>
        </div>
      )}
    </div>
  )
}

/* ── 05 · FILE INSPECTOR / PREVIEW ─────────────────────────────────────── */

function FileInspector({ file, onClose, onDownload }) {
  const [signedUrl, setSignedUrl] = useState(null)
  const [loadingUrl, setLoadingUrl] = useState(true)
  const [urlError, setUrlError] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoadingUrl(true)
    setUrlError(false)
    if (file?.id) {
      requestFileAccess(file.id).then((url) => { if (!cancelled) { setSignedUrl(url); setLoadingUrl(false) } }).catch(() => { if (!cancelled) { setUrlError(true); setLoadingUrl(false) } })
    } else {
      setSignedUrl(file?.signedUrl || file?.previewUrl || null)
      setLoadingUrl(false)
    }
    return () => { cancelled = true }
  }, [file?.id])

  if (!file) return null
  const ext = file.name?.split('.').pop()?.toLowerCase()
  const isImage = ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'].includes(ext)
  const isPdf = ext === 'pdf'
  const isPreviewable = canPreviewFile(file.name)

  return (
    <motion.div className="sn-files-inspector-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
      <motion.div className="sn-files-inspector" initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ duration: 0.25 }}>
        <div className="sn-files-inspector-header">
          <div className="sn-files-inspector-info">
            <DossierIcon filename={file.name} size={18} />
            <div>
              <p className="sn-files-inspector-name">{file.name}</p>
              <p className="sn-files-inspector-meta">{file.role || file.type || ''} · {formatFileSize(file.size)}</p>
            </div>
          </div>
          <div className="sn-files-inspector-actions">
            <button className="sn-files-btn sn-files-btn--subtle" onClick={() => onDownload(file)}><Download size={15} /> Download</button>
            <button className="sn-files-icon-btn" onClick={onClose} aria-label="Close preview"><X size={18} /></button>
          </div>
        </div>
        <div className="sn-files-inspector-content">
          {loadingUrl && <div className="sn-files-inspector-loading"><RefreshCw size={24} className="sn-files-spin" /><p>Loading preview…</p></div>}
          {!loadingUrl && urlError && <div className="sn-files-inspector-unavailable"><p className="sn-files-overline">PREVIEW NOT AVAILABLE</p><p>Unable to load a preview for this file.</p><button className="sn-files-btn sn-files-btn--primary" onClick={() => onDownload(file)}>Download File →</button></div>}
          {!loadingUrl && !urlError && isPdf && signedUrl && <iframe className="sn-files-pdf-viewer" src={signedUrl} title={file.name} />}
          {!loadingUrl && !urlError && isImage && signedUrl && <img className="sn-files-image-viewer" src={signedUrl} alt={file.name} />}
          {!loadingUrl && !urlError && !isPreviewable && <div className="sn-files-inspector-unavailable"><p className="sn-files-overline">PREVIEW NOT AVAILABLE</p><p>This file type cannot be previewed.</p><button className="sn-files-btn sn-files-btn--primary" onClick={() => onDownload(file)}>Download File →</button></div>}
          {!loadingUrl && !urlError && isPreviewable && !isPdf && !isImage && signedUrl && <iframe className="sn-files-text-viewer" src={signedUrl} title={file.name} />}
        </div>
      </motion.div>
    </motion.div>
  )
}

/* ── SEARCH RESULT LEDGER ──────────────────────────────────────────────── */

function SearchResultLedger({ dossiers, search, onSelectTask, onPreview }) {
  const results = useMemo(() => {
    const term = search.toLowerCase()
    const out = []
    dossiers.forEach((d) => {
      const allFiles = [...d.sourceFiles, ...d.exchangeFiles, ...d.deliveryVersions.flatMap((v) => v.files)]
      allFiles.forEach((f) => {
        if (f.name?.toLowerCase().includes(term) || f.role?.toLowerCase().includes(term) || d.task.title?.toLowerCase().includes(term) || d.task.reference?.toLowerCase().includes(term)) {
          out.push({ ...f, dossier: d })
        }
      })
    })
    return out
  }, [dossiers, search])
  if (results.length === 0) return (
    <div className="sn-files-section sn-files-empty-search">
      <p className="sn-files-overline">NO MATCHING FILES</p>
      <p className="sn-files-muted-copy">We couldn't find a file matching '{search}'.</p>
    </div>
  )
  return (
    <div className="sn-files-section sn-files-search-results">
      <p className="sn-files-overline">SEARCH RESULTS — {results.length} file{results.length === 1 ? '' : 's'}</p>
      <div className="sn-files-ledger">
        <div className="sn-files-ledger-header sn-files-row">
          <div className="sn-files-row-main">
            <span className="sn-files-col-label">FILE</span>
            <span className="sn-files-col-label sn-files-col-task">TASK</span>
            <span className="sn-files-col-label sn-files-col-role">ROLE</span>
            <span className="sn-files-col-label sn-files-col-date">DATE</span>
          </div>
          <div className="sn-files-row-actions"><span className="sn-files-col-label">ACTION</span></div>
        </div>
        {results.map((r) => (
          <div key={r.id} className="sn-files-row sn-files-search-row" onClick={() => onSelectTask(r.dossier.taskId)}>
            <div className="sn-files-row-main">
              <DossierIcon filename={r.name} size={16} />
              <span className="sn-files-row-name" title={r.name}>{r.name}</span>
              <span className="sn-files-row-task">{r.dossier.task.title}</span>
              <span className="sn-files-row-role">{r.role || ''}</span>
              <span className="sn-files-row-date">{formatDate(r.uploadedAt, { year: undefined })}</span>
            </div>
            <div className="sn-files-row-actions">
              <button className="sn-files-action-link" onClick={(e) => { e.stopPropagation(); onPreview(r) }}><Eye size={13} /> Preview</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── EMPTY & SKELETON STATES ───────────────────────────────────────────── */

function DossierSkeletons() {
  return (
    <div className="sn-files-skeleton-container">
      <div className="sn-files-navigator">
        <div className="sn-files-nav-header"><div className="sn-files-skeleton-line sn-files-skeleton-line--medium" /></div>
        {[1, 2, 3].map((i) => <div key={i} className="sn-files-nav-skeleton"><div className="sn-files-skeleton-line" style={{ width: `${60 + i * 10}%` }} /><div className="sn-files-skeleton-line sn-files-skeleton-line--short" /></div>)}
      </div>
      <div className="sn-files-workspace">
        <div className="sn-files-skeleton-line sn-files-skeleton-line--large" />
        <div className="sn-files-skeleton-line sn-files-skeleton-line--medium" />
        {[1, 2, 3, 4].map((i) => <div key={i} className="sn-files-skeleton-row"><div className="sn-files-skeleton-line" style={{ width: `${40 + i * 10}%` }} /><div className="sn-files-skeleton-line sn-files-skeleton-line--short" /></div>)}
      </div>
    </div>
  )
}

function FilesError({ onRetry, access }) {
  return (
    <section className="sn-files-error" role="alert">
      <p className="sn-files-overline">{access ? 'ACCESS REQUIRED' : 'COULD NOT LOAD'}</p>
      <h2>{access ? 'Sign in to view your files.' : 'We couldn\'t load your task files.'}</h2>
      <button className="sn-files-btn sn-files-btn--primary" onClick={() => access ? go('/login') : onRetry()}>{access ? 'Sign in' : 'Try Again →'}</button>
    </section>
  )
}

function ZeroTasksState({ onNewTask }) {
  return (
    <section className="sn-files-empty-state">
      <FolderOpen size={48} strokeWidth={1} />
      <p className="sn-files-overline">FILES & DELIVERIES</p>
      <h2>No task files yet.</h2>
      <p>Files will appear here once you create your first SolveNest task.</p>
      <button className="sn-files-btn sn-files-btn--primary" onClick={onNewTask}>Create Your First Task →</button>
    </section>
  )
}

function RemoveConfirm({ file, onConfirm, onCancel }) {
  return (
    <motion.div className="sn-files-confirm-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div className="sn-files-confirm-dialog" initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}>
        <p className="sn-files-overline">REMOVE FILE?</p>
        <p><strong>{file.name}</strong> will be removed from this task.</p>
        <div className="sn-files-confirm-actions">
          <button className="sn-files-btn sn-files-btn--ghost" onClick={onCancel}>Keep File</button>
          <button className="sn-files-btn sn-files-btn--danger" onClick={onConfirm}>Remove File</button>
        </div>
      </motion.div>
    </motion.div>
  )
}

/* ── MAIN PAGE COMPOSITION ─────────────────────────────────────────────── */

export function StudentFilesPage() {
  const isMobile = useMediaQuery('(max-width:768px)')
  const isTablet = useMediaQuery('(min-width:769px) and (max-width:1180px)')
  const urlState = parseDossierUrlState()

  const [dossiers, setDossiers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [view, setView] = useState(urlState.view || 'all')
  const [search, setSearch] = useState(urlState.search || '')
  const [sort, setSort] = useState('recently-updated')
  const [filters, setFilters] = useState({})
  const [selectedTaskId, setSelectedTaskId] = useState(urlState.taskId)
  const [activeSection, setActiveSection] = useState(urlState.section || null)
  const [inspectorFile, setInspectorFile] = useState(null)
  const [removeFile, setRemoveFile] = useState(null)
  const [mobileBackToList, setMobileBackToList] = useState(false)
  const [detail, setDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [meta, setMeta] = useState(null)

  const load = useCallback(() => {
    const controller = new AbortController()
    setLoading(true)
    setError(null)
    fetchTaskDossiers({ view, search, filters, sort, signal: controller.signal })
      .then(({ dossiers: d, meta: m }) => { setDossiers(d); setMeta(m); setLoading(false) })
      .catch((err) => { if (err.name !== 'AbortError') { setError(err); setLoading(false) } })
    return () => controller.abort()
  }, [view, search, filters, sort])

  useEffect(() => load(), [load])

  useEffect(() => {
    if (!selectedTaskId) { setDetail(null); return }
    const controller = new AbortController()
    setDetailLoading(true)
    fetchTaskDossierDetail(selectedTaskId, { signal: controller.signal })
      .then((d) => { setDetail(d); setDetailLoading(false) })
      .catch((err) => { if (err.name !== 'AbortError') { setDetail(null); setDetailLoading(false) } })
    return () => controller.abort()
  }, [selectedTaskId])

  useEffect(() => { syncDossierUrlState({ taskId: selectedTaskId, section: activeSection, view, search }) }, [selectedTaskId, activeSection, view, search])

  const selectedDossier = detail || dossiers.find((d) => d.taskId === selectedTaskId) || null
  const sections = selectedDossier ? resolveDossierSections(selectedDossier) : []
  const currentDelivery = selectedDossier ? resolveDeliveryPackage(selectedDossier, null) : null
  const newDeliveryCount = dossiers.filter((d) => d.hasNewDelivery).length

  const activeFilterCount = Object.values(filters).filter(Boolean).length

  const handleSelectTask = useCallback((taskId) => {
    setSelectedTaskId(taskId)
    setActiveSection(null)
    if (isMobile) setMobileBackToList(true)
  }, [isMobile])

  const handlePreview = useCallback((file) => {
    setInspectorFile(file)
  }, [])

  const handleDownload = useCallback(async (file) => {
    try {
      const url = await requestFileAccess(file.id)
      const a = document.createElement('a')
      a.href = url
      a.download = file.name
      a.click()
    } catch { /* toast would be shown */ }
  }, [])

  const handleRemove = useCallback(async () => {
    if (!removeFile) return
    try {
      await removeTaskFile(removeFile.id)
      setRemoveFile(null)
      if (selectedTaskId) {
        const d = await fetchTaskDossierDetail(selectedTaskId)
        setDetail(d)
      }
      load()
    } catch { /* toast would be shown */ }
  }, [removeFile, selectedTaskId, load])

  const handleRevision = useCallback(async (taskId) => {
    try {
      await requestRevision(taskId)
      const d = await fetchTaskDossierDetail(taskId)
      setDetail(d)
    } catch { /* toast */ }
  }, [])

  const handleUpload = useCallback(async () => {
    if (selectedTaskId) {
      const d = await fetchTaskDossierDetail(selectedTaskId)
      setDetail(d)
    }
    load()
  }, [selectedTaskId, load])

  const handleNewTask = useCallback(() => { go('/student/dashboard') }, [])

  const handleConversation = useCallback((convId) => { go('/student/messages') }, [])

  const handleFocusDelivery = useCallback(() => {
    const deliveryTask = dossiers.find((d) => d.hasNewDelivery)
    if (deliveryTask) { handleSelectTask(deliveryTask.taskId); setActiveSection('delivery') }
  }, [dossiers, handleSelectTask])

  /* ── Loading state */
  if (loading && dossiers.length === 0) return <div className="sn-files-page"><FilesHeader dossierCount={0} newDeliveries={0} /><DossierSkeletons /></div>
  if (error) return <div className="sn-files-page"><FilesHeader dossierCount={0} newDeliveries={0} /><FilesError onRetry={load} access={error.message === 'STUDENT_ACCESS_REQUIRED'} /></div>
  if (!loading && dossiers.length === 0) return <div className="sn-files-page"><FilesHeader dossierCount={0} newDeliveries={0} /><ZeroTasksState onNewTask={handleNewTask} /></div>

  /* ── Mobile: list or detail */
  if (isMobile) {
    if (selectedDossier && mobileBackToList) {
      return (
        <div className="sn-files-page sn-files-mobile">
          <div className="sn-files-mobile-detail-header">
            <button className="sn-files-back-btn" onClick={() => { setSelectedTaskId(null); setMobileBackToList(false); setDetail(null) }}><ArrowLeft size={18} /> Files & Deliveries</button>
          </div>
          <div className="sn-files-mobile-detail">
            <DossierWorkspace dossier={selectedDossier} detail={detailLoading ? null : detail} sections={sections} activeSection={activeSection} onSectionChange={setActiveSection} onPreview={handlePreview} onDownload={handleDownload} onReplace={() => {}} onRemove={setRemoveFile} onConversation={handleConversation} onRevision={handleRevision} onUpload={handleUpload} taskId={selectedTaskId} />
          </div>
          <AnimatePresence>{inspectorFile && <FileInspector file={inspectorFile} onClose={() => setInspectorFile(null)} onDownload={handleDownload} />}</AnimatePresence>
          <AnimatePresence>{removeFile && <RemoveConfirm file={removeFile} onConfirm={handleRemove} onCancel={() => setRemoveFile(null)} />}</AnimatePresence>
        </div>
      )
    }
    return (
      <div className="sn-files-page sn-files-mobile">
        <FilesHeader dossierCount={dossiers.length} newDeliveries={newDeliveryCount} onFocusDelivery={handleFocusDelivery} />
        <DossierCommandBar view={view} onViewChange={setView} search={search} onSearchChange={setSearch} sort={sort} onSortChange={setSort} filters={filters} onFiltersChange={setFilters} activeFilterCount={activeFilterCount} />
        {search ? <SearchResultLedger dossiers={dossiers} search={search} onSelectTask={(id) => { setSearch(''); handleSelectTask(id) }} onPreview={handlePreview} /> : (
          <div className="sn-files-mobile-list">
            {sortDossiers(filterDossiers(dossiers, { search, view }), sort).map((d) => (
              <button key={d.taskId} className="sn-files-mobile-task-row" onClick={() => handleSelectTask(d.taskId)}>
                <div className="sn-files-mobile-task-title">{d.task.title}</div>
                <div className="sn-files-mobile-task-meta">{d.display.label} · {d.fileCount} file{d.fileCount === 1 ? '' : 's'}</div>
                {d.hasNewDelivery && <span className="sn-files-new-badge">NEW DELIVERY</span>}
              </button>
            ))}
          </div>
        )}
        <AnimatePresence>{inspectorFile && <FileInspector file={inspectorFile} onClose={() => setInspectorFile(null)} onDownload={handleDownload} />}</AnimatePresence>
        <AnimatePresence>{removeFile && <RemoveConfirm file={removeFile} onConfirm={handleRemove} onCancel={() => setRemoveFile(null)} />}</AnimatePresence>
      </div>
    )
  }

  /* ── Desktop / Tablet */
  return (
    <div className="sn-files-page">
      <FilesHeader dossierCount={dossiers.length} newDeliveries={newDeliveryCount} onFocusDelivery={handleFocusDelivery} />
      <DossierCommandBar view={view} onViewChange={setView} search={search} onSearchChange={setSearch} sort={sort} onSortChange={setSort} filters={filters} onFiltersChange={setFilters} activeFilterCount={activeFilterCount} />
      <div className="sn-files-body">
        <TaskDossierNavigator dossiers={sortDossiers(filterDossiers(dossiers, { search, view }), sort)} selectedId={selectedTaskId} onSelect={handleSelectTask} loading={false} />
        <div className="sn-files-workspace">
          {search ? <SearchResultLedger dossiers={dossiers} search={search} onSelectTask={(id) => { setSearch(''); handleSelectTask(id) }} onPreview={handlePreview} /> : selectedDossier ? (
            <DossierWorkspace dossier={selectedDossier} detail={detailLoading ? null : detail} sections={sections} activeSection={activeSection} onSectionChange={setActiveSection} onPreview={handlePreview} onDownload={handleDownload} onReplace={() => {}} onRemove={setRemoveFile} onConversation={handleConversation} onRevision={handleRevision} onUpload={handleUpload} taskId={selectedTaskId} />
          ) : (
            <div className="sn-files-placeholder"><FolderOpen size={40} strokeWidth={1} /><p>Select a task to view its dossier.</p></div>
          )}
        </div>
      </div>
      <AnimatePresence>{inspectorFile && <FileInspector file={inspectorFile} onClose={() => setInspectorFile(null)} onDownload={handleDownload} />}</AnimatePresence>
      <AnimatePresence>{removeFile && <RemoveConfirm file={removeFile} onConfirm={handleRemove} onCancel={() => setRemoveFile(null)} />}</AnimatePresence>
    </div>
  )
}

/* ── DOSSIER WORKSPACE COMPOSER ────────────────────────────────────────── */

function DossierWorkspace({ dossier, detail, sections, activeSection, onSectionChange, onPreview, onDownload, onReplace, onRemove, onConversation, onRevision, onUpload, taskId }) {
  const source = detail?.sourceFiles || dossier.sourceFiles
  const exchanges = detail?.exchangeFiles || dossier.exchangeFiles
  const versions = detail?.deliveryVersions || dossier.deliveryVersions
  const currentVersion = versions.length > 0 ? versions[versions.length - 1] : null
  return (
    <div className="sn-files-dossier">
      <div className="sn-files-dossier-header">
        <div className="sn-files-dossier-identity">
          <h2 className="sn-files-dossier-title">{dossier.task.title}</h2>
          <div className="sn-files-dossier-meta">
            {dossier.task.reference && <span className="sn-files-dossier-ref">{dossier.task.reference}</span>}
            <span className={`sn-files-status-dot tone-${dossier.display.tone}`} />
            <span>{dossier.display.label}</span>
          </div>
        </div>
        <button className="sn-files-task-link" onClick={() => go('/student/tasks')}>Open Task Room →</button>
      </div>
      {sections.length > 0 && (
        <div className="sn-files-section-nav" role="tablist" aria-label="Dossier sections">
          {sections.map((s) => (
            <button key={s.key} role="tab" aria-selected={activeSection === s.key} className={`sn-files-section-tab ${activeSection === s.key ? 'is-active' : ''}`} onClick={() => onSectionChange(s.key)}>
              {s.label}{s.count > 0 && <span className="sn-files-section-count">{s.count}</span>}
            </button>
          ))}
        </div>
      )}
      <div className="sn-files-dossier-content">
        {(!activeSection || activeSection === 'source') && <FileLedger files={source} section="source" onPreview={onPreview} onDownload={onDownload} onReplace={onReplace} onRemove={onRemove} onConversation={onConversation} emptyLabel="No student-visible source files." />}
        {(!activeSection || activeSection === 'exchanges') && exchanges.length > 0 && <FileLedger files={exchanges} section="exchanges" onPreview={onPreview} onDownload={onDownload} onReplace={onReplace} onRemove={onRemove} onConversation={onConversation} emptyLabel="No files shared during collaboration." />}
        {(!activeSection || activeSection === 'delivery') && <DeliveryPackage dossier={{ ...dossier, deliveryVersions: versions }} version={null} onPreview={onPreview} onDownload={onDownload} onRevision={onRevision} />}
      </div>
    </div>
  )
}
