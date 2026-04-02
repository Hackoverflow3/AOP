// Appears outside a room door when artifact is ready
interface DownloadButtonProps {
  filename: string
  sessionId: string
  roomId: string
}
export default function DownloadButton({ filename, sessionId, roomId }: DownloadButtonProps) {
  const href = `http://localhost:8000/artifacts/${sessionId}/download/${filename}`
  return (
    <a href={href} download style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      background: 'rgba(28,200,160,0.14)', border: '0.5px solid rgba(28,200,160,0.4)',
      borderRadius: 7, padding: '6px 12px', color: '#1CC8A0', fontSize: 12, textDecoration: 'none',
    }}>
      ↓ {filename}
    </a>
  )
}
