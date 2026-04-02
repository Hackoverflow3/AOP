export type RoomId = 'A' | 'B' | 'C' | 'D'
export type SessionStatus = 'pending' | 'running' | 'done' | 'failed'

export interface Session {
  id: string
  title: string
  task: string
  status: SessionStatus
  created_at: string
  updated_at: string
}

export interface RoomRun {
  id: string
  session_id: string
  room_id: RoomId
  status: SessionStatus
  llm_provider?: string
  llm_calls: number
}

export interface Artifact {
  id: string
  session_id: string
  room_id: RoomId
  filename: string
  file_path: string
  created_at: string
}

export interface SSEEvent {
  event: 'room_enter' | 'room_done' | 'message' | 'artifact_ready' | 'session_done' | 'error'
  room?: RoomId
  agent?: string
  content?: string
  filename?: string
  /** @deprecated use filename — kept for backwards compat with older backend builds */
  artifact?: string
}
