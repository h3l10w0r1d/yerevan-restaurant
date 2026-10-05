// The Yerevan mark: Ararat's two peaks as one drawn line over a Didone wordmark.
type Props = { variant?: 'primary' | 'wordmark' | 'mountain'; className?: string; title?: string }

const MOUNTAIN = '0,51 42,22 74,37 115,0 135,16 143,11 203,51'

export function Logo({ variant = 'primary', className, title = 'Yerevan restaurant' }: Props) {
  if (variant === 'mountain') {
    return (
      <svg className={className} viewBox="-2 -2 207 55" role="img" aria-label={title}>
        <polyline points={MOUNTAIN} fill="none" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" />
      </svg>
    )
  }
  const primary = variant === 'primary'
  return (
    <svg className={className} viewBox={primary ? '0 -2 546 224' : '0 70 546 96'} role="img" aria-label={title}>
      {primary && (
        <polyline
          points={MOUNTAIN}
          transform="translate(171 0)"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
      )}
      <text
        x="273" y="161" textAnchor="middle" textLength="540" lengthAdjust="spacingAndGlyphs"
        fill="currentColor" fontFamily="'Bodoni Moda', 'Didot', serif" fontSize="124" fontWeight="400"
        style={{ fontVariationSettings: "'opsz' 96" }}
      >
        YEREVAN
      </text>
      {primary && (
        <text
          x="273" y="209" textAnchor="middle" fill="currentColor"
          fontFamily="'Bodoni Moda', 'Didot', serif" fontSize="46" fontWeight="600" letterSpacing="2"
        >
          restaurant
        </text>
      )}
    </svg>
  )
}
