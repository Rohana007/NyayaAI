import { useEffect, useRef } from 'react'
import { useSession } from '../store/session'
import { useShallow } from 'zustand/react/shallow'

interface Particle {
  x: number; y: number
  vx: number; vy: number
  size: number; opacity: number
  life: number; maxLife: number
  pulse: number  // phase offset for pulsing
}

interface Scale {
  x: number; y: number
  size: number; opacity: number
  vy: number; rotation: number; vr: number
  life: number; maxLife: number
}

const MAX_PARTICLES = 80
const CONNECTION_DIST = 120
const SCALE_INTERVAL = 180  // frames between scale spawns

export default function ParticleBackground() {
  const { theme } = useSession(useShallow(s => ({ theme: s.theme })))
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const themeRef = useRef(theme)

  // Keep themeRef in sync without restarting the animation loop
  useEffect(() => { themeRef.current = theme }, [theme])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    let raf: number
    const particles: Particle[] = []
    const scales: Scale[] = []

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    const spawnParticle = () => {
      if (particles.length >= MAX_PARTICLES) return
      const maxLife = 200 + Math.random() * 300
      particles.push({
        x: Math.random() * canvas.width,
        y: canvas.height + 10,
        vx: (Math.random() - .5) * .5,
        vy: -(0.2 + Math.random() * .55),
        size: .6 + Math.random() * 1.8,
        opacity: 0,
        life: 0,
        maxLife,
        pulse: Math.random() * Math.PI * 2,
      })
    }

    const spawnScale = () => {
      const maxLife = 400 + Math.random() * 300
      scales.push({
        x: 80 + Math.random() * (canvas.width - 160),
        y: canvas.height + 40,
        size: 18 + Math.random() * 28,
        opacity: 0,
        vy: -(0.12 + Math.random() * .18),
        rotation: (Math.random() - .5) * 0.3,
        vr: (Math.random() - .5) * 0.002,
        life: 0,
        maxLife,
      })
    }

    // Draw a simple scales-of-justice icon on canvas
    const drawScaleIcon = (x: number, y: number, size: number, rotation: number, alpha: number, isLight: boolean) => {
      ctx.save()
      ctx.translate(x, y)
      ctx.rotate(rotation)
      ctx.globalAlpha = alpha
      const color = isLight ? 'rgba(160,130,80,' : 'rgba(201,168,76,'
      ctx.strokeStyle = color + '1)'
      ctx.lineWidth = size * 0.045
      ctx.lineCap = 'round'

      // Vertical pole
      ctx.beginPath()
      ctx.moveTo(0, -size * .55)
      ctx.lineTo(0, size * .55)
      ctx.stroke()

      // Horizontal beam
      ctx.beginPath()
      ctx.moveTo(-size * .5, -size * .3)
      ctx.lineTo(size * .5, -size * .3)
      ctx.stroke()

      // Left pan chain
      ctx.beginPath()
      ctx.moveTo(-size * .5, -size * .3)
      ctx.lineTo(-size * .5, size * .05)
      ctx.stroke()

      // Right pan chain
      ctx.beginPath()
      ctx.moveTo(size * .5, -size * .3)
      ctx.lineTo(size * .5, size * .05)
      ctx.stroke()

      // Left pan (arc)
      ctx.beginPath()
      ctx.arc(-size * .5, size * .05, size * .22, 0, Math.PI)
      ctx.stroke()

      // Right pan (arc)
      ctx.beginPath()
      ctx.arc(size * .5, size * .05, size * .22, 0, Math.PI)
      ctx.stroke()

      // Base
      ctx.beginPath()
      ctx.moveTo(-size * .22, size * .55)
      ctx.lineTo(size * .22, size * .55)
      ctx.stroke()

      ctx.restore()
    }

    let frame = 0
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      frame++
      const isLight = themeRef.current === 'light'

      // Spawn
      if (frame % 6 === 0) spawnParticle()
      if (frame % SCALE_INTERVAL === 0) spawnScale()

      // ── Draw connection lines ──
      const alive = particles.filter(p => p.opacity > 0.05)
      for (let i = 0; i < alive.length; i++) {
        for (let j = i + 1; j < alive.length; j++) {
          const dx = alive[i].x - alive[j].x
          const dy = alive[i].y - alive[j].y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < CONNECTION_DIST) {
            const lineAlpha = (1 - dist / CONNECTION_DIST) * 0.12 * Math.min(alive[i].opacity, alive[j].opacity)
            ctx.beginPath()
            ctx.moveTo(alive[i].x, alive[i].y)
            ctx.lineTo(alive[j].x, alive[j].y)
            ctx.strokeStyle = isLight
              ? `rgba(160,130,80,${lineAlpha})`
              : `rgba(201,168,76,${lineAlpha})`
            ctx.lineWidth = .6
            ctx.stroke()
          }
        }
      }

      // ── Draw particles ──
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i]
        p.life++
        p.x += p.vx
        p.y += p.vy
        // Gentle horizontal drift
        p.vx += (Math.random() - .5) * 0.01

        const progress = p.life / p.maxLife
        const fade = progress < .15 ? progress / .15 : progress > .75 ? (1 - progress) / .25 : 1
        // Pulse the opacity slightly
        p.opacity = fade * (0.85 + 0.15 * Math.sin(frame * 0.04 + p.pulse))

        const baseAlpha = isLight ? 0.28 : 0.4
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        ctx.fillStyle = isLight
          ? `rgba(160,130,80,${p.opacity * baseAlpha})`
          : `rgba(201,168,76,${p.opacity * baseAlpha})`
        ctx.fill()

        if (p.life >= p.maxLife) particles.splice(i, 1)
      }

      // ── Draw floating scales ──
      for (let i = scales.length - 1; i >= 0; i--) {
        const s = scales[i]
        s.life++
        s.y += s.vy
        s.rotation += s.vr

        const progress = s.life / s.maxLife
        const fade = progress < .1 ? progress / .1 : progress > .8 ? (1 - progress) / .2 : 1
        s.opacity = fade * (isLight ? 0.09 : 0.13)

        drawScaleIcon(s.x, s.y, s.size, s.rotation, s.opacity, isLight)

        if (s.life >= s.maxLife) scales.splice(i, 1)
      }

      raf = requestAnimationFrame(draw)
    }
    draw()

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
  }, [])  // runs once; theme changes are handled via themeRef

  return (
    <canvas
      ref={canvasRef}
      className="particle-canvas"
      style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0 }}
    />
  )
}
