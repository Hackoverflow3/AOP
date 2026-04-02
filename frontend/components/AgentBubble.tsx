// Thought cloud bubble rendered above an agent's head
interface AgentBubbleProps {
  text: string
  agentColor: string
  agentLabel: string
}
export default function AgentBubble({ text, agentColor, agentLabel }: AgentBubbleProps) {
  return (
    <div>
      <div style={{ background: 'rgba(234,230,255,0.93)', borderRadius: 12, padding: '8px 10px' }}>
        <span style={{ fontSize: 9.5, color: '#1A1360', fontWeight: 500 }}>{text}</span>
      </div>
      <span style={{ fontSize: 8, fontWeight: 700, color: agentColor, textTransform: 'uppercase' }}>
        {agentLabel}
      </span>
    </div>
  )
}
