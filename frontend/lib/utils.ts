export const ROOM_NAMES: Record<string, string> = {
  A: 'War Room',
  B: 'Ideation Hive',
  C: 'The Forge',
  D: 'Observatory',
}

export const ROOM_ARTIFACTS: Record<string, string> = {
  A: 'PROJECT_MANIFEST.md',
  B: 'BRAINSTORM_LOG.md',
  C: 'TECHNICAL_SPEC_V1.json',
  D: 'FINAL_DELIVERY_REPORT.md',
}

export const AGENT_COLORS: Record<string, string> = {
  Director:  '#7B6EE8',
  Architect: '#1CC8A0',
  'The Dev': '#F5A623',
  Catalyst:  '#E85D40',
}

export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}
