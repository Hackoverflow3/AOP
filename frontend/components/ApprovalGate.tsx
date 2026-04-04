'use client'
import { useState } from 'react'
import { BACKEND_URL } from '@/lib/config'

const ROOM_ACCENT: Record<string, string> = {
  A: '#7B4FD4',
  B: '#4F7BD4',
  C: '#1CC8A0',
  D: '#F5A623',
  E: '#FFD700',
}

interface ApprovalGateProps {
  roomId: string
  roomName: string
  content: string
  sessionId: string
  onApproved: () => void
}

export default function ApprovalGate({
  roomId,
  roomName,
  content,
  sessionId,
  onApproved,
}: ApprovalGateProps) {
  const accent = ROOM_ACCENT[roomId] ?? '#8B7CF8'
  const [showRejectForm, setShowRejectForm] = useState(false)
  const [feedbackText, setFeedbackText] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleApprove() {
    setLoading(true)
    try {
      await fetch(`${BACKEND_URL}/sessions/${sessionId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approved: true }),
      })
    } finally {
      setLoading(false)
      onApproved()
    }
  }

  async function handleRejectSubmit() {
    setLoading(true)
    try {
      await fetch(`${BACKEND_URL}/sessions/${sessionId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approved: false, feedback: feedbackText }),
      })
    } finally {
      setLoading(false)
      onApproved()
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        background: 'rgba(7,9,18,0.88)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 16px',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 680,
          background: '#0d0f1a',
          border: `1px solid ${accent}4d`,
          borderRadius: 12,
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '18px 24px 14px',
            borderBottom: `1px solid ${accent}22`,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: accent,
              boxShadow: `0 0 8px ${accent}`,
              flexShrink: 0,
            }}
          />
          <div>
            <span style={{ color: accent, fontWeight: 700, fontSize: 13, letterSpacing: '.06em' }}>
              {roomName}
            </span>
            <span style={{ color: 'rgba(200,196,240,0.5)', fontSize: 12, marginLeft: 10 }}>
              Review Required
            </span>
          </div>
        </div>

        {/* Content area */}
        <div style={{ padding: '16px 24px' }}>
          <div
            style={{
              fontSize: 10,
              color: 'rgba(180,176,240,0.5)',
              fontWeight: 700,
              letterSpacing: '.1em',
              textTransform: 'uppercase',
              marginBottom: 8,
            }}
          >
            Artifact Content
          </div>
          <pre
            style={{
              background: '#080a14',
              border: '1px solid rgba(123,110,232,0.15)',
              borderRadius: 8,
              padding: '14px 16px',
              fontFamily: 'monospace',
              fontSize: 12,
              color: '#C8C4E4',
              lineHeight: 1.6,
              overflowY: 'auto',
              maxHeight: 300,
              margin: 0,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {content}
          </pre>
        </div>

        {/* Action buttons */}
        {!showRejectForm ? (
          <div
            style={{
              padding: '8px 24px 20px',
              display: 'flex',
              gap: 12,
            }}
          >
            <button
              onClick={handleApprove}
              disabled={loading}
              style={{
                background: loading ? 'rgba(28,200,160,0.1)' : 'rgba(28,200,160,0.18)',
                border: '1px solid rgba(28,200,160,0.45)',
                borderRadius: 8,
                padding: '9px 22px',
                color: '#1CC8A0',
                fontSize: 13,
                fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                opacity: loading ? 0.6 : 1,
              }}
            >
              {loading ? (
                <span
                  style={{
                    display: 'inline-block',
                    width: 12,
                    height: 12,
                    border: '2px solid #1CC8A0',
                    borderTopColor: 'transparent',
                    borderRadius: '50%',
                    animation: 'spin 0.7s linear infinite',
                  }}
                />
              ) : (
                '✓'
              )}
              Approve
            </button>

            <button
              onClick={() => setShowRejectForm(true)}
              disabled={loading}
              style={{
                background: 'rgba(232,93,64,0.12)',
                border: '1px solid rgba(232,93,64,0.4)',
                borderRadius: 8,
                padding: '9px 22px',
                color: '#E85D40',
                fontSize: 13,
                fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.6 : 1,
              }}
            >
              ✗ Reject
            </button>
          </div>
        ) : (
          <div style={{ padding: '8px 24px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <textarea
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              placeholder="Tell the agents what to change..."
              rows={4}
              style={{
                background: '#080a14',
                border: '1px solid rgba(232,93,64,0.3)',
                borderRadius: 8,
                padding: '10px 14px',
                color: '#EAE8F5',
                fontSize: 12,
                fontFamily: 'inherit',
                lineHeight: 1.6,
                resize: 'vertical',
                outline: 'none',
              }}
            />
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={handleRejectSubmit}
                disabled={loading}
                style={{
                  background: loading ? 'rgba(232,93,64,0.08)' : 'rgba(232,93,64,0.18)',
                  border: '1px solid rgba(232,93,64,0.45)',
                  borderRadius: 8,
                  padding: '9px 22px',
                  color: '#E85D40',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 7,
                  opacity: loading ? 0.6 : 1,
                }}
              >
                {loading ? (
                  <span
                    style={{
                      display: 'inline-block',
                      width: 12,
                      height: 12,
                      border: '2px solid #E85D40',
                      borderTopColor: 'transparent',
                      borderRadius: '50%',
                      animation: 'spin 0.7s linear infinite',
                    }}
                  />
                ) : null}
                Submit Feedback
              </button>
              <button
                onClick={() => setShowRejectForm(false)}
                disabled={loading}
                style={{
                  background: 'transparent',
                  border: '1px solid rgba(123,110,232,0.25)',
                  borderRadius: 8,
                  padding: '9px 16px',
                  color: 'rgba(180,176,240,0.6)',
                  fontSize: 13,
                  cursor: loading ? 'not-allowed' : 'pointer',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
