'use client'
import { useEffect, useRef, useState } from 'react'
import type { SSEEvent } from './types'
import { BACKEND_URL } from './config'

export type SSEStatus = 'connecting' | 'running' | 'done' | 'error'

const MAX_RETRIES = 3
const RETRY_DELAYS = [1000, 2000, 4000]
const MAX_EVENTS = 500

export function useSSE(sessionId: string | null) {
  const [events, setEvents] = useState<SSEEvent[]>([])
  const [status, setStatus] = useState<SSEStatus>('connecting')
  const esRef = useRef<EventSource | null>(null)

  useEffect(() => {
    if (!sessionId) return

    setEvents([])
    setStatus('connecting')

    let attempt = 0
    let destroyed = false

    function connect() {
      if (destroyed) return

      const es = new EventSource(`${BACKEND_URL}/run/${sessionId}`)
      esRef.current = es

      es.onmessage = (e) => {
        let event: SSEEvent
        try {
          event = JSON.parse(e.data)
        } catch (err) {
          console.error('[SSE] Failed to parse event:', e.data, err)
          return
        }
        setEvents((prev) => {
          const next = [...prev, event]
          return next.length > MAX_EVENTS ? next.slice(-MAX_EVENTS) : next
        })
        if (event.event === 'room_enter') setStatus('running')
        if (event.event === 'session_done') setStatus('done')
        if (event.event === 'error') setStatus('error')
      }

      es.onerror = () => {
        es.close()
        esRef.current = null
        if (destroyed) return
        if (attempt < MAX_RETRIES) {
          const delay = RETRY_DELAYS[attempt] ?? 4000
          attempt++
          setTimeout(connect, delay)
        } else {
          setStatus('error')
        }
      }
    }

    connect()

    return () => {
      destroyed = true
      esRef.current?.close()
      esRef.current = null
    }
  }, [sessionId])

  const connected = status === 'running'
  return { events, status, connected }
}
