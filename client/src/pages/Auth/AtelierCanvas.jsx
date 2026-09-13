import { Component, useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { TaskJourneyScene } from './TaskJourneyScene.jsx'

/* The SolveNest Academic Access Atelier.
   mode 'signin': layered Academic Task Stack (brief / task room / quality /
   progress) that responds to form state and assembles into one workspace.
   mode 'signup': Academic Passport (cover / verification / workspace)
   that assembles as the student progresses. Paper/dossier materials only —
   no decorative sci-fi. All meaning is mirrored in DOM. */

const TILT = THREE.MathUtils.degToRad(2.5)

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
const blueprintTex = () => tex(1024, 640, (g, w, h) => {
  g.clearRect(0, 0, w, h)
  g.strokeStyle = 'rgba(124,92,255,.4)'
  g.lineWidth = 3
  const zones = [[60, 60, 430, 250], [534, 60, 430, 250], [60, 330, 430, 250], [534, 330, 430, 250]]
  zones.forEach(([x, y, zw, zh]) => g.strokeRect(x, y, zw, zh))
  g.strokeStyle = 'rgba(124,92,255,.28)'
  g.lineWidth = 2
  g.beginPath(); g.moveTo(w / 2, 300); g.lineTo(w / 2, 340); g.stroke()
  g.beginPath(); g.moveTo(470, 320); g.lineTo(554, 320); g.stroke()
})
const zoneLabelTex = (label) => tex(512, 96, (g, w, h) => {
  g.clearRect(0, 0, w, h)
  g.fillStyle = 'rgba(200,194,238,.9)'
  g.font = "600 44px 'DM Mono', monospace"
  g.textAlign = 'center'
  g.fillText(label, w / 2, 64)
})
const tasksSheetTex = () => tex(512, 288, (g, w, h) => {
  g.fillStyle = '#fbfaf6'; g.fillRect(0, 0, w, h)
  g.fillStyle = '#111827'; g.font = "600 40px 'DM Sans', sans-serif"; g.textAlign = 'center'
  g.fillText('YOUR TASKS', w / 2, 120)
  g.fillStyle = '#667085'; g.font = "400 30px 'DM Sans', sans-serif"
  g.fillText('Ready for your first task', w / 2, 180)
})
const solvyLabelsTex = () => tex(256, 192, (g, w, h) => {
  g.clearRect(0, 0, w, h)
  g.fillStyle = 'rgba(200,194,238,.9)'; g.font = "400 28px 'DM Mono', monospace"
  g.fillText('Requirements', 8, 50)
  g.fillText('Rubric', 8, 108)
  g.fillText('Complexity', 8, 166)
})
const filesLabelTex = () => tex(512, 128, (g, w, h) => {
  g.clearRect(0, 0, w, h)
  g.fillStyle = 'rgba(200,194,238,.9)'; g.font = "600 44px 'DM Mono', monospace"; g.textAlign = 'center'
  g.fillText('TASK FILES', w / 2, 82)
})
const progLabelsTex = () => tex(640, 96, (g, w, h) => {
  g.clearRect(0, 0, w, h)
  g.fillStyle = 'rgba(140,160,200,.75)'; g.font = "400 26px 'DM Mono', monospace"; g.textAlign = 'center'
  const steps = ['Analyze', 'Confirm', 'Progress', 'Quality', 'Delivery']
  steps.forEach((s, i) => g.fillText(s, 70 + i * 125, 60))
})
const BUILD_HINTS = ['YOUR TASKS — Ready for your first task', 'SOLVY — Requirements · Rubric · Complexity', 'TASK FILES', 'Analyze · Confirm · Progress · Quality · Delivery']
const quarterGeo = [0, 1, 2, 3].map((i) => {  const geo = new THREE.TorusGeometry(0.2, 0.032, 8, 24, Math.PI / 2)
  geo.rotateZ(i * Math.PI / 2)
  geo.rotateX(-Math.PI / 2)
  return geo
})

function SignupScene({ s, pointer, nudge, reduced, mini, onPanel }) {
  const root = useRef(null)
  const tasksG = useRef(null)
  const solvyG = useRef(null)
  const filesG = useRef(null)
  const progG = useRef(null)
  const coreRing = useRef(null)
  const coreQ = useRef([])
  const coreDot = useRef(null)
  const conns = useRef([])
  const bead = useRef(null)
  const build = useRef([0, 0, 0, 0])

  const baseT = useMemo(blueprintTex, [])
  const tasksT = useMemo(tasksSheetTex, [])
  const solvyT = useMemo(solvyLabelsTex, [])
  const filesT = useMemo(filesLabelTex, [])
  const progT = useMemo(progLabelsTex, [])

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime
    const g = root.current
    if (g) {
      g.rotation.y = THREE.MathUtils.damp(g.rotation.y, -0.28 + pointer.current.x * 0.035 + nudge.current.x, 4, dt)
      g.rotation.x = THREE.MathUtils.damp(g.rotation.x, -pointer.current.y * 0.022 + nudge.current.y, 4, dt)
      g.position.y = reduced ? 0 : Math.sin((t * Math.PI * 2) / 8) * 0.03
    }
    const granted = s.status === 'granted'
    const qTarget = [
      s.valid.name && s.valid.email ? 1 : 0,
      s.valid.email ? 1 : 0,
      s.step >= 1 ? 1 : 0,
      s.valid.password ? 1 : 0,
    ]
    const rate = reduced ? 999 : 3.2
    const D = (cur, target, r) => THREE.MathUtils.damp(cur, target, r, dt)
    const H = [tasksG, solvyG, filesG, progG].map((r, i) => {
      if (!r.current) return 0
      build.current[i] = THREE.MathUtils.clamp(build.current[i] + Math.sign((granted ? 1 : qTarget[i]) - build.current[i]) * rate * dt, 0, 1)
      return build.current[i]
    })
    // TASKS plinth + sheet
    if (tasksG.current) {
      tasksG.current.position.y = D(tasksG.current.position.y, -0.02 + H[0] * 0.1 + (hoverZone.current === 0 && H[0] > 0.5 ? 0.03 : 0), 5)
      tasksG.current.children.forEach((m) => {
        if (m.material && m.material.transparent) m.material.opacity = D(m.material.opacity, 0.25 + H[0] * 0.75, 5)
      })
    }
    // SOLVY column + lines
    if (solvyG.current) {
      solvyG.current.children.forEach((m) => {
        if (m.userData.grow === 'y') m.scale.y = D(m.scale.y, Math.max(H[1], 0.0001), 5)
        if (m.userData.grow === 'x') m.scale.x = D(m.scale.x, Math.max(H[1], 0.0001), 5)
        if (m.material && m.material.transparent) m.material.opacity = D(m.material.opacity, H[1], 5)
      })
      const line = solvyG.current.children.find((m) => m.userData.actline)
      if (line) line.material.emissiveIntensity = D(line.material.emissiveIntensity, hoverZone.current === 1 && H[1] > 0.5 ? 0.9 : 0.25, 5)
    }
    // FILES tray
    if (filesG.current) {
      filesG.current.position.z = D(filesG.current.position.z, (hoverZone.current === 2 && H[2] > 0.5 ? 0.05 : 0), 5)
      filesG.current.children.forEach((m) => {
        if (m.material && m.material.transparent) m.material.opacity = D(m.material.opacity, H[2], 5)
      })
    }
    // PROGRESS rail
    if (progG.current) {
      progG.current.children.forEach((m) => {
        if (m.userData.extend) m.scale.x = D(m.scale.x, 1 + (hoverZone.current === 3 && H[3] > 0.5 ? 0.06 : 0), 5)
        if (m.material && m.material.transparent) m.material.opacity = D(m.material.opacity, H[3], 5)
      })
    }
    // core quarters
    const qOn = [s.valid.name, s.valid.email, s.verified, granted]
    coreQ.current.forEach((m, i) => {
      if (!m) return
      m.material.opacity = D(m.material.opacity, qOn[i] ? 0.95 : 0.12, 5)
      m.material.emissiveIntensity = D(m.material.emissiveIntensity, qOn[i] ? 0.7 : 0, 5)
    })
    // connectors + bead on granted
    const connT = granted ? 1 : 0
    conns.current.forEach((m) => {
      if (!m) return
      m.material.opacity = D(m.material.opacity, connT * 0.8, 4)
    })
    if (bead.current) {
      if (granted && !reduced) {
        bead.current.userData.bt = Math.min(1, (bead.current.userData.bt || 0) + dt / 1.1)
        const bt = bead.current.userData.bt
        const path = [[-0.95, -0.55], [0.95, -0.55], [-0.95, 0.55], [0.95, 0.55], [0, 0]]
        const seg = Math.min(3, Math.floor(bt * 4))
        const f = bt * 4 - seg
        const a = path[seg]
        const b = path[seg + 1]
        bead.current.position.set(a[0] + (b[0] - a[0]) * f, 0.28, a[1] + (b[1] - a[1]) * f)
        bead.current.material.opacity = D(bead.current.material.opacity, bt >= 1 ? 0 : 1, 5)
      } else {
        bead.current.userData.bt = 0
        bead.current.material.opacity = D(bead.current.material.opacity, 0, 5)
      }
    }
    // camera dolly on granted
    if (state.camera && granted && !reduced) {
      const k = 0.96
      state.camera.position.x = D(state.camera.position.x, state.camera.position.x * k, 2)
      state.camera.position.y = D(state.camera.position.y, state.camera.position.y * k, 2)
      state.camera.position.z = D(state.camera.position.z, state.camera.position.z * k, 2)
      state.camera.lookAt(0, 0, 0)
    }
    nudge.current.x = D(nudge.current.x, 0, 3)
    nudge.current.y = D(nudge.current.y, 0, 3)
  })

  const hoverZone = useRef(null)
  const hovZ = (i) => ({
    onPointerOver: (e) => {
      e.stopPropagation()
      const built = [s.valid.name && s.valid.email, s.valid.email, s.step >= 1, s.valid.password][i]
      if (!built) return
      hoverZone.current = i
      if (onPanel) onPanel(BUILD_HINTS[i])
    },
    onPointerOut: () => { hoverZone.current = null; if (onPanel) onPanel(null) },
  })

  return (
    <group ref={root}>
      {/* blueprint foundation */}
      <mesh position={[0, -0.06, 0]}><boxGeometry args={[3.6, 0.12, 2.32]} /><meshStandardMaterial color="#11182b" roughness={0.6} metalness={0.2} /></mesh>
      <mesh position={[0, 0.006, 0]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[3.5, 2.22]} />
        <meshBasicMaterial map={baseT} transparent toneMapped={false} /></mesh>
      {/* zone labels */}
      {[['TASKS', -0.95, -0.62], ['SOLVY', 0.95, -0.62], ['FILES', -0.95, 0.62], ['PROGRESS', 0.95, 0.62]].map(([t, x, z]) => (
        <mesh key={t} position={[x, 0.012, z + 0.62]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[1.1, 0.2]} /><meshBasicMaterial map={zoneT} transparent opacity={0.9} toneMapped={false} depthWrite={false} />
        </mesh>
      ))}
      {/* TASKS */}
      <group ref={tasksG} position={[-0.95, 0, -0.62]} {...hovZ(0)}>
        <mesh position={[0, 0.07, 0]}><boxGeometry args={[1.5, 0.14, 0.9]} />
          <meshStandardMaterial color="#1a2340" roughness={0.6} transparent opacity={0.25} /></mesh>
        <mesh position={[0, 0.16, 0]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[1.3, 0.72]} />
          <meshBasicMaterial map={tasksT} transparent opacity={0.25} toneMapped={false} /></mesh>
        <mesh position={[0.475, 0.02, 0.31]} rotation={[0, 2.56, 0]}><boxGeometry args={[1.13, 0.02, 0.03]} />
          <meshBasicMaterial color="#8f7bff" transparent opacity={0.25} depthWrite={false} /></mesh>
      </group>
      {/* SOLVY */}
      <group ref={solvyG} position={[0.95, 0, -0.62]} {...hovZ(1)}>
        <mesh position={[0, 0.25, 0]} scale={[1, 0.0001, 1]} userData={{ grow: 'y' }}>
          <boxGeometry args={[0.16, 0.5, 0.16]} />
          <meshStandardMaterial color="#2b2350" roughness={0.3} emissive="#4a3fa0" emissiveIntensity={0.3} transparent opacity={0} /></mesh>
        {[0.3, 0.45].map((y, i) => (
          <mesh key={y} position={[-0.2, y, 0]} scale={[0.0001, 1, 1]} userData={{ grow: 'x', ...(i === 0 ? { actline: true } : {}) }}>
            <boxGeometry args={[0.5, 0.04, 0.04]} />
            <meshStandardMaterial color="#2b2350" roughness={0.4} emissive="#8f7bff" emissiveIntensity={0.25} transparent opacity={0} /></mesh>
        ))}
        <mesh position={[0.62, 0.28, 0]}><planeGeometry args={[0.55, 0.42]} />
          <meshBasicMaterial map={solvyT} transparent opacity={0} toneMapped={false} depthWrite={false} /></mesh>
      </group>
      {/* FILES */}
      <group ref={filesG} position={[-0.95, 0, 0.62]} {...hovZ(2)}>
        <mesh position={[0, 0.025, 0]}><boxGeometry args={[1.5, 0.05, 0.9]} />
          <meshStandardMaterial color="#1a2340" roughness={0.6} transparent opacity={0} /></mesh>
        {[0, 1, 2].map((i) => (
          <mesh key={i} position={[0, 0.06 + i * 0.022, 0]}><boxGeometry args={[1.3, 0.018, 0.7]} />
            <meshStandardMaterial color="#f4f2ec" roughness={0.85} transparent opacity={0} /></mesh>
        ))}
        <mesh position={[0, 0.13, 0]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[1.1, 0.3]} />
          <meshBasicMaterial map={filesT} transparent opacity={0} toneMapped={false} depthWrite={false} /></mesh>
      </group>
      {/* PROGRESS */}
      <group ref={progG} position={[0.95, 0, 0.62]} {...hovZ(3)}>
        <mesh position={[0, 0.04, 0]} userData={{ extend: true }}><boxGeometry args={[1.5, 0.07, 0.14]} />
          <meshStandardMaterial color="#1a2340" roughness={0.6} transparent opacity={0} /></mesh>
        {[-0.6, -0.3, 0, 0.3, 0.6].map((x, i) => (
          <mesh key={x} position={[x, 0.1, 0]}>
            <sphereGeometry args={[0.04, 10, 10]} />
            <meshStandardMaterial color="#2a3350" roughness={0.5} emissive={i === 0 ? '#8f7bff' : '#3a4560'} emissiveIntensity={i === 0 ? 0.8 : 0.2} transparent opacity={0} /></mesh>
        ))}
        <mesh position={[0, 0.1, 0.34]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[1.4, 0.22]} />
          <meshBasicMaterial map={progT} transparent opacity={0} toneMapped={false} depthWrite={false} /></mesh>
      </group>
      {/* central core */}
      <mesh position={[0, 0.07, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.2, 0.022, 8, 40]} />
        <meshBasicMaterial color="#3a4560" transparent opacity={0.5} />
      </mesh>
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} ref={(m) => { coreQ.current[i] = m }} geometry={quarterGeo[i]} position={[0, 0.075, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <meshBasicMaterial color="#8f7bff" transparent opacity={0.12} depthWrite={false} />
        </mesh>
      ))}
      <mesh ref={coreDot} position={[0, 0.1, 0]}>
        <sphereGeometry args={[0.05, 12, 12]} />
        <meshStandardMaterial color="#2a3350" roughness={0.4} emissive="#8f7bff" emissiveIntensity={0.2} />
      </mesh>
      {/* connectors + bead */}
      {[[-0.475, -0.31, 2.56, 1.13], [0.475, -0.31, 0.58, 1.13], [-0.475, 0.31, -2.56, 1.13], [0.475, 0.31, -0.58, 1.13]].map(([x, z, r, len], i) => (
        <mesh key={i} ref={(m) => { conns.current[i] = m }} position={[x, 0.05, z]} rotation={[0, r, 0]}>
          <boxGeometry args={[len, 0.02, 0.03]} />
          <meshBasicMaterial color="#8f7bff" transparent opacity={0} depthWrite={false} /></mesh>
      ))}
      <mesh ref={bead} position={[0, 0.28, 0]}>
        <sphereGeometry args={[0.055, 12, 12]} />
        <meshBasicMaterial color="#b7a8ff" transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  )
}


/* Error boundary: a 3D runtime failure must never blank authentication. */
class AtelierErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { failed: false } }
  static getDerivedStateFromError() { return { failed: true } }
  render() {
    if (this.state.failed) {
      return (
        <div className="sn-at-errfb" aria-hidden="true">
          <span>SOLVENEST</span>
          <div className="sn-at-errfb-doc"><b>Academic workspace</b><i>Sign in to continue</i></div>
        </div>
      )
    }
    return this.props.children
  }
}

function CamRig({ mode }) {
  const { camera } = useThree()
  useEffect(() => {
    if (mode === 'signin') {
      camera.position.set(-0.75, 1.7, 7.2)
      camera.lookAt(0, 0.1, 0)
    } else {
      camera.position.set(0, 3.0, 5.6)
      camera.lookAt(0, 0, 0)
    }
  }, [camera, mode])
  return null
}

export function AtelierCanvas({ mode = 'signin', s = {}, visible = true, reduced = false, mini = false, onPanel = null, onHover = null, overlay = null, journey = 2, onJourney = null, onHoverStage = null, onInteract = null }) {
  const wrap = useRef(null)
  const pointer = useRef({ x: 0, y: 0 })
  const nudge = useRef({ x: 0, y: 0 })
  return (
    <div
      ref={wrap}
      className="sn-at-wrap"
      onPointerMove={(e) => {
        if (reduced || mini) return
        const r = wrap.current?.getBoundingClientRect()
        if (!r) return
        pointer.current.x = ((e.clientX - r.left) / r.width) * 2 - 1
        pointer.current.y = ((e.clientY - r.top) / r.height) * 2 - 1
      }}
      onPointerLeave={() => { pointer.current.x = 0; pointer.current.y = 0 }}
      onPointerEnter={() => { if (onInteract) onInteract() }}
      onPointerDown={() => { if (onInteract) onInteract() }}
      onTouchStart={(e) => {
        if (reduced) return
        const t = e.touches[0]
        nudge.current.x = (t.clientX % 2 === 0 ? 1 : -1) * 0.02
        nudge.current.y = -0.015
      }}
    >
      <AtelierErrorBoundary>
      <Canvas
        dpr={mini ? [1, 1.5] : [1, 1.75]}
        camera={{ position: mode === 'signin' ? [-0.75, 1.7, 7.2] : [0, 0.3, 6.6], fov: 38 }}
        gl={{ antialias: true, alpha: true, powerPreference: 'low-power' }}
        frameloop={visible ? 'always' : 'never'}
        aria-hidden="true"
      >
        <CamRig mode={mode} />
        <ambientLight intensity={1.12} />
        <directionalLight position={[-4, 5, 6]} intensity={1.05} color="#fff1dd" />
        <pointLight position={[4, 0, 5]} intensity={4} color="#6f7bff" distance={16} />
        <pointLight position={[0, -2, 3]} intensity={1.6} color="#fff6e8" distance={10} />
        {mode === 'signin'
          ? <TaskJourneyScene s={s} pointer={pointer} nudge={nudge} reduced={reduced} mini={mini} journey={journey} onJourney={onJourney} onHoverStage={onHoverStage} />
          : <SignupScene s={s} pointer={pointer} nudge={nudge} reduced={reduced} mini={mini} onPanel={onPanel} />}
      </Canvas>
      {overlay && <div className="sn-at-overlay">{overlay}</div>}
      </AtelierErrorBoundary>
    </div>
  )
}
