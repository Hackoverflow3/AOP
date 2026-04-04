export default function ArtifactsPage() {
  return (
    <div style={{ background: '#07090D', minHeight: '100vh', color: '#EAE8F5', fontFamily: 'inherit', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
      <div style={{ fontSize: 32, opacity: 0.15 }}>📁</div>
      <h2 style={{ fontSize: 18, fontWeight: 700, color: '#EAE8F8', margin: 0 }}>Artifacts</h2>
      <p style={{ fontSize: 13, color: '#5A5870', margin: 0 }}>Browse and re-download all session outputs — coming soon</p>
      <a href="/dashboard" style={{ fontSize: 12, color: '#8B7CF8', textDecoration: 'none', marginTop: 8, fontWeight: 600 }}>← Back to Dashboard</a>
    </div>
  )
}
