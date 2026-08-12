import { useEffect, useState } from 'react'
import type { PollStatus } from '@shared/types'
import { fmtDateTime } from '../utils'
import huntLogo from '../assets/hunt-logo.png'

export type View =
  | { kind: 'dashboard' }
  | { kind: 'players' }
  | { kind: 'player'; steamId: string }
  | { kind: 'settings' }

interface Props {
  view: View
  setView: (v: View) => void
  poll: PollStatus | null
}

export default function Sidebar({ view, setView, poll }: Props): React.ReactNode {
  const polling = poll?.state === 'polling'
  const [version, setVersion] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    void window.api.getVersion().then((v) => {
      if (mounted) setVersion(v)
    })
    return () => {
      mounted = false
    }
  }, [])
  return (
    <aside className="sidebar">
      <div className="brand">
        <img src={huntLogo} alt="Hunt: Showdown" className="brand-sigil" />
        <div className="brand-name">
          BAYOU BOARD
          <small>hunt squad tracker</small>
        </div>
      </div>

      <nav className="nav">
        <button
          className={view.kind === 'dashboard' ? 'active' : ''}
          onClick={() => setView({ kind: 'dashboard' })}
        >
          <span className="dot" />
          Dashboard
        </button>
        <button
          className={view.kind === 'players' || view.kind === 'player' ? 'active' : ''}
          onClick={() => setView({ kind: 'players' })}
        >
          <span className="dot" />
          Players
        </button>
        <button className={view.kind === 'settings' ? 'active' : ''} onClick={() => setView({ kind: 'settings' })}>
          <span className="dot" />
          Settings
        </button>
      </nav>

      <div className="sidebar-foot">
        <div className="poll-line">
          {polling && <span className="spinner" />}
          <span>
            {polling
              ? (poll?.message ?? 'Checking stats…')
              : poll?.lastPollAt
                ? `Updated ${fmtDateTime(poll.lastPollAt)}`
                : 'Waiting for first refresh'}
          </span>
        </div>
        {poll?.state === 'error' && poll.lastError && (
          <div style={{ color: 'var(--danger)', fontSize: 11.5 }}>{poll.lastError}</div>
        )}
        <div className="version-line">
          <span className="ver">v{version ?? '…'}</span>
          <span className="ver-by">
            concept &amp; design by <b>Alida</b>
          </span>
        </div>
      </div>
    </aside>
  )
}
