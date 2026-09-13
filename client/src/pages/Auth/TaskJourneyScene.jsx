import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

/* THE SOLVENEST 3D TASK JOURNEY (sign-in left visual).
   ONE assignment document travels a horizontal track through five states:
   UNDERSTAND → CONFIRM → PROGRESS → VERIFY → LEARN. Same object throughout,
   all procedural planes/boxes, app-token palette. */

export const STAGE_X = [-2.55, -1.3, 0, 1.3, 2.55]
export const STAGES = [
  { n: '01', t: 'Understand', d: 'Solvy structures the brief.' },
  { n: '02', t: 'Confirm', d: 'Humans confirm the important decisions.' },
  { n: '03', t: 'Progress', d: 'Track your task in one workspace.' },
  { n: '04', t: 'Verify', d: 'Quality review before delivery.' },
  { n: '05', t: 'Learn', d: 'Explain & Defend after delivery.' },
]
const curveZ = (x) => 0.34 * Math.sin(x * 0.55)

function tex(w, h, draw) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  draw(c.getContext('2d'), w, h)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  return t
}
const mono = (s, px, color, w = '600') => `${w} ${px}px 'DM Mono', monospace`

export function TaskJourneyScene({ s, pointer, nudge, reduced, mini, journey, onJourney, onHoverStage, autoRef }) {
  const root = useRef(null)
  const doc = useRef(null)
  const cover = useRef(null)
  const railDot = useRef(null)
  const qa = useRef([])
  const stamp = useRef(null)
  const structures = useRef(null)
  const posRef = useRef(journey)
  const drag = useRef(null)
  const grant = useRef(0)
  const failT = useRef(0)
  const gl = useThree((st) => st.gl)

  const T = useMemo(() => ({
    doc: tex(512, 680, (g) => {
      g.fillStyle = '#f6f5ef'; g.fillRect(0, 0, 512, 680)
      g.strokeStyle = 'rgba(17,24,39,.22)'; g.lineWidth = 5; g.strokeRect(4, 4, 504, 672)
      g.fillStyle = '#7c5cff'; g.font = mono('', 24, '', '600').replace(/^.*?(\d+px).*$/, "600 24px 'DM Mono', monospace")
      g.fillText('ASSESSMENT 02', 44, 66)
      g.fillStyle = '#111827'; g.font = '600 56px Georgia, serif'
      g.fillText('Research', 44, 142); g.fillText('Report', 44, 204)
      g.fillStyle = '#1F6F8B'; g.font = '400 27px Georgia, serif'
      g.fillText('Information Systems', 44, 250)
      g.fillStyle = '#64748b'; g.font = '400 25px Georgia, serif'
      g.fillText('2,500 words', 44, 302); g.fillText('APA 7', 44, 342)
      g.fillText('Rubric', 44, 382); g.fillText('Due 28 September', 44, 422)
      g.strokeStyle = 'rgba(17,24,39,.12)'; g.lineWidth = 2
      for (let i = 0; i < 3; i++) { const y = 470 + i * 28; g.beginPath(); g.moveTo(44, y); g.lineTo(i % 2 ? 300 : 468, y); g.stroke() }
      g.fillStyle = '#22c58b'; g.font = "600 22px 'DM Mono', monospace"
      g.fillText('STRUCTURED ✓', 44, 640)
    }),
    rail: tex(512, 112, (g) => {
      g.clearRect(0, 0, 512, 112)
      g.font = "600 25px 'DM Mono', monospace"; g.textAlign = 'center'
      const rows = [['PAID', 1], ['EXPERT', 1], ['ACTIVE', 1], ['QUALITY', 0], ['SENT', 0]]
      rows.forEach(([t, on], i) => {
        const x = 52 + i * 102
        g.fillStyle = on ? '#7ce0d8' : '#3a4560'
        g.beginPath(); g.arc(x, 26, 9, 0, Math.PI * 2); g.fill()
        g.fillStyle = on ? '#ffffff' : '#5b6a85'
        g.fillText(t, x, 76)
      })
    }),
    qa: ['REQUIREMENTS  10 / 10', 'CITATION  REVIEWED', 'QUALITY  APPROVED'].map((t) => tex(512, 128, (g, w, h) => {
      g.fillStyle = 'rgba(246,245,239,.92)'; g.fillRect(0, 0, w, h)
      g.strokeStyle = 'rgba(124,92,255,.5)'; g.lineWidth = 3; g.strokeRect(4, 4, w - 8, h - 8)
      g.fillStyle = '#111827'; g.font = "600 34px 'DM Mono', monospace"; g.textAlign = 'center'
      g.fillText(t, w / 2, 80)
    })),
    learn: ['EXPLAIN|WHY THIS APPROACH?', 'QUIZ|EXPLAIN SIMPLY', 'DEFEND|LECTURER QUESTIONS?'].map((t) => {
      const [a, b] = t.split('|')
      return tex(512, 160, (g) => {
        g.clearRect(0, 0, 512, 160)
        g.fillStyle = '#7c5cff'; g.font = "600 30px 'DM Mono', monospace"; g.fillText(a, 12, 52)
        g.fillStyle = '#3a4560'; g.font = "400 26px 'DM Sans', sans-serif"; g.fillText(b, 12, 108)
      })
    }),
    est: tex(512, 200, (g) => {
      g.fillStyle = '#11182b'; g.fillRect(0, 0, 512, 200)
      g.fillStyle = '#8EA0B5'; g.font = "600 26px 'DM Mono', monospace"; g.fillText('ESTIMATE', 30, 60)
      g.fillStyle = '#ffffff'; g.font = "600 44px 'DM Mono', monospace"; g.fillText('LKR 8,000–10,000', 30, 130)
    }),
    off: tex(512, 200, (g) => {
      g.fillStyle = '#f6f5ef'; g.fillRect(0, 0, 512, 200)
      g.strokeStyle = '#7c5cff'; g.lineWidth = 4; g.strokeRect(6, 6, 500, 188)
      g.fillStyle = '#7c5cff'; g.font = "600 26px 'DM Mono', monospace"; g.fillText('OFFICIAL PLAN', 30, 60)
      g.fillStyle = '#111827'; g.font = "600 44px 'DM Mono', monospace"; g.fillText('LKR 8,750', 30, 130)
    }),
    sub: tex(512, 120, (g) => {
      g.clearRect(0, 0, 512, 120)
      g.fillStyle = '#3a4560'; g.font = "400 26px 'DM Sans', sans-serif"
      g.fillText('Suggested deadline  →  Confirmed delivery', 12, 48)
      g.fillText('Suggested scope  →  Confirmed scope', 12, 94)
    }),
    stamp: tex(256, 160, (g) => {
      g.clearRect(0, 0, 256, 160)
      g.strokeStyle = '#5aa898'; g.lineWidth = 6; g.strokeRect(8, 8, 240, 144)
      g.fillStyle = '#5aa898'; g.font = "600 36px 'DM Mono', monospace"; g.textAlign = 'center'
      g.fillText('QUALITY ✓', 128, 92)
    }),
    room: tex(1024, 620, (g, w, h) => {
      g.fillStyle = '#11182b'; g.fillRect(0, 0, w, h)
      g.fillStyle = '#8f7bff'; g.font = "600 28px 'DM Mono', monospace"; g.fillText('TASK ROOM', 48, 70)
      const rows = [['Research Report', 'IN PROGRESS'], ['Citation check', 'REVIEWED'], ['Evidence review', 'QUEUED']]
      rows.forEach(([t, st], i) => {
        const y = 150 + i * 130
        g.fillStyle = 'rgba(255,255,255,.05)'; g.fillRect(48, y, w - 96, 104)
        g.fillStyle = '#EAF0F7'; g.font = "400 30px 'DM Sans', sans-serif"; g.fillText(t, 80, y + 62)
        g.fillStyle = '#7ce0d8'; g.font = "600 24px 'DM Mono', monospace"; g.fillText(st, w - 300, y + 62)
      })
    }),
    floor: tex(1024, 512, (g, w, h) => {
      g.clearRect(0, 0, w, h)
      g.strokeStyle = 'rgba(53,214,232,.19)'; g.lineWidth = 1
      for (let x = 0; x <= w; x += 64) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke() }
      for (let y = 0; y <= h; y += 64) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke() }
      g.fillStyle = 'rgba(150,170,210,.42)'; g.font = "400 22px 'DM Mono', monospace"
      g.fillText('A-01', 36, 80); g.fillText('A-02', 36, 300); g.fillText('IDX-07', w - 150, 200)
    }),
    glow: tex(256, 256, (g, w, h) => {
      const r = g.createRadialGradient(w / 2, h / 2, 8, w / 2, h / 2, w / 2)
      r.addColorStop(0, 'rgba(124,92,255,.20)')
      r.addColorStop(1, 'rgba(124,92,255,0)')
      g.fillStyle = r; g.fillRect(0, 0, w, h)
    }),
  }), [])

  // wheel = step stages without trapping scroll at the ends
  useMemo(() => {
    const el = gl.domElement
    const onWheel = (e) => {
      if (e.deltaY > 0 && journey < 4) { e.preventDefault(); onJourney(journey + 1) }
      else if (e.deltaY < 0 && journey > 0) { e.preventDefault(); onJourney(journey - 1) }
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [gl, journey, onJourney])

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime
    const rate = reduced ? 999 : 5
    const D = (cur, target, r) => THREE.MathUtils.damp(cur, target, r || rate, dt)
    if (!drag.current) posRef.current = D(posRef.current, journey, 6)
    const pos = posRef.current
    const j = Math.round(pos)
    const gTarget = s.status === 'granted' ? 1 : 0
    grant.current = THREE.MathUtils.clamp(grant.current + Math.sign(gTarget - grant.current) * dt / (reduced ? 0.01 : 0.9), 0, 1)
    const g = grant.current
    if (s.status === 'failed') failT.current = 1.2
    else failT.current = Math.max(0, failT.current - dt)
    const px = reduced || mini ? 0 : pointer.current.x
    const py = reduced || mini ? 0 : pointer.current.y

    if (root.current) {
      root.current.rotation.y = D(root.current.rotation.y, -0.06 + px * 0.035, 4)
      root.current.rotation.x = D(root.current.rotation.x, py * 0.022, 4)
      root.current.position.y = reduced ? 0 : Math.sin((t * Math.PI * 2) / 8) * 0.025
    }
    // document follows journey
    if (doc.current) {
      const x = mini ? 0 : posToX(pos)
      const z = mini ? 0.1 : curveZ(x)
      doc.current.position.x = D(doc.current.position.x, x + px * 0.045, 6)
      doc.current.position.y = D(doc.current.position.y, -0.1 + (reduced ? 0 : Math.sin(t * 0.9) * 0.012) + g * 0.2, 6)
      doc.current.position.z = D(doc.current.position.z, z + g * 1.1, 6)
      const face = s.status === 'granted' ? 0.1 : 0
      doc.current.rotation.y = D(doc.current.rotation.y, face, 5)
      const sc = 1 + g * 0.06
      doc.current.scale.setScalar(D(doc.current.scale.x, sc, 5))
    }
    // structures fade with proximity to their stage (+ granted collapse)
    const near = (sj, w) => Math.max(0, 1 - Math.abs(pos - sj) / w) * (1 - g) + (s.status === 'granted' && sj === 2 ? 1 : 0) * 0
    setGroup(structAnn.current, near(0, 1.1))
    setGroup(structFrame.current, near(1, 1.1))
    setGroup(structRail.current, Math.max(near(2, 1.4), g * 0 + (j === 2 || pos > 1.4 ? 0.9 : 0.12)))
    setGroup(structQa.current, near(3, 1.2))
    setGroup(structLearn.current, near(4, 1.2))
    if (preview.current) {
      preview.current.material.opacity = D(preview.current.material.opacity, g, 5)
      const ps = 0.6 + 0.4 * g
      preview.current.scale.set(ps, ps, 1)
    }
    if (uiGlow.current) uiGlow.current.material.opacity = D(uiGlow.current.material.opacity, g * 0.9, 5)
    nudge.current.x = D(nudge.current.x, 0, 3)
    nudge.current.y = D(nudge.current.y, 0, 3)
  })

  function setGroup(ref, v) {
    const o = ref.current
    if (!o) return
    o.visible = v > 0.02
    o.traverse((m) => {
      if (m.isMesh && m.material && m.material.transparent) m.material.opacity = v * (m.userData.baseOp ?? 1)
    })
  }

  const structAnn = useRef(null)
  const structFrame = useRef(null)
  const structRail = useRef(null)
  const structQa = useRef(null)
  const structLearn = useRef(null)
  const preview = useRef(null)
  const uiGlow = useRef(null)
  const hitBoxes = useRef([])

  const stageAt = (i) => ({ onPointerOver: (e) => { e.stopPropagation(); onHoverStage(i) }, onPointerOut: () => onHoverStage(null) })

  return (
    <group ref={root}>
      {/* backdrop: grid + glow */}
      <mesh position={[0, -0.6, -2.2]}>
        <planeGeometry args={[22, 10]} />
        <meshBasicMaterial map={T.floor} transparent opacity={0.9} depthWrite={false} />
      </mesh>
      <mesh position={[0, 0.4, -2.4]}>
        <planeGeometry args={[9, 5]} />
        <meshBasicMaterial map={T.glow} transparent opacity={0.8} depthWrite={false} />
      </mesh>
      {/* track */}
      {!mini && (
        <group position={[0, -0.95, 0]}>
          <mesh><boxGeometry args={[6.2, 0.1, 0.9]} /><meshStandardMaterial color="#11182b" roughness={0.55} metalness={0.2} /></mesh>
          <mesh position={[0, 0.056, 0]}><boxGeometry args={[6.2, 0.012, 0.06]} /><meshBasicMaterial color="#3a4560" /></mesh>
          {STAGE_X.map((x, i) => (
            <mesh key={i} position={[x, 0.06, 0.2]}>
              <boxGeometry args={[0.05, 0.05, 0.05]} />
              <meshStandardMaterial color="#2a3350" emissive={journey === i ? '#7c5cff' : '#3a4560'} emissiveIntensity={journey === i ? 1.1 : 0.65} />
            </mesh>
          ))}
        </group>
      )}
      {/* document */}
      <group ref={doc} position={[-2.55, -0.1, 0]}>
        <mesh
          onPointerDown={(e) => { e.stopPropagation(); drag.current = { x: e.clientX, p: posRef.current } }}
          onPointerMove={(e) => { if (drag.current) { posRef.current = THREE.MathUtils.clamp(drag.current.p + (e.clientX - drag.current.x) * 0.008, 0, 4); onJourney(Math.round(posRef.current), true) } }}
          onPointerUp={() => { drag.current = null }}
        >
          <boxGeometry args={[1.15, 1.5, 0.05]} />
          <meshStandardMaterial color="#f6f5ef" roughness={0.7} />
        </mesh>
        <mesh position={[0, 0, 0.032]}><planeGeometry args={[1.04, 1.38]} /><meshBasicMaterial map={T.doc} toneMapped={false} /></mesh>
        {/* progress rail on doc */}
        <group ref={structRail} position={[0, -0.62, 0.02]}>
          <mesh><planeGeometry args={[1.0, 0.2]} /><meshBasicMaterial map={T.rail} transparent opacity={0.12} depthWrite={false} /></mesh>
          <mesh position={[-0.32, 0, 0.012]}><sphereGeometry args={[0.03, 10, 10]} />
            <meshBasicMaterial color="#22c58b" toneMapped={false} /></mesh>
        </group>
        {/* QA stamp (from collapsed layers) */}
        <mesh ref={stamp} position={[0.32, -0.52, 0.045]} visible={false}>
          <planeGeometry args={[0.44, 0.28]} />
          <meshBasicMaterial map={T.stamp} transparent opacity={0} depthWrite={false} toneMapped={false} />
        </mesh>
        {/* learn cover */}
        <mesh ref={cover} position={[0, 0, 0.045]} visible={false}>
          <planeGeometry args={[1.04, 1.38]} />
          <meshBasicMaterial color="#f6f5ef" transparent opacity={0} depthWrite={false} />
        </mesh>
      </group>
      {/* stage 1 annotations */}
      <group ref={structAnn}>
        {[
          ['TASK TYPE', -1.15, 0.9], ['2,500 WORDS', -1.15, 0.35], ['APA 7', 0.95, 1.05],
          ['6 RUBRIC CRITERIA', 0.95, 0.5], ['DEADLINE', 0.95, -0.05],
        ].map(([label, x, y]) => (
          <group key={label} position={[mini ? x * 0.35 : x - 2.55, y, curveZ(mini ? 0 : -2.55)]}>
            <mesh><planeGeometry args={[0.9, 0.2]} /><meshBasicMaterial map={annTex(label)} transparent opacity={0.95} depthWrite={false} toneMapped={false} /></mesh>
            <mesh position={[(x < 0 ? 0.62 : -0.62) * (mini ? 0.35 : 1), 0, -0.01]}><boxGeometry args={[0.34, 0.012, 0.01]} />
              <meshBasicMaterial color="#8f7bff" transparent opacity={0.5} depthWrite={false} /></mesh>
          </group>
        ))}
      </group>
      {/* stage 2 frame + prices */}
      <group ref={structFrame}>
        {mini ? null : (
          <>
            <mesh position={[-1.3, 0.35, 0]}>
              <boxGeometry args={[0.05, 1.9, 0.05]} /><meshBasicMaterial color="#f6f5ef" transparent opacity={0.85} />
            </mesh>
            <mesh position={[-1.3, 0.35, 0]}>
              <boxGeometry args={[1.5, 0.05, 0.05]} /><meshBasicMaterial color="#f6f5ef" transparent opacity={0.0} depthWrite={false} />
            </mesh>
          </>
        )}
        <mesh position={[(mini ? 0 : -1.3) + 0, 0.35, -0.12]}>
          <boxGeometry args={[1.5, 1.9, 0.04]} />
          <meshBasicMaterial color="#f6f5ef" transparent opacity={0.16} depthWrite={false} />
        </mesh>
        <mesh position={[mini ? -1.15 : -2.35, -0.35, 0.1]}>
          <planeGeometry args={[1.05, 0.42]} /><meshBasicMaterial map={T.est} toneMapped={false} />
        </mesh>
        <mesh position={[mini ? 1.15 : -0.25, -0.35, 0.1]}>
          <planeGeometry args={[1.05, 0.42]} /><meshBasicMaterial map={T.off} toneMapped={false} />
        </mesh>
        <mesh position={[mini ? 0 : -1.3, -0.95, 0.1]}>
          <planeGeometry args={[1.7, 0.4]} /><meshBasicMaterial map={T.sub} transparent opacity={0.9} depthWrite={false} toneMapped={false} />
        </mesh>
      </group>
      {/* stage 4 QA sweepers */}
      <group ref={structQa}>
        {[0, 1, 2].map((i) => (
          <mesh key={i} position={[(mini ? 0 : 1.3) - 1.2 + ((i * 613) % 100) / 100 * 0, -0.1 + i * 0.62, 0.3]}>
            <planeGeometry args={[1.15, 0.42]} />
            <meshBasicMaterial map={T.qa[i]} transparent opacity={0.95} depthWrite={false} toneMapped={false} />
          </mesh>
        ))}
      </group>
      {/* stage 5 learn labels */}
      <group ref={structLearn}>
        {[['EXPLAIN', 0.75], ['QUIZ', 0.1], ['DEFEND', -0.55]].map(([label, y], i) => (
          <group key={label} position={[mini ? 0.85 : 2.55 + 0.75, y, 0.3]}>
            <mesh><planeGeometry args={[1.0, 0.32]} /><meshBasicMaterial map={T.learn[i]} transparent opacity={0.95} depthWrite={false} toneMapped={false} /></mesh>
            <mesh position={[-0.62, 0, -0.01]}><boxGeometry args={[0.24, 0.012, 0.01]} />
              <meshBasicMaterial color="#8f7bff" transparent opacity={0.5} depthWrite={false} /></mesh>
          </group>
        ))}
      </group>
      {/* task room preview (success) */}
      <mesh ref={preview} position={[0, 0.15, 1.35]} visible={false}>
        <planeGeometry args={[3.4, 2.05]} />
        <meshBasicMaterial map={T.room} transparent opacity={0} depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh ref={uiGlow} position={[0, 0.15, 1.3]} visible={false}>
        <planeGeometry args={[4.2, 2.7]} />
        <meshBasicMaterial map={T.glow} transparent opacity={0} depthWrite={false} />
      </mesh>
      {/* invisible stage hit boxes */}
      {!mini && STAGE_X.map((x, i) => (
        <mesh key={i} position={[x, 0.3, 0.6]}
          onClick={(e) => { e.stopPropagation(); onJourney(i) }}
          onPointerOver={(e) => { e.stopPropagation(); onHoverStage(i) }}
          onPointerOut={() => onHoverStage(null)}>
          <boxGeometry args={[1.1, 2.6, 0.5]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      ))}
    </group>
  )
}

function posToX(p) {
  const i = Math.floor(THREE.MathUtils.clamp(p, 0, 3.999))
  const f = THREE.MathUtils.clamp(p, 0, 4) - i
  return STAGE_X[i] + (STAGE_X[Math.min(i + 1, 4)] - STAGE_X[i]) * f
}
function annTex(label) {
  return tex(512, 112, (g, w, h) => {
    g.clearRect(0, 0, w, h)
    g.fillStyle = '#EAF0F7'; g.font = "600 34px 'DM Mono', monospace"
    g.fillText(label, 12, 70)
  })
}
