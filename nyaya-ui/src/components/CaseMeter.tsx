import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { CasePredictor } from '../api/client'

interface Props {
  predictor: CasePredictor
}

const SENTIMENT_ICON: Record<string, string> = {
  favorable: '😊',
  neutral: '⚖️',
  skeptical: '🤨',
  hostile: '😤',
}

const MOMENTUM_ARROW: Record<string, string> = {
  rising: '↑',
  stable: '→',
  declining: '↓',
}

const MOMENTUM_COLOR: Record<string, string> = {
  rising: '#4A9A6A',
  stable: '#C9A84C',
  declining: '#D46B6B',
}

function probColor(p: number) {
  if (p >= 65) return '#4A9A6A'
  if (p >= 40) return '#C9A84C'
  return '#D46B6B'
}

export default function CaseMeter({ predictor }: Props) {
  const [tipOpen, setTipOpen] = useState(false)
  const { win_probability, momentum, momentum_reason, judge_sentiment, tip } = predictor
  const color = probColor(win_probability)
  const mColor = MOMENTUM_COLOR[momentum] || '#C9A84C'

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        borderRadius: 12,
        padding: '12px 14px',
        background: 'rgba(6,8,16,.92)',
        border: `1px solid ${color}33`,
        backdropFilter: 'blur(16px)',
        boxShadow: `0 4px 24px rgba(0,0,0,.6), 0 0 16px ${color}11`,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        minWidth: 220,
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 9, letterSpacing: '0.18em', color: 'rgba(255,255,255,.35)', fontFamily: 'Space Grotesk, sans-serif', textTransform: 'uppercase' }}>
          Live Case Analysis
        </span>
        <span style={{ fontSize: 13 }} title={`Judge: ${judge_sentiment}`}>
          {SENTIMENT_ICON[judge_sentiment] || '⚖️'}
        </span>
      </div>

      {/* Probability bar */}
      <div>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 5 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
            <span style={{ fontFamily: 'Playfair Display, serif', fontSize: 28, fontWeight: 700, color, lineHeight: 1 }}>
              {win_probability}
            </span>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,.4)' }}>%</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 16, fontWeight: 700, color: mColor, lineHeight: 1 }}>
              {MOMENTUM_ARROW[momentum]}
            </span>
            <span style={{ fontSize: 9, color: mColor, fontFamily: 'Space Grotesk, sans-serif', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              {momentum}
            </span>
          </div>
        </div>

        {/* Bar track */}
        <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,.08)', overflow: 'hidden', position: 'relative' }}>
          <motion.div
            animate={{ width: `${win_probability}%` }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            style={{
              height: '100%',
              borderRadius: 3,
              background: `linear-gradient(90deg, ${color}bb, ${color})`,
              boxShadow: `0 0 8px ${color}66`,
            }}
          />
          {/* 50% marker */}
          <div style={{ position: 'absolute', top: 0, bottom: 0, left: '50%', width: 1, background: 'rgba(255,255,255,.15)' }} />
        </div>

        {/* Scale labels */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3 }}>
          <span style={{ fontSize: 8, color: 'rgba(255,255,255,.2)', fontFamily: 'Space Grotesk, sans-serif' }}>Loss</span>
          <span style={{ fontSize: 8, color: 'rgba(255,255,255,.2)', fontFamily: 'Space Grotesk, sans-serif' }}>Win</span>
        </div>
      </div>

      {/* Momentum reason */}
      <div style={{ fontSize: 10, color: 'rgba(255,255,255,.45)', lineHeight: 1.4, fontFamily: 'DM Sans, sans-serif' }}>
        {momentum_reason}
      </div>

      {/* Tip toggle */}
      <button
        onClick={() => setTipOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: 'none',
          cursor: 'pointer', padding: 0, textAlign: 'left',
        }}
      >
        <span style={{ fontSize: 10, color: '#C9A84C', fontFamily: 'Space Grotesk, sans-serif', letterSpacing: '0.06em' }}>
          💡 Tip {tipOpen ? '▲' : '▼'}
        </span>
      </button>
      <AnimatePresence>
        {tipOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{
              fontSize: 11, color: 'rgba(255,255,255,.7)', lineHeight: 1.5,
              padding: '8px 10px', borderRadius: 8,
              background: 'rgba(201,168,76,.06)', border: '1px solid rgba(201,168,76,.15)',
              fontFamily: 'DM Sans, sans-serif',
            }}>
              {tip}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
