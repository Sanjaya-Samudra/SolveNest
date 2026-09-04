import { useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'

/* The SolveNest Knowledge Object — hero state: a raw academic assignment
   document with faint paper layers behind it. Concept states driven by the
   shared activeConcept: clarity (layers separate), accountability (approval
   layer appears), quality (verification frame appears), understanding
   (learning annotations appear). All essential text also exists in DOM. */

function makeDocTexture() {
  const c = document.createElement('canvas')
  c.width = 512
  c.height = 704
  const g = c.getContext('2d')
  g.fillStyle = '#ffffff'
  g.fillRect(0, 0, 512, 704)
  g.fillStyle = '#7657ff'
  g.font = "600 26px 'DM Mono', monospace"
  g.fillText('ASSESSMENT 2', 48, 84)
  g.fillStyle = '#111827'
  g.font = "600 62px Georgia, serif"
  g.fillText('Research', 48, 164)
  g.fillText('Report', 48, 232)
  g.fillStyle = '#667085'
  g.font = "400 30px Georgia, serif"
  g.fillText('2,500 words', 48, 300)
  g.fillText('APA 7', 48, 344)
  g.strokeStyle = 'rgba(17,24,39,.12)'
  g.lineWidth = 2
  for (let i = 0; i < 6; i++) {
    const y = 410 + i * 34
    g.beginPath()
    g.moveTo(48, y)
    g.lineTo(i % 2 ? 340 : 464, y)
    g.stroke()
  }
  g.fillStyle = '#111827'
  g.font = "600 28px Georgia, serif"
  g.fillText('Rubric', 48, 610)
  g.fillStyle = '#667085'
  g.font = "400 28px Georgia, serif"
  g.fillText('Due 28 September', 48, 652)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  return tex
}

const MAX_TILT = THREE.MathUtils.degToRad(3)

function Document({ concept, exitT, pointer, reduced }) {
  const group = useRef(null)
  const behind = useRef([])
  const approval = useRef(null)
  const frame = useRef(null)
  const notes = useRef([])
  const tex = useMemo(makeDocTexture, [])

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime
    const g = group.current
    if (!g) return
    // damped pointer tilt, max +-3deg, plus scroll exit toward top-down
    const targetY = pointer.current.x * MAX_TILT
    const targetX = -pointer.current.y * MAX_TILT - exitT * 0.55
    g.rotation.y = THREE.MathUtils.damp(g.rotation.y, targetY, 4, dt)
    g.rotation.x = THREE.MathUtils.damp(g.rotation.x, targetX, 4, dt)
    g.position.y = reduced ? 0 : Math.sin(t * 0.7) * 0.06
    // layer separation for clarity concept / scroll exit
    const spread = (concept === 'clarity' ? 1 : 0) + exitT * 0.8
    behind.current.forEach((m, i) => {
      if (!m) return
      const tz = -0.14 - i * 0.12 - spread * (i + 1) * 0.22
      const tx = spread * (i % 2 === 0 ? -0.16 : 0.16)
      m.position.z = THREE.MathUtils.damp(m.position.z, tz, 5, dt)
      m.position.x = THREE.MathUtils.damp(m.position.x, tx, 5, dt)
    })
    if (approval.current) {
      const ta = concept === 'accountability' ? 0.32 : 0
      approval.current.material.opacity = THREE.MathUtils.damp(approval.current.material.opacity, ta, 5, dt)
    }
    if (frame.current) {
      const tq = concept === 'quality' ? 1 : 0
      frame.current.children.forEach((bar) => {
        bar.material.opacity = THREE.MathUtils.damp(bar.material.opacity, tq, 5, dt)
      })
    }
    notes.current.forEach((n, i) => {
      if (!n) return
      const tn = concept === 'understanding' ? 1 : 0
      n.material.opacity = THREE.MathUtils.damp(n.material.opacity, tn, 5, dt)
      if (!reduced) n.position.y = 0.4 + i * 0.42 + Math.sin(t * 0.9 + i) * 0.03
    })
  })

  return (
    <group ref={group} position={[0, 0, 0]}>
      {/* faint paper layers behind */}
      {[0, 1, 2].map((i) => (
        <mesh key={i} ref={(m) => { behind.current[i] = m }} position={[0, 0, -0.14 - i * 0.12]} rotation={[0, 0, (i - 1) * 0.03]}>
          <boxGeometry args={[2.2, 3, 0.05]} />
          <meshStandardMaterial color="#e8e6f5" transparent opacity={0.55 - i * 0.15} roughness={0.9} />
        </mesh>
      ))}
      {/* main document */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[2.2, 3, 0.06]} />
        <meshStandardMaterial color="#ffffff" roughness={0.85} />
      </mesh>
      <mesh position={[0, 0, 0.036]}>
        <planeGeometry args={[2.04, 2.8]} />
        <meshBasicMaterial map={tex} toneMapped={false} />
      </mesh>
      {/* human approval layer */}
      <mesh ref={approval} position={[0, 0, 0.09]}>
        <planeGeometry args={[2.34, 3.14]} />
        <meshBasicMaterial color="#7657ff" transparent opacity={0} depthWrite={false} />
      </mesh>
      {/* quality verification frame */}
      <group ref={frame}>
        <mesh position={[0, 1.58, 0.06]}>
          <boxGeometry args={[2.5, 0.05, 0.02]} />
          <meshBasicMaterial color="#1f9d76" transparent opacity={0} depthWrite={false} />
        </mesh>
        <mesh position={[0, -1.58, 0.06]}>
          <boxGeometry args={[2.5, 0.05, 0.02]} />
          <meshBasicMaterial color="#1f9d76" transparent opacity={0} depthWrite={false} />
        </mesh>
        <mesh position={[-1.22, 0, 0.06]}>
          <boxGeometry args={[0.05, 3.2, 0.02]} />
          <meshBasicMaterial color="#1f9d76" transparent opacity={0} depthWrite={false} />
        </mesh>
        <mesh position={[1.22, 0, 0.06]}>
          <boxGeometry args={[0.05, 3.2, 0.02]} />
          <meshBasicMaterial color="#1f9d76" transparent opacity={0} depthWrite={false} />
        </mesh>
      </group>
      {/* learning annotations */}
      {[0, 1, 2].map((i) => (
        <mesh key={i} ref={(m) => { notes.current[i] = m }} position={[1.45, 0.4 + i * 0.42, 0.1]}>
          <planeGeometry args={[0.5, 0.14]} />
          <meshBasicMaterial color="#d99a2b" transparent opacity={0} depthWrite={false} />
        </mesh>
      ))}
    </group>
  )
}

export function WhyHeroCanvas({ concept, exitT, pointer, reduced, visible }) {
  return (
    <Canvas
      dpr={[1, 1.5]}
      camera={{ position: [0, 0.2, 6.4], fov: 32 }}
      gl={{ antialias: true, alpha: true, powerPreference: 'low-power' }}
      frameloop={visible && !reduced ? 'always' : 'never'}
      aria-hidden="true"
    >
      <ambientLight intensity={0.95} />
      <directionalLight position={[3, 4, 5]} intensity={0.85} />
      <pointLight position={[-3, -1, 3]} intensity={6} color="#8f7bff" distance={12} />
      <Document concept={concept} exitT={exitT} pointer={pointer} reduced={reduced} />
    </Canvas>
  )
}
