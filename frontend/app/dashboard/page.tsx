'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createSession, listSessions } from '@/lib/api'
import type { Session } from '@/lib/types'
import SessionCard from '@/components/SessionCard'
import { formatDate } from '@/lib/utils'

export default function DashboardPage() {
  const router = useRouter()
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  // form state
  const [title, setTitle] = useState('')
  const [task, setTask] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  // ── load sessions on mount ──────────────────────────────────────────────────
  useEffect(() => {
    listSessions()
      .then((data) => setSessions(Array.isArray(data) ? data : []))
      .catch(() => setLoadError('Failed to load sessions.'))
      .finally(() => setLoading(false))
  }, [])

  // ── new session submit ──────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || !task.trim() || submitting) return
    setSubmitting(true)
    setFormError(null)
    try {
      const session = await createSession(title.trim(), task.trim())
      router.push(`/run/${session.id}`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create session. Is the backend running?'
      setFormError(msg)
      setSubmitting(false)
    }
  }

  const canSubmit = title.trim().length > 0 && task.trim().length > 0 && !submitting

  // ── shared input style ──────────────────────────────────────────────────────
  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 14px',
    background: 'rgba(255,255,255,.06)',
    border: '1px solid rgba(139,124,248,.28)',
    borderRadius: 8,
    color: '#EAE8F8',
    fontSize: 13,
    outline: 'none',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
  }

  return (
    <div
      style={{
        background: '#07090D',
        minHeight: '100vh',
        color: '#EAE8F5',
        fontFamily: 'inherit',
      }}
    >
      {/* ── nav ── */}
      <nav
        style={{
          display: 'flex',
          alignItems: 'center',
          height: 52,
          padding: '0 24px',
          background: 'rgba(22,25,40,0.96)',
          backdropFilter: 'blur(8px)',
          borderBottom: '1px solid rgba(139,124,248,.15)',
          position: 'sticky',
          top: 0,
          zIndex: 50,
        }}
      >
        <a
          href="/"
          style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}
        >
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: '#8B7CF8',
              boxShadow: '0 0 8px rgba(139,124,248,.7)',
            }}
          />
          <span
            style={{
              fontSize: 13,
              fontWeight: 800,
              color: '#EAE8F8',
              letterSpacing: '.1em',
            }}
          >
            AOP
          </span>
        </a>
        <span
          style={{
            marginLeft: 16,
            fontSize: 12,
            color: '#5A5870',
            fontWeight: 500,
          }}
        >
          / Dashboard
        </span>
      </nav>

      {/* ── content ── */}
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '32px 20px' }}>

        {/* ── New Session form ── */}
        <section style={{ marginBottom: 40 }}>
          <h2
            style={{
              fontSize: 16,
              fontWeight: 700,
              color: '#EAE8F8',
              marginBottom: 16,
              letterSpacing: '-.01em',
            }}
          >
            New Session
          </h2>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Session title — e.g. Q4 pricing strategy"
              required
              disabled={submitting}
              style={{ ...inputStyle, opacity: submitting ? 0.5 : 1 }}
              onFocus={(e) => (e.target.style.borderColor = 'rgba(139,124,248,.65)')}
              onBlur={(e) => (e.target.style.borderColor = 'rgba(139,124,248,.28)')}
            />

            <textarea
              value={task}
              onChange={(e) => setTask(e.target.value)}
              placeholder="Describe the task in detail — e.g. build a SaaS pricing strategy with competitor analysis and a recommendation…"
              required
              disabled={submitting}
              rows={4}
              style={{
                ...inputStyle,
                resize: 'vertical',
                minHeight: 90,
                lineHeight: 1.55,
                opacity: submitting ? 0.5 : 1,
              }}
              onFocus={(e) => (e.target.style.borderColor = 'rgba(139,124,248,.65)')}
              onBlur={(e) => (e.target.style.borderColor = 'rgba(139,124,248,.28)')}
            />

            {formError && (
              <div
                style={{
                  fontSize: 12,
                  color: '#E85D40',
                  background: 'rgba(232,93,64,0.1)',
                  border: '1px solid rgba(232,93,64,0.3)',
                  borderRadius: 7,
                  padding: '8px 12px',
                }}
              >
                {formError}
              </div>
            )}

            <button
              type="submit"
              disabled={!canSubmit}
              style={{
                alignSelf: 'flex-end',
                height: 40,
                padding: '0 24px',
                background: '#6C4FF5',
                border: 'none',
                borderRadius: 8,
                color: '#fff',
                fontSize: 13,
                fontWeight: 700,
                cursor: canSubmit ? 'pointer' : 'not-allowed',
                opacity: canSubmit ? 1 : 0.45,
                boxShadow: '0 2px 10px rgba(108,79,245,.35)',
                transition: 'opacity .15s',
              }}
              onMouseEnter={(e) => {
                if (canSubmit) e.currentTarget.style.opacity = '.85'
              }}
              onMouseLeave={(e) => {
                if (canSubmit) e.currentTarget.style.opacity = '1'
              }}
            title="Opens the live 3D office view with your AI team"
            >
              {submitting ? 'Starting…' : 'Launch Session →'}
            </button>
          </form>
        </section>

        {/* ── divider ── */}
        <div
          style={{
            borderTop: '1px solid rgba(123,110,232,0.14)',
            marginBottom: 28,
          }}
        />

        {/* ── Session list ── */}
        <section>
          <h2
            style={{
              fontSize: 16,
              fontWeight: 700,
              color: '#EAE8F8',
              marginBottom: 16,
              letterSpacing: '-.01em',
            }}
          >
            Sessions
          </h2>

          {loading && (
            <div style={{ fontSize: 13, color: '#44406A' }}>Loading sessions…</div>
          )}

          {loadError && !loading && (
            <div
              style={{
                fontSize: 13,
                color: '#E85D40',
                background: 'rgba(232,93,64,0.1)',
                border: '1px solid rgba(232,93,64,0.3)',
                borderRadius: 7,
                padding: '10px 14px',
              }}
            >
              {loadError}
            </div>
          )}

          {!loading && !loadError && sessions.length === 0 && (
            <div
              style={{
                borderRadius: 10,
                border: '1px dashed rgba(123,110,232,0.22)',
                padding: '28px 24px',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: 13, color: '#5A5870', marginBottom: 16 }}>
                No sessions yet — start one above.
              </div>
              <div style={{
                display: 'flex', flexDirection: 'column', gap: 8,
                textAlign: 'left',
                background: 'rgba(139,124,248,0.05)',
                borderRadius: 8, padding: '14px 16px',
              }}>
                <div style={{ fontSize: 11, color: '#8B7CF8', fontWeight: 700, letterSpacing: '.08em', marginBottom: 4 }}>
                  HOW IT WORKS
                </div>
                {[
                  ['War Room', 'Director + Catalyst align on scope and risks'],
                  ['Ideation Hive', 'All 4 agents brainstorm and propose a system shape'],
                  ['The Forge', 'Architect designs specs, Dev writes the code'],
                  ['Observatory', 'Director reviews and produces the final deliverable'],
                ].map(([room, desc]) => (
                  <div key={room} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#8B7CF8', marginTop: 4, flexShrink: 0, opacity: 0.6 }} />
                    <div>
                      <span style={{ fontSize: 11, color: '#8B7CF8', fontWeight: 700 }}>{room}</span>
                      <span style={{ fontSize: 11, color: '#44406A' }}> — {desc}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!loading && !loadError && sessions.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {sessions.map((s) => (
                <SessionCard
                  key={s.id}
                  id={s.id}
                  title={s.title}
                  status={s.status}
                  createdAt={formatDate(s.created_at)}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
