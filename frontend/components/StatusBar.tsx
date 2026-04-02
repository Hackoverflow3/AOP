// Live token counter + active provider badge
interface StatusBarProps {
  tokens: number
  provider: string
  room: string
}
export default function StatusBar({ tokens, provider, room }: StatusBarProps) {
  return (
    <div style={{ display: 'flex', gap: 16, fontSize: 11, color: '#5A5870', padding: '8px 16px' }}>
      <span>Room: <b style={{ color: '#EAE8F5' }}>{room}</b></span>
      <span>Provider: <b style={{ color: '#7B6EE8' }}>{provider}</b></span>
      <span>Tokens: <b style={{ color: '#EAE8F5' }}>{tokens.toLocaleString()}</b></span>
      <span>Cost: <b style={{ color: '#1CC8A0' }}>$0.00</b></span>
    </div>
  )
}
