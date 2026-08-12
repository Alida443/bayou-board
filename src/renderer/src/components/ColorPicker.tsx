import { useEffect, useRef, useState } from 'react'

const SWATCHES = [
  '#ffffff',
  '#d7263d',
  '#e05b3d',
  '#ff8c42',
  '#e2b585',
  '#c1973e',
  '#a66b3d',
  '#9a4b13',
  '#6fe0a9',
  '#3fae6b',
  '#6d8970',
  '#5f8fc9',
  '#2f81f7',
  '#7dd3fc',
  '#8a6bb5',
  '#a83dd1',
  '#e0557d',
  '#f05266',
  '#e6e6e6',
  '#c0c0c0',
  '#9aa1a8',
  '#6b7278',
  '#34373c',
  '#1a1c20'
]

interface Props {
  value: string
  onChange: (color: string) => void
  label: string
}

export default function ColorPicker({ value, onChange, label }: Props): React.ReactNode {
  const [open, setOpen] = useState(false)
  const [hex, setHex] = useState(value.replace(/^#/, ''))
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setHex(value.replace(/^#/, ''))
  }, [value])

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent): void => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  const commit = (c: string): void => {
    onChange(c)
    setOpen(false)
  }

  const submitHex = (): void => {
    if (/^[0-9a-f]{6}$/i.test(hex)) commit(`#${hex.toLowerCase()}`)
  }

  return (
    <div className="cp" ref={ref}>
      <button
        type="button"
        className="cp-swatch"
        style={{ background: value }}
        aria-label={label}
        onClick={() => setOpen((o) => !o)}
      />
      {open && (
        <div className="cp-pop">
          <div className="cp-grid">
            {SWATCHES.map((c) => (
              <button
                key={c}
                type="button"
                className={`cp-cell${c.toLowerCase() === value.toLowerCase() ? ' sel' : ''}`}
                style={{ background: c }}
                aria-label={c}
                onClick={() => commit(c)}
              />
            ))}
          </div>
          <form
            className="cp-hex"
            onSubmit={(e) => {
              e.preventDefault()
              submitHex()
            }}
          >
            <span className="cp-hash">#</span>
            <input
              className="input cp-input"
              value={hex}
              onChange={(e) => setHex(e.target.value.replace(/[^0-9a-fA-F]/g, '').slice(0, 6))}
              spellCheck={false}
              autoComplete="off"
            />
            <button type="submit" className="btn small">
              OK
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
