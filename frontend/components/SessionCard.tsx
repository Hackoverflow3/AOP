// Single session row in /dashboard
interface SessionCardProps {
  id: string
  title: string
  status: string
  createdAt: string
}
export default function SessionCard({ id, title, status, createdAt }: SessionCardProps) {
  return (
    <a href={`/run/${id}`} style={{ display: 'block', textDecoration: 'none' }}>
      <div style={{ border: '0.5px solid rgba(123,110,232,0.18)', borderRadius: 8, padding: 14 }}>
        <div style={{ fontWeight: 600, color: '#EAE8F5' }}>{title}</div>
        <div style={{ fontSize: 11, color: '#5A5870', marginTop: 4 }}>{status} · {createdAt}</div>
      </div>
    </a>
  )
}
