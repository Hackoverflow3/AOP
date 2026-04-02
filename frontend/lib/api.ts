import type { Session, Artifact } from './types'

const BASE = '/api'

export async function createSession(title: string, task: string): Promise<Session> {
  const res = await fetch(`${BASE}/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, task }),
  })
  return res.json()
}

export async function listSessions(): Promise<Session[]> {
  const res = await fetch(`${BASE}/sessions`)
  return res.json()
}

export async function getSession(id: string): Promise<Session> {
  const res = await fetch(`${BASE}/sessions/${id}`)
  return res.json()
}

export async function listArtifacts(sessionId: string): Promise<Artifact[]> {
  const res = await fetch(`${BASE}/artifacts/${sessionId}`)
  return res.json()
}
