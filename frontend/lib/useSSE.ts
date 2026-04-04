'use client'
import { useEffect, useRef, useState } from 'react'
import type { SSEEvent } from './types'
import { BACKEND_URL } from './config'

export type SSEStatus = 'connecting' | 'running' | 'done' | 'error'

export function useSSE(sessionId: string | null) {
  const [events, setEvents] = useState<SSEEvent[]>([])
  const [status, setStatus] = useState<SSEStatus>('connecting')
  const esRef = useRef<EventSource | null>(null)

  useEffect(() => {
    if (!sessionId) return

    setEvents([])
    setStatus('connecting')

    const es = new EventSource(`${BACKEND_URL}/run/${sessionId}`)
    esRef.current = es

    es.onmessage = (e) => {
      try {
        const event: SSEEvent = JSON.parse(e.data)
        setEvents((prev) => [...prev, event])
        if (event.event === 'room_enter') setStatus('running')
        if (event.event === 'session_done') setStatus('done')
        if (event.event === 'error') setStatus('error')
      } catch { /* ignore parse errors */ }
    }

    es.onerror = () => {
      es.close()
      setStatus('error')
    }

    return () => {
      es.close()
    }
  }, [sessionId])

  // connected is derived from status for backwards compat
  const connected = status === 'running'

  return { events, status, connected }
}
