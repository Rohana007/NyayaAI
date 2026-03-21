import { useState } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { authApi } from '../api/client'
import { useSession } from '../store/session'
import { useShallow } from 'zustand/react/shallow'

const ease = [0.16, 1, 0.3, 1] as const

const FEATURES = [
  { icon: '⚖', title: 'AI Judge', desc: 'Justice Krishnamurthy rules on every argument in real time' },
  { icon: '📜', title: 'BNS / BNSS / BSA', desc: "India's new criminal codes — not IPC/CrPC" },
  { icon: '🎙', title: 'Voice Input', desc: 'Argue your case hands-free with speech recognition' },
  { icon: '📷', title: 'Demeanor Analysis', desc: 'AI reads your confidence via webcam' },
  { icon: '🔍', title: 'RAG Legal Engine', desc: 'Every ruling grounded in actual law sections' },
  { icon: '🏅', title: 'Earn Badges', desc: 'Track progress across sessions and climb the leaderboard' },
]

const STATS = [
  { value: '3', label: 'Law Codes' },
  { value: '8+', label: 'Case Types' },
  { value: 'AI', label: 'Judge Engine' },
  { value: '6', label: 'Score Axes' },
]

export default function Landing() {
  const nav = useNavigate()
  const { setAuth, user, theme } = useSession(useShallow(s => ({ setAuth: s.setAuth, user: s.user, theme: s.theme })))
  const [tab, setTab] = useState<'login' | 'register'>('login')
  const [form, setForm] = useState({ email: '', password: '', name: '', college: '' })
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)

  if (user) return <Navigate to="/dashboard" replace />

  const submit = async () => {
    setErr(''); setLoading(true)
    try {
      const res = tab === 'login'
        ? await authApi.login(form.email, form.password)
        : await authApi.register(form.email, form.password, form.name, form.college)
      setAuth(res.user, res.access_token)
      nav('/dashboard')
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Failed')
    } finally { setLoading(false) }
  }

  return (
    <div style={{ minHeight: '100vh', background: theme === 'light' ? 'transparent' : 'var(--bg)', display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>

      {/* Background gradients */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0 }}>
        <div style={{ position: 'absolute', top: '-10%', left: '50%', transform: 'translateX(-50%)', width: 900, height: 600, background: 'radial-gradient(ellipse, rgba(201,168,76,.07) 0%, transparent 65%)', borderRadius: '50%' }} />
        <div style={{ position: 'absolute', bottom: '-20%', left: '-10%', width: 600, height: 600, background: 'radial-gradient(ellipse, rgba(107,143,212,.05) 0%, transparent 65%)', borderRadius: '50%' }} />
        <div style={{ position: 'absolute', bottom: '-20%', right: '-10%', width: 600, height: 600, background: 'radial-gradient(ellipse, rgba(212,107,107,.04) 0%, transparent 65%)', borderRadius: '50%' }} />
      </div>

      {/* Navbar */}
      <motion.nav initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .5, ease }}
        style={{ position: 'relative', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 48px', height: 60,
          borderBottom: '1px solid var(--nav-border)', backdropFilter: 'blur(8px)',
          background: 'var(--nav-bg)', transition: 'background .3s' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 22 }}>⚖</span>
          <span style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 22, fontWeight: 700, color: '#C9A84C', letterSpacing: '0.1em' }}>
            NYAYA<span style={{ color: '#E8E0D0' }}>AI</span>
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, letterSpacing: '0.15em', color: '#555', fontFamily: 'Space Grotesk, sans-serif' }}>BNS · BNSS · BSA</span>
          <span style={{ color: 'rgba(255,255,255,.1)' }}>|</span>
          <motion.button onClick={() => nav('/demo')} whileHover={{ scale: 1.03 }} whileTap={{ scale: .97 }}
            style={{ fontSize: 12, padding: '6px 14px', borderRadius: 6, border: '1px solid rgba(201,168,76,.25)', color: '#C9A84C', background: 'rgba(201,168,76,.06)', cursor: 'pointer', fontFamily: 'Space Grotesk, sans-serif', fontWeight: 600 }}>
            ▶ Watch Demo
          </motion.button>
        </div>
      </motion.nav>

      {/* Main layout — two columns on desktop, single column on mobile */}
      <div style={{ position: 'relative', zIndex: 2, flex: 1, display: 'grid', gridTemplateColumns: '1fr 440px', gap: 0, maxWidth: 1300, margin: '0 auto', width: '100%', padding: '0 48px', alignItems: 'center', minHeight: 'calc(100vh - 60px)' }}
        className="landing-grid">

        {/* Left — hero */}
        <motion.div initial={{ opacity: 0, x: -32 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: .7, ease, delay: .1 }}
          className="landing-hero"
          style={{ paddingRight: 64, paddingTop: 40, paddingBottom: 40 }}>

          {/* Badge */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .2 }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '5px 14px', borderRadius: 20, background: 'rgba(74,154,106,.1)', border: '1px solid rgba(74,154,106,.25)', marginBottom: 24 }}>
            <motion.span animate={{ opacity: [1, 0, 1] }} transition={{ duration: 1.5, repeat: Infinity }}
              style={{ width: 7, height: 7, borderRadius: '50%', background: '#4A9A6A', display: 'inline-block' }} />
            <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.14em', color: '#4A9A6A', fontFamily: 'Space Grotesk, sans-serif' }}>AI-POWERED · INDIA'S NEW CRIMINAL CODES</span>
          </motion.div>

          {/* Headline */}
          <h1 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 68, fontWeight: 700, lineHeight: 1.05, color: '#E8E0D0', marginBottom: 20 }}>
            The Courtroom<br />
            <span style={{ color: '#C9A84C' }}>Simulation</span><br />
            for Law Students
          </h1>

          <p style={{ fontSize: 16, lineHeight: 1.75, color: '#666', maxWidth: 480, marginBottom: 36, fontFamily: 'DM Sans, sans-serif' }}>
            Argue real cases under BNS, BNSS & BSA. Face an AI judge, cross-examine witnesses, raise objections — and get scored on every argument.
          </p>

          {/* Stats row */}
          <div style={{ display: 'flex', gap: 32, marginBottom: 48 }}>
            {STATS.map((s, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .3 + i * .06 }}>
                <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 32, fontWeight: 700, color: '#C9A84C', lineHeight: 1 }}>{s.value}</div>
                <div style={{ fontSize: 11, color: '#555', marginTop: 4, letterSpacing: '0.1em', fontFamily: 'Space Grotesk, sans-serif' }}>{s.label}</div>
              </motion.div>
            ))}
          </div>

          {/* Feature grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            {FEATURES.map((f, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .4 + i * .05 }}
                whileHover={{ y: -3, borderColor: 'rgba(201,168,76,.3)' }}
                style={{ padding: '14px 16px', borderRadius: 10, background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)', transition: 'border-color .2s' }}>
                <div style={{ fontSize: 20, marginBottom: 6 }}>{f.icon}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#E8E0D0', marginBottom: 3, fontFamily: 'Space Grotesk, sans-serif' }}>{f.title}</div>
                <div style={{ fontSize: 11, color: '#555', lineHeight: 1.4 }}>{f.desc}</div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Right — auth card */}
        <motion.div initial={{ opacity: 0, x: 32 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: .7, ease, delay: .15 }}
          style={{ position: 'sticky', top: 80 }}>
          <div style={{ borderRadius: 20, border: '1px solid rgba(201,168,76,.2)', background: 'rgba(14,14,14,.95)', backdropFilter: 'blur(24px)', boxShadow: '0 40px 100px rgba(0,0,0,.7), 0 0 0 1px rgba(201,168,76,.06)', overflow: 'hidden' }}>

            {/* Card header */}
            <div style={{ padding: '28px 32px 0', textAlign: 'center' }}>
              <motion.div animate={{ y: [0, -4, 0] }} transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
                style={{ fontSize: 40, marginBottom: 10, filter: 'drop-shadow(0 0 16px rgba(201,168,76,.35))' }}>⚖</motion.div>
              <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 26, fontWeight: 700, color: '#E8E0D0', letterSpacing: '0.06em' }}>
                {tab === 'login' ? 'Welcome Back' : 'Join NyayaAI'}
              </div>
              <div style={{ fontSize: 12, color: '#555', marginTop: 4, fontFamily: 'DM Sans, sans-serif' }}>
                {tab === 'login' ? 'Sign in to your courtroom' : 'Create your advocate profile'}
              </div>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', margin: '20px 32px 0', borderRadius: 10, background: 'rgba(255,255,255,.04)', padding: 4, border: '1px solid rgba(255,255,255,.06)' }}>
              {(['login', 'register'] as const).map(t => (
                <button key={t} onClick={() => { setTab(t); setErr('') }}
                  style={{ flex: 1, padding: '9px 0', borderRadius: 7, border: 'none', cursor: 'pointer', fontFamily: 'Space Grotesk, sans-serif', fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', transition: 'all .2s',
                    background: tab === t ? 'rgba(201,168,76,.15)' : 'transparent',
                    color: tab === t ? '#C9A84C' : '#555',
                    boxShadow: tab === t ? '0 0 12px rgba(201,168,76,.12)' : 'none' }}>
                  {t === 'login' ? 'Sign In' : 'Register'}
                </button>
              ))}
            </div>

            {/* Form */}
            <div style={{ padding: '20px 32px 28px' }}>
              <AnimatePresence mode="wait">
                <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: .18, ease }}
                  style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

                  {tab === 'register' && (
                    <>
                      <div>
                        <label style={{ display: 'block', fontSize: 10, letterSpacing: '0.12em', color: '#555', fontFamily: 'Space Grotesk, sans-serif', marginBottom: 6, textTransform: 'uppercase' }}>Full Name</label>
                        <input placeholder="Adv. Priya Sharma" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                          style={{ width: '100%', background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 8, color: '#E8E0D0', fontSize: 14, padding: '11px 14px', outline: 'none', fontFamily: 'DM Sans, sans-serif', transition: 'border-color .2s' }}
                          onFocus={e => e.target.style.borderColor = 'rgba(201,168,76,.4)'}
                          onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,.1)'} />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: 10, letterSpacing: '0.12em', color: '#555', fontFamily: 'Space Grotesk, sans-serif', marginBottom: 6, textTransform: 'uppercase' }}>College / Institution</label>
                        <input placeholder="National Law University (optional)" value={form.college} onChange={e => setForm(f => ({ ...f, college: e.target.value }))}
                          style={{ width: '100%', background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 8, color: '#E8E0D0', fontSize: 14, padding: '11px 14px', outline: 'none', fontFamily: 'DM Sans, sans-serif', transition: 'border-color .2s' }}
                          onFocus={e => e.target.style.borderColor = 'rgba(201,168,76,.4)'}
                          onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,.1)'} />
                      </div>
                    </>
                  )}

                  <div>
                    <label style={{ display: 'block', fontSize: 10, letterSpacing: '0.12em', color: '#555', fontFamily: 'Space Grotesk, sans-serif', marginBottom: 6, textTransform: 'uppercase' }}>Email</label>
                    <input placeholder="advocate@lawschool.edu" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                      style={{ width: '100%', background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 8, color: '#E8E0D0', fontSize: 14, padding: '11px 14px', outline: 'none', fontFamily: 'DM Sans, sans-serif', transition: 'border-color .2s' }}
                      onFocus={e => e.target.style.borderColor = 'rgba(201,168,76,.4)'}
                      onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,.1)'} />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 10, letterSpacing: '0.12em', color: '#555', fontFamily: 'Space Grotesk, sans-serif', marginBottom: 6, textTransform: 'uppercase' }}>Password</label>
                    <input placeholder="••••••••" type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                      onKeyDown={e => e.key === 'Enter' && submit()}
                      style={{ width: '100%', background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 8, color: '#E8E0D0', fontSize: 14, padding: '11px 14px', outline: 'none', fontFamily: 'DM Sans, sans-serif', transition: 'border-color .2s' }}
                      onFocus={e => e.target.style.borderColor = 'rgba(201,168,76,.4)'}
                      onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,.1)'} />
                  </div>

                  <AnimatePresence>
                    {err && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                        style={{ overflow: 'hidden', borderRadius: 8, padding: '8px 12px', background: 'rgba(212,107,107,.1)', border: '1px solid rgba(212,107,107,.25)' }}>
                        <p style={{ fontSize: 12, color: '#E07070', margin: 0 }}>⚠ {err}</p>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <motion.button onClick={submit} disabled={loading} whileHover={{ scale: 1.01 }} whileTap={{ scale: .98 }}
                    style={{ marginTop: 6, padding: '14px', fontFamily: 'Space Grotesk, sans-serif', fontSize: 13, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', borderRadius: 10, border: 'none', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? .7 : 1, transition: 'opacity .2s',
                      background: 'linear-gradient(135deg, #C9A84C, #E8C96A)', color: '#0e0e0e', boxShadow: '0 4px 20px rgba(201,168,76,.3)' }}>
                    {loading
                      ? <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                          <motion.span animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                            style={{ width: 14, height: 14, border: '2px solid rgba(0,0,0,.3)', borderTopColor: '#0e0e0e', borderRadius: '50%', display: 'inline-block' }} />
                          Please wait…
                        </span>
                      : tab === 'login' ? '⚖ Enter Courtroom' : '⚖ Create Account'}
                  </motion.button>

                  {/* Demo link */}
                  <div style={{ textAlign: 'center', paddingTop: 4 }}>
                    <button onClick={() => nav('/demo')}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#555', fontFamily: 'DM Sans, sans-serif', textDecoration: 'underline', textDecorationColor: 'rgba(255,255,255,.1)' }}>
                      Watch a demo first →
                    </button>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

          <p style={{ marginTop: 16, fontSize: 11, color: '#333', textAlign: 'center', letterSpacing: '0.05em', fontFamily: 'DM Sans, sans-serif' }}>
            Educational simulation only · Not legal advice
          </p>
        </motion.div>
      </div>
    </div>
  )
}
