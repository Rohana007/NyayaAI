import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import Navbar from '../components/Navbar'

const PRINCIPLES = [
  {
    icon: '⚖',
    title: 'Bias-Free Evaluation',
    desc: 'Every score is based purely on legal arguments, evidence quality, and procedural compliance. Gender, caste, religion, economic status, and regional origin are never factored into any ruling or score.',
  },
  {
    icon: '📷',
    title: 'Camera Privacy',
    desc: 'Webcam access is optional. Video frames are processed client-side by face-api.js. On argument submission, one frame is sent to Gemini Vision for demeanor analysis only. No video is recorded, stored, or transmitted beyond that single frame.',
  },
  {
    icon: '🔒',
    title: 'Data Minimisation',
    desc: 'We store only what is necessary: your name, email (hashed password), session transcripts, and scores. No biometric data is persisted. Camera frames are discarded immediately after analysis.',
  },
  {
    icon: '🎓',
    title: 'Educational Purpose Only',
    desc: 'NyayaAI is a simulation tool for law students. No output constitutes legal advice. All cases are AI-generated and fictional. Verdicts are for learning purposes only.',
  },
  {
    icon: '📜',
    title: 'Legal Framework Integrity',
    desc: 'The AI is hard-constrained to cite only BNS, BNSS, and BSA — India\'s new criminal codes. It is explicitly forbidden from citing IPC, CrPC, or IEA, ensuring students learn the current law.',
  },
  {
    icon: '🤖',
    title: 'AI Transparency',
    desc: 'Every AI-generated response is clearly labelled. The judge, opposing counsel, and witnesses are all AI. Demeanor analysis shows whether it came from Gemini Vision (✦ AI) or local face-api.js (⚡ LOCAL).',
  },
]

export default function Ethics() {
  const nav = useNavigate()
  return (
    <div style={{ minHeight: '100vh', background: '#111' }}>
      <Navbar />
      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '48px 48px' }}>
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: 40 }}>
          <h1 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 52, color: '#E8E0D0', fontWeight: 700, lineHeight: 1.05 }}>AI Ethics & Privacy</h1>
          <p style={{ marginTop: 8, color: '#666', fontSize: 14, fontFamily: 'DM Sans, sans-serif', maxWidth: 600 }}>
            NyayaAI is built with fairness, transparency, and student privacy as first-class concerns.
          </p>
        </motion.div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, marginBottom: 40 }}>
          {PRINCIPLES.map((p, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * .07 }}
              style={{ borderRadius: 14, padding: 28, background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.07)' }}>
              <div style={{ fontSize: 32, marginBottom: 14 }}>{p.icon}</div>
              <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 15, fontWeight: 700, color: '#E8E0D0', marginBottom: 10 }}>{p.title}</div>
              <p style={{ fontSize: 13, color: '#666', lineHeight: 1.7, fontFamily: 'DM Sans, sans-serif' }}>{p.desc}</p>
            </motion.div>
          ))}
        </div>

        {/* Bias audit note */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .4 }}
          style={{ borderRadius: 14, padding: 28, background: 'rgba(74,154,106,.06)', border: '1px solid rgba(74,154,106,.2)', marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <span style={{ fontSize: 24 }}>✓</span>
            <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 15, fontWeight: 700, color: '#6DBF8A' }}>Bias Audit on Every Session</div>
          </div>
          <p style={{ fontSize: 13, color: '#666', lineHeight: 1.7, fontFamily: 'DM Sans, sans-serif', maxWidth: 700 }}>
            Every evaluation includes a bias audit field. Gemini is instructed to confirm that the assessment was based solely on legal arguments — not on any demographic or personal characteristic of the student. The audit result is shown on the Evaluation page.
          </p>
        </motion.div>

        <div style={{ display: 'flex', gap: 12 }}>
          <button onClick={() => nav(-1)}
            style={{ padding: '12px 24px', borderRadius: 10, border: '1px solid rgba(255,255,255,.1)', color: '#555', background: 'transparent', cursor: 'pointer', fontFamily: 'Space Grotesk, sans-serif', fontSize: 13 }}>
            ← Back
          </button>
          <button onClick={() => nav('/dashboard')}
            style={{ padding: '12px 24px', borderRadius: 10, border: '1px solid rgba(201,168,76,.3)', color: '#C9A84C', background: 'rgba(201,168,76,.08)', cursor: 'pointer', fontFamily: 'Space Grotesk, sans-serif', fontSize: 13, fontWeight: 600 }}>
            Dashboard →
          </button>
        </div>
      </div>
    </div>
  )
}
