import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'

const particles = Array.from({ length: 12 }, (_, index) => ({ id: index, left: `${8 + ((index * 37) % 84)}%`, top: `${12 + ((index * 61) % 76)}%`, delay: `${(index % 5) * 1.2}s`, size: index % 3 === 0 ? 3 : 2 }))

export function AcademicAurora() {
  const [pointer, setPointer] = useState({ x: 50, y: 50 })
  useEffect(() => { const update = (event) => setPointer({ x: (event.clientX / window.innerWidth) * 100, y: (event.clientY / window.innerHeight) * 100 }); window.addEventListener('pointermove', update, { passive: true }); return () => window.removeEventListener('pointermove', update) }, [])
  return <div className="academic-aurora" aria-hidden="true" style={{ '--pointer-x': `${pointer.x}%`, '--pointer-y': `${pointer.y}%` }}><div className="aurora-noise" /><div className="aurora-grid" /><div className="aurora-beam beam-violet" /><div className="aurora-beam beam-cyan" /><svg className="aurora-diagram" viewBox="0 0 600 360"><path d="M20 280 C120 40 220 340 320 100 S470 50 580 250" /><path d="M90 35 L180 315 M430 40 L530 310" /><circle cx="320" cy="100" r="7" /><circle cx="180" cy="315" r="4" /><circle cx="430" cy="40" r="5" /></svg>{particles.map((particle) => <i key={particle.id} className="aurora-particle" style={{ left: particle.left, top: particle.top, width: particle.size, height: particle.size, animationDelay: particle.delay }} />)}</div>
}

export function MagneticButton({ children, className = '', onClick }) {
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  return <motion.button className={className} animate={{ x: offset.x, y: offset.y }} transition={{ type: 'spring', stiffness: 380, damping: 22 }} onMouseMove={(event) => { const rect = event.currentTarget.getBoundingClientRect(); setOffset({ x: Math.max(-5, Math.min(5, (event.clientX - (rect.left + rect.width / 2)) / 8)), y: Math.max(-5, Math.min(5, (event.clientY - (rect.top + rect.height / 2)) / 8)) }) }} onMouseLeave={() => setOffset({ x: 0, y: 0 })} onClick={onClick}>{children}</motion.button>
}
