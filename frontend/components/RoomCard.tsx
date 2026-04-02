// Shows a room's current status in the /run/[id] page sidebar
interface RoomCardProps {
  roomId: string
  name: string
  status: 'pending' | 'running' | 'done'
  artifact?: string
}
export default function RoomCard({ roomId, name, status, artifact }: RoomCardProps) {
  return (
    <div style={{ border: '0.5px solid rgba(123,110,232,0.2)', borderRadius: 8, padding: 12 }}>
      <div style={{ fontWeight: 600 }}>Room {roomId} — {name}</div>
      <div style={{ fontSize: 12, color: status === 'done' ? '#1CC8A0' : '#5A5870' }}>{status}</div>
      {artifact && <div style={{ fontSize: 11, marginTop: 4 }}>{artifact}</div>}
    </div>
  )
}
