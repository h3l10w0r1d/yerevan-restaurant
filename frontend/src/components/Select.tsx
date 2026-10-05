import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'

export type Option<T> = { value: T; label: string }

type Props<T> = {
  label: string
  value: T
  options: Option<T>[]
  onChange: (value: T) => void
}

// Select-only combobox (WAI-ARIA APG pattern): focus stays on the trigger,
// the highlighted option is announced via aria-activedescendant.
export function Select<T extends string | number>({ label, value, options, onChange }: Props<T>) {
  const id = useId()
  const [open, setOpen] = useState(false)
  const selectedIndex = Math.max(0, options.findIndex((o) => o.value === value))
  const [active, setActive] = useState(selectedIndex)
  const rootRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const typed = useRef({ text: '', at: 0 })

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [open])

  useEffect(() => {
    if (open) listRef.current?.children[active]?.scrollIntoView({ block: 'nearest' })
  }, [open, active])

  const openList = (index = selectedIndex) => {
    setActive(index)
    setOpen(true)
  }
  const choose = (index: number) => {
    onChange(options[index].value)
    setOpen(false)
  }
  const clamp = (i: number) => Math.min(options.length - 1, Math.max(0, i))

  function onKeyDown(e: KeyboardEvent) {
    const keys: Record<string, () => void> = {
      ArrowDown: () => (open ? setActive((i) => clamp(i + 1)) : openList()),
      ArrowUp: () => (open ? setActive((i) => clamp(i - 1)) : openList()),
      Home: () => (open ? setActive(0) : openList(0)),
      End: () => (open ? setActive(options.length - 1) : openList(options.length - 1)),
      PageDown: () => open && setActive((i) => clamp(i + 5)),
      PageUp: () => open && setActive((i) => clamp(i - 5)),
      Enter: () => (open ? choose(active) : openList()),
      ' ': () => (open ? choose(active) : openList()),
      Escape: () => setOpen(false),
    }
    if (e.key === 'Tab') {
      if (open) choose(active)
      return
    }
    if (keys[e.key]) {
      e.preventDefault()
      keys[e.key]()
      return
    }
    // Type-ahead: jump to the first option whose label starts with what was typed.
    if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
      const now = Date.now()
      typed.current.text = (now - typed.current.at > 600 ? '' : typed.current.text) + e.key.toLowerCase()
      typed.current.at = now
      const match = options.findIndex((o) => o.label.toLowerCase().startsWith(typed.current.text))
      if (match >= 0) {
        if (open) setActive(match)
        else onChange(options[match].value)
      }
    }
  }

  return (
    <div className={`select ${open ? 'select--open' : ''}`} ref={rootRef}>
      <span className="field__label" id={`${id}-label`}>{label}</span>
      <button
        type="button"
        role="combobox"
        className="select__trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-labelledby={`${id}-label ${id}-value`}
        aria-activedescendant={open ? `${id}-opt-${active}` : undefined}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={onKeyDown}
      >
        <span id={`${id}-value`}>{options[selectedIndex]?.label}</span>
        <svg className="select__chevron" viewBox="0 0 12 8" aria-hidden>
          <polyline points="1,1.5 6,6.5 11,1.5" fill="none" stroke="currentColor" strokeWidth="1.2" />
        </svg>
      </button>
      <ul
        className="select__list"
        id={`${id}-list`}
        role="listbox"
        aria-labelledby={`${id}-label`}
        tabIndex={-1}
        ref={listRef}
        hidden={!open}
      >
        {options.map((o, i) => (
          <li
            key={String(o.value)}
            id={`${id}-opt-${i}`}
            role="option"
            aria-selected={i === selectedIndex}
            className={`select__option ${i === active ? 'select__option--active' : ''}`}
            onPointerEnter={() => setActive(i)}
            onPointerDown={(e) => e.preventDefault() /* keep focus on the trigger */}
            onClick={() => choose(i)}
          >
            {o.label}
            {i === selectedIndex && (
              <svg className="select__check" viewBox="0 0 12 10" aria-hidden>
                <polyline points="1,5 4.5,8.5 11,1.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
              </svg>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
