'use client'

interface CooldownBannerProps {
  secondsLeft: number
  nextRoom: string
}

export default function CooldownBanner({ secondsLeft, nextRoom }: CooldownBannerProps) {
  if (secondsLeft <= 0) return null

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 48,
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 6,
        zIndex: 25,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          background: 'rgba(13,15,26,0.92)',
          border: '1px solid rgba(245,166,35,0.4)',
          borderRadius: 20,
          padding: '7px 18px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          boxShadow: '0 0 12px rgba(245,166,35,0.15)',
        }}
      >
        <span style={{ fontSize: 13 }}>⏱</span>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: '#F5A623',
            letterSpacing: '.05em',
            whiteSpace: 'nowrap',
          }}
        >
          Cooling down — entering {nextRoom} in {secondsLeft}s
        </span>
      </div>

      {/* Progress bar */}
      <div
        style={{
          width: 160,
          height: 3,
          background: 'rgba(245,166,35,0.15)',
          borderRadius: 2,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            background: '#F5A623',
            borderRadius: 2,
            width: `${Math.min(100, (secondsLeft / 10) * 100)}%`,
            transition: 'width 1s linear',
          }}
        />
      </div>
    </div>
  )
}
