import { useRef } from 'react'
import { motion, useMotionValue, useScroll, useSpring, useTransform } from 'framer-motion'
import { ArrowRight, Check, LockKeyhole, ShieldCheck } from 'lucide-react'
import { MagneticButton } from './GlobalExperience.jsx'
import { routeTo } from '../../pages/Premium/PremiumPages.jsx'

const fragments = [
  { label: 'APA 7', type: 'citation', depth: 'far', x: '9%', y: '18%', rotate: -10 },
  { label: '2,500 words', type: 'length', depth: 'near', x: '18%', y: '63%', rotate: 7 },
  { label: '6 Criteria', type: 'rubric', depth: 'mid', x: '35%', y: '14%', rotate: 4 },
  { label: 'Deadline', type: 'deadline', depth: 'near', x: '76%', y: '19%', rotate: -6 },
  { label: 'Rubric', type: 'rubric', depth: 'mid', x: '84%', y: '63%', rotate: 8 },
  { label: 'References', type: 'citation', depth: 'far', x: '66%', y: '82%', rotate: -4 },
  { label: 'Research Report', type: 'document', depth: 'near', x: '6%', y: '42%', rotate: -5 },
  { label: 'Requirements', type: 'requirement', depth: 'mid', x: '77%', y: '42%', rotate: 5 },
  { label: '∑ x² + y²', type: 'equation', depth: 'far', x: '48%', y: '8%', rotate: -2 },
]
const depthMap = { far: 1, mid: 2, near: 3 }

function Fragment({ item, scrollProgress, pointerX, pointerY }) {
  const depth = depthMap[item.depth]
  const converge = useTransform(scrollProgress, [0, .25, .5, .75, 1], [0, depth * 4, depth * 15, depth * 28, depth * 48])
  const rotate = useTransform(scrollProgress, [0, .5, 1], [item.rotate, item.rotate + 35, item.rotate + 120])
  const opacity = useTransform(scrollProgress, [0, .72, 1], [item.depth === 'far' ? .64 : .9, .82, 0])
  const scale = useTransform(scrollProgress, [0, .7, 1], [1, .92, .18])
  const x = useTransform([pointerX, converge], ([mouse, pull]) => `${Number(mouse) * depth * 0.05 - pull}%`)
  const y = useTransform([pointerY, converge], ([mouse, pull]) => `${Number(mouse) * depth * 0.05 - pull}%`)
  return <motion.div className={`academic-fragment fragment-${item.type} depth-${item.depth}`} style={{ left: item.x, top: item.y, x, y, rotate, opacity, scale }}><span className="fragment-glyph" />{item.label}</motion.div>
}

function Core({ pointerX, pointerY, scrollProgress }) {
  const rotateX = useTransform(pointerY, [-50, 50], [7, -7])
  const rotateY = useTransform(pointerX, [-50, 50], [-9, 9])
  const brightness = useTransform(scrollProgress, [0, .7, 1], [1, 1.15, 1.4])
  return <motion.div className="hero-core-wrap" style={{ rotateX, rotateY, filter: useTransform(brightness, (value) => `brightness(${value})`) }}><div className="hero-core-orbit orbit-a" /><div className="hero-core-orbit orbit-b" /><div className="hero-core-orbit orbit-c" /><div className="hero-core"><span className="hero-core-inner" /><b>SN</b></div><i className="core-node node-1" /><i className="core-node node-2" /><i className="core-node node-3" /></motion.div>
}

export function HeroScene() {
  const ref = useRef(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] })
  const scrollProgress = useSpring(scrollYProgress, { stiffness: 75, damping: 22, mass: .4 })
  const pointerX = useMotionValue(0); const pointerY = useMotionValue(0)
  const titleY = useTransform(scrollProgress, [0, 1], [0, -90]); const sceneScale = useTransform(scrollProgress, [0, 1], [1, 1.06]); const coreY = useTransform(scrollProgress, [0, 1], [0, 35])
  return <section ref={ref} className="hero-scene" onPointerMove={(event) => { const rect = event.currentTarget.getBoundingClientRect(); pointerX.set((event.clientX - rect.left - rect.width / 2) / 10); pointerY.set((event.clientY - rect.top - rect.height / 2) / 10) }} onPointerLeave={() => { pointerX.set(0); pointerY.set(0) }}><div className="hero-blueprint" /><div className="hero-light-field" /><motion.div className="hero-copy-spatial" style={{ y: titleY }}><span className="p-eyebrow"><i /> AI intelligence. Human judgement. Academic clarity.</span><h1><span className="masked-line">Understand the task</span><span className="masked-line accent-line">before you commit.</span></h1><p>Upload your academic brief and let Solvy uncover the requirements, complexity and estimated support path before you create an account.</p><div className="p-actions"><MagneticButton className="p-cta" onClick={() => routeTo('/analyze')}>Analyze my task <ArrowRight size={17} /></MagneticButton><button className="p-secondary" onClick={() => routeTo('/method')}>See the SolveNest Method <ArrowRight size={16} /></button></div><div className="p-trust"><span><Check size={14} /> No account required to begin</span><span><LockKeyhole size={14} /> Private analysis</span><span><ShieldCheck size={14} /> Human-confirmed final quote</span></div></motion.div><motion.div className="hero-universe" style={{ scale: sceneScale, y: coreY }}>{fragments.map((item) => <Fragment key={`${item.label}-${item.x}`} item={item} scrollProgress={scrollProgress} pointerX={pointerX} pointerY={pointerY} />)}<Core pointerX={pointerX} pointerY={pointerY} scrollProgress={scrollProgress} /><div className="hero-scene-label"><span /> Solvy intelligence core <b>01 / 05</b></div></motion.div><div className="hero-scroll-cue"><span>Scroll to enter the system</span><i /></div></section>
}
