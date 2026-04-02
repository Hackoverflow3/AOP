// Card on /artifacts page showing a downloadable file
interface ArtifactCardProps {
  filename: string
  roomId: string
  sessionId: string
  createdAt: string
}
export default function ArtifactCard({ filename, roomId, sessionId, createdAt }: ArtifactCardProps) {
  return (
    <div style={{ border: '0.5px solid rgba(123,110,232,0.18)', borderRadius: 8, padding: 14 }}>
      <div style={{ fontWeight: 600, color: '#EAE8F5' }}>{filename}</div>
      <div style={{ fontSize: 11, color: '#5A5870', marginTop: 4 }}>Room {roomId} · {createdAt}</div>
      <a href={`/api/artifacts/${sessionId}/download/${filename}`} download
        style={{ fontSize: 11, color: '#1CC8A0', marginTop: 8, display: 'inline-block' }}>
        Download ↓
      </a>
    </div>
  )
}
