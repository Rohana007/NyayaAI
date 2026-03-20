/**
 * Present.tsx — Hackathon presentation page
 * Shows QR code to try the live app + key stats + tech stack
 * Route: /present (no auth required)
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'

// Change this to your deployed URL or ngrok tunnel during the hackathon
const LIVE_URL = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'

const QR_URL = (url: string) =>
  `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(url)}&bgcolor=0e0e0e&color=C9A84C&margin=12`

const STATS = [
  { value: '3', label: 'Law Codes', sub: 'BNS · BNSS · BSA' },
  { value: '8+', label: 'Case Types', sub: 'Murder to Bail' },
  { value: '6', label: 'Score Axes', sub: 'AI-evaluated' },
  { value: '2', label: 'AI Systems', sub: 'Gemini + face-api' },
]

const STACK = [
  { layer: 'Frontend', tech: 'React 19 + TypeScript + Vite' },
  { layer: 'Animations', tech: 'Framer Motion + React Spring' },
  { layer: 'State', tech: 'Zustand (persisted)' },
  { layer: 'Backend', tech: 'FastAPI + SQLite + SQLAlchemy' },
  { layer: 'AI', tech: 'Gemini 2.5 Flash (google-genai)' },
  { layer: 'RAG', tech: 'ChromaDB + sentence-transformers' },
  { layer: 'Vision', tech: 'Gemini Vision + face-api.js' },
  { layer: 'TTS', tech: 'Web Speech API (en-IN)' },
]

const FLOW = [
  { step: '1', label: 'Login', icon: '🔐' },
  { step: '2', label: 'Pick Case', icon: '📋' },
  { step: '3', label: 'Pre-Trial', icon: '📚' },
  { step: '4', label: 'Argue', icon: '⚖' },
  { step: '5', label: 'Closing', icon: '📜' },
  { step: '6', label: 'Verdict', icon: '🔨' },
]

export default function Present() {
  const nav = useNavigate()
  const [customUrl, setCustomUrl] = useState('')
  const displayUrl = customUrl.trim() || LIVE_URL

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#E8E0D0', fontFamily: 'DM Sans, sans-serif', overflow: 'hidden', position: 'relative' }}>

      {/* Background glow */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none' }}>
        <div style={{ position: 'absolute', top: '20%', left: '50%', transform: 'translateX(-50%)', width: 800, height: 400, background: 'radial-gradient(ellipse, rgba(201,168,76,.06) 0%, transparent 70%)', borderRadius: '50%' }} />
      </div>

      {/* Top bar */}
      <div style={{ padding: '0 48px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,.06)', position: 'relative', zIndex: 10 }}>
        <span style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 22, fontWeight: 700, color: '#C9A84C', letterSpacing: '0.08em' }}>
          NYAYA<span style={{ color: '#E8E0D0' }}>AI</span>
          <span style={{ marginLeft: 12, fontSize: 11, color: '#555', fontFamily: 'Space Grotesk, sans-serif', letterSpacing: '0.18em' }}>PRESENTATION</span>
        </span>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => nav('/demo')}
            style={{ fontSize: 12, padding: '6px 16px', borderRadius: 6, border: '1px solid rgba(201,168,76,.3)', color: '#C9A84C', background: 'rgba(201,168,76,.08)', cursor: 'pointer', fontFamily: 'Space Grotesk, sans-serif', fontWeight: 600 }}>
            ▶ Demo Mode
          </button>
          <button onClick={() => nav('/')}
            style={{ fontSize: 12, padding: '6px 16px', borderRadius: 6, border: '1px solid rgba(255,255,255,.1)', color: '#555', background: 'transparent', cursor: 'pointer', fontFamily: 'Space Grotesk, sans-serif' }}>
            Try Live →
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 1300, margin: '0 auto', padding: '48px 48px', position: 'relative', zIndex: 2 }}>

        {/* Hero headline */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .6 }}
          style={{ textAlign: 'center', marginBottom: 56 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '5px 16px', borderRadius: 20, background: 'rgba(74,154,106,.1)', border: '1px solid rgba(74,154,106,.25)', marginBottom: 20 }}>
            <motion.span animate={{ opacity: [1, 0, 1] }} transition={{ duration: 1.5, repeat: Infinity }}
              style={{ width: 7, height: 7, borderRadius: '50%', background: '#4A9A6A', display: 'inline-block' }} />
            <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.14em', color: '#4A9A6A', fontFamily: 'Space Grotesk, sans-serif' }}>AI-POWERED · INDIA'S NEW CRIMINAL CODES</span>
          </div>
          <h1 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 64, fontWeight: 700, lineHeight: 1.05, color: '#E8E0D0', marginBottom: 16 }}>
            The Courtroom Simulation<br />
            <span style={{ color: '#C9A84C' }}>for Indian Law Students</span>
          </h1>
          <p style={{ fontSize: 16, color: '#666', maxWidth: 560, margin: '0 auto', lineHeight: 1.7 }}>
            Argue real cases under BNS, BNSS & BSA. Face an AI judge, raise objections, get scored on every argument.
          </p>
        </motion.div>

        {/* Main grid: QR + stats + flow */}
        <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 32, marginBottom: 40 }}>

          {/* QR card */}
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: .2 }}
            style={{ borderRadius: 20, padding: 28, background: 'rgba(255,255,255,.03)', border: '1px solid rgba(201,168,76,.2)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
            <div style={{ fontSize: 11, letterSpacing: '0.18em', color: '#C9A84C', fontFamily: 'Space Grotesk, sans-serif' }}>SCAN TO TRY LIVE</div>
            <div style={{ borderRadius: 12, overflow: 'hidden', border: '2px solid rgba(201,168,76,.3)', background: '#0e0e0e' }}>
              <img
                src={QR_URL(displayUrl)}
                alt="QR code to try NyayaAI"
                width={220} height={220}
                style={{ display: 'block' }}
              />
            </div>
            <div style={{ fontSize: 11, color: '#555', textAlign: 'center', wordBreak: 'break-all', lineHeight: 1.5 }}>{displayUrl}</div>
            {/* URL override input */}
            <div style={{ width: '100%' }}>
              <div style={{ fontSize: 9, letterSpacing: '0.12em', color: '#444', fontFamily: 'Space Grotesk, sans-serif', marginBottom: 5 }}>OVERRIDE URL (ngrok / deployed)</div>
              <input
                value={customUrl}
                onChange={e => setCustomUrl(e.target.value)}
                placeholder="https://your-ngrok-url.ngrok.io"
                style={{ width: '100%', background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 6, color: '#E8E0D0', fontSize: 11, padding: '7px 10px', outline: 'none', fontFamily: 'DM Sans, sans-serif' }}
              />
            </div>
          </motion.div>

          {/* Right column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

            {/* Stats row */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .25 }}
              style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
              {STATS.map((s, i) => (
                <div key={i} style={{ borderRadius: 12, padding: '18px 16px', background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.07)', textAlign: 'center' }}>
                  <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 36, fontWeight: 700, color: '#C9A84C', lineHeight: 1 }}>{s.value}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#E8E0D0', marginTop: 6, fontFamily: 'Space Grotesk, sans-serif' }}>{s.label}</div>
                  <div style={{ fontSize: 10, color: '#555', marginTop: 3 }}>{s.sub}</div>
                </div>
              ))}
            </motion.div>

            {/* User flow */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .3 }}
              style={{ borderRadius: 14, padding: '20px 24px', background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.07)' }}>
              <div style={{ fontSize: 10, letterSpacing: '0.15em', color: '#8A8070', fontFamily: 'Space Grotesk, sans-serif', marginBottom: 16 }}>USER FLOW</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
                {FLOW.map((f, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flex: 1 }}>
                      <div style={{ width: 44, height: 44, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
                        background: 'rgba(201,168,76,.12)', border: '1px solid rgba(201,168,76,.3)' }}>{f.icon}</div>
                      <div style={{ fontSize: 10, fontWeight: 600, color: '#C9A84C', fontFamily: 'Space Grotesk, sans-serif', textAlign: 'center' }}>{f.label}</div>
                    </div>
                    {i < FLOW.length - 1 && <div style={{ width: 20, height: 1, background: 'rgba(201,168,76,.25)', flexShrink: 0 }} />}
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Tech stack */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .35 }}
              style={{ borderRadius: 14, padding: '20px 24px', background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.07)' }}>
              <div style={{ fontSize: 10, letterSpacing: '0.15em', color: '#8A8070', fontFamily: 'Space Grotesk, sans-serif', marginBottom: 14 }}>TECH STACK</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                {STACK.map((s, i) => (
                  <div key={i} style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.06)' }}>
                    <div style={{ fontSize: 9, letterSpacing: '0.1em', color: '#555', fontFamily: 'Space Grotesk, sans-serif', marginBottom: 3 }}>{s.layer}</div>
                    <div style={{ fontSize: 11, color: '#C8C0B0', fontWeight: 600 }}>{s.tech}</div>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>

        {/* Key differentiators */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .4 }}
          style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
          {[
            { icon: '📜', title: 'BNS/BNSS/BSA Only', desc: 'Hard-constrained to India\'s new criminal codes. Never IPC/CrPC.' },
            { icon: '📷', title: 'Demeanor AI', desc: 'Gemini Vision reads your confidence. face-api.js runs locally as backup.' },
            { icon: '🔊', title: 'Judge Speaks', desc: 'Web Speech API reads every ruling aloud in Indian English.' },
            { icon: '▶', title: 'Self-Running Demo', desc: 'Auto-plays a full session for presentations. No typing needed.' },
          ].map((d, i) => (
            <div key={i} style={{ borderRadius: 12, padding: '18px 20px', background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.07)' }}>
              <div style={{ fontSize: 24, marginBottom: 10 }}>{d.icon}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#E8E0D0', marginBottom: 6, fontFamily: 'Space Grotesk, sans-serif' }}>{d.title}</div>
              <div style={{ fontSize: 12, color: '#666', lineHeight: 1.5 }}>{d.desc}</div>
            </div>
          ))}
        </motion.div>

        <div style={{ marginTop: 32, textAlign: 'center', fontSize: 11, color: '#333', fontFamily: 'DM Sans, sans-serif' }}>
          Educational simulation only · Not legal advice · Built with Gemini 2.5 Flash
        </div>
      </div>
    </div>
  )
}
