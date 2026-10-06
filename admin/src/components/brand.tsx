export function Mountain({ className }: { className?: string }) {
  return (
    <svg viewBox="-2 -2 207 55" className={className} aria-hidden>
      <polyline points="0,51 42,22 74,37 115,0 135,16 143,11 203,51" fill="none" stroke="currentColor" strokeWidth="6" strokeLinejoin="round" />
    </svg>
  )
}

export function Wordmark({ className }: { className?: string }) {
  return <span className={`font-heading uppercase tracking-[0.08em] ${className ?? ''}`}>Yerevan</span>
}
