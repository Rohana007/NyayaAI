import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { TacticalChoices, TacticalChoice } from '../api/client'

interface Props {
  choices: TacticalChoices
  onSelect: (choice: TacticalChoice) => void
}

const TYPE_STYLE: Record<string, { color: string; bg: string; border: string; label: string }> = {
  aggressive:      { color: '#E07070', bg: 'rgba(212,107,107,.08)', border: 'rgba(212,107,107,.3)',  label: '⚔ Aggressive' },
  defensive:       { color: '#7AB0D8', bg: 'rgba(107,143,212,.08)', border: 'rgba(107,143,212,.3)',  label: '🛡 Defensive' },
  procedural:      { color: '#C9A84C', bg: 'rgba(201,168,76,.08)',  border: 'rgba(201,168,76,.3)',   label: '📋 Procedural' },
  emotional_appeal:{ color: '#9B7FD4', bg: 'rgba(155,127,212,.08)', border: 'rgba(155,127,212,.3)',  label: '🎭 Appeal' },
}

export default function ChoiceCards({ choices, onSelect }: Props) {
  const [selected, setSelected] = useState<string | null>(null)
  const [flash, setFlash] = useState<string | null>(null)

  const handleSelect = (choice: TacticalChoice) => {
    if (selected) return
    setSelected(choice.id)
    // Show consequence flash
    setFlash(choice.hint)
    setTimeout(() => {
      setFlash(null)
      onSelect(choice)
    }, 1400)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
    >
      {/* Prompt */}
      <div style={{
        fontSize: 12, color: 'rgba(255,255,255,.6)', lineHeight: 1.5,
        fontFamily: 'Cormorant Garamond, serif', fontStyle: 'italic',
        padding: '8px 12px', borderRadius: 8,
        background: 'rgba(201,168,76,.05)', border: '1px solid rgba(201,168,76,.12)',
      }}>
        {choices.decision_prompt}
      </div>

      {/* Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {choices.choices.map((c, i) => {
          const style = TYPE_STYLE[c.type] || TYPE_STYLE.procedural
          const isSelected = selected === c.id
          const isDimmed = selected && !isSelected

          return (
            <motion.button
              key={c.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: isDimmed ? 0.3 : 1, x: 0 }}
              transition={{ delay: i * 0.06, duration: 0.25 }}
              whileHover={!selected ? { scale: 1.015, borderColor: style.color } : {}}
              whileTap={!selected ? { scale: 0.98 } : {}}
              onClick={() => handleSelect(c)}
              disabled={!!selected}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: 10,
                padding: '10px 12px', borderRadius: 10, cursor: selected ? 'default' : 'pointer',
                background: isSelected ? style.bg : 'rgba(255,255,255,.02)',
                border: `1px solid ${isSelected ? style.color : style.border}`,
                boxShadow: isSelected ? `0 0 16px ${style.color}22` : 'none',
                transition: 'background .2s, border-color .2s, box-shadow .2s',
                textAlign: 'left', width: '100%',
              }}
            >
              {/* ID badge */}
              <div style={{
                width: 22, height: 22, borderRadius: 6, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: `${style.color}22`, border: `1px solid ${style.color}55`,
                fontSize: 11, fontWeight: 700, color: style.color,
                fontFamily: 'Space Grotesk, sans-serif',
              }}>
                {c.id}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,.88)', fontFamily: 'DM Sans, sans-serif', lineHeight: 1.3 }}>
                    {c.label}
                  </span>
                </div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,.38)', fontFamily: 'DM Sans, sans-serif', lineHeight: 1.4 }}>
                  {c.hint}
                </div>
                <div style={{ marginTop: 4, fontSize: 9, color: style.color, fontFamily: 'Space Grotesk, sans-serif', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  {style.label}
                </div>
              </div>

              {isSelected && (
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 500 }}
                  style={{ fontSize: 14, flexShrink: 0 }}>✓</motion.div>
              )}
            </motion.button>
          )
        })}
      </div>

      {/* Consequence flash */}
      <AnimatePresence>
        {flash && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            style={{
              fontSize: 11, color: '#C9A84C', fontStyle: 'italic',
              padding: '6px 10px', borderRadius: 8,
              background: 'rgba(201,168,76,.08)', border: '1px solid rgba(201,168,76,.2)',
              fontFamily: 'Cormorant Garamond, serif',
            }}
          >
            ✦ {flash}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
