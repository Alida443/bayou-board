import { useState } from 'react'
import type { AppData } from '@shared/types'
import { fmt, fmtDateTime } from '../utils'
import { friendViews } from '../friendViews'

interface Props {
  data: AppData
  onOpen: (steamId: string) => void
}

export default function Players({ data, onOpen }: Props): React.ReactNode {
  const [steamId, setSteamId] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set())
  const [query, setQuery] = useState('')
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameDraft, setRenameDraft] = useState('')

  const views = friendViews(data).filter((v) =>
    v.friend.name.toLowerCase().includes(query.trim().toLowerCase())
  )

  const submit = async (): Promise<void> => {
    setError(null)
    setBusy(true)
    const result = await window.api.addFriend(steamId, name || undefined)
    setBusy(false)
    if (!result.ok) {
      setError(result.error ?? 'Could not add player.')
      return
    }
    setSteamId('')
    setName('')
  }

  const refreshOne = async (id: string): Promise<void> => {
    setBusyIds((s) => new Set(s).add(id))
    await window.api.refreshOne(id)
    setBusyIds((s) => {
      const next = new Set(s)
      next.delete(id)
      return next
    })
  }

  const remove = async (id: string): Promise<void> => {
    await window.api.removeFriend(id)
  }

  const startRename = (id: string, current: string): void => {
    setRenamingId(id)
    setRenameDraft(current)
  }

  const commitRename = async (id: string): Promise<void> => {
    const trimmed = renameDraft.trim()
    if (trimmed) await window.api.renameFriend(id, trimmed)
    setRenamingId(null)
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1 className="page-title">Players</h1>
          <p className="page-sub">
            Only these Steam IDs are ever looked up — random players are never tracked.
          </p>
        </div>
      </div>

      <div className="card">
        <h3>Add a friend</h3>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <input
            className="input"
            placeholder="Steam ID (17 digits, e.g. 76561198034167345)"
            value={steamId}
            onChange={(e) => setSteamId(e.target.value)}
            style={{ flex: 2, minWidth: 260 }}
          />
          <input
            className="input"
            placeholder="Nickname (optional)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{ flex: 1, minWidth: 160 }}
          />
          <button className="btn primary" onClick={() => void submit()} disabled={busy || !steamId.trim()}>
            {busy ? 'Adding…' : 'Add player'}
          </button>
        </div>
        {error && <p className="ferr" style={{ color: 'var(--danger)', margin: '10px 0 0' }}>{error}</p>}
        <p className="hint" style={{ marginTop: 12 }}>
          Steam IDs are the numbers on a profile URL (steamcommunity.com/profiles/76561198034167345).
          A player shows up here once they're visible on the Bayou Ledger.
        </p>
      </div>

      <div className="section">
        {views.length > 0 && (
          <input
            className="input"
            placeholder={`Search ${views.length} ${views.length === 1 ? 'player' : 'players'}…`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ marginBottom: 12, maxWidth: 320 }}
          />
        )}
        <div className="friend-list">
          {views.map((v) => {
            const l = v.latest
            return (
              <div key={v.friend.steamId} className="friend-row">
                <span className="fdot" style={{ background: v.friend.color }} />
                <span>
                  {renamingId === v.friend.steamId ? (
                    <input
                      className="input"
                      value={renameDraft}
                      autoFocus
                      onChange={(e) => setRenameDraft(e.target.value)}
                      onBlur={() => void commitRename(v.friend.steamId)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') void commitRename(v.friend.steamId)
                        if (e.key === 'Escape') setRenamingId(null)
                      }}
                    />
                  ) : (
                    <div className="fname" onDoubleClick={() => startRename(v.friend.steamId, v.friend.name)}>
                      {v.friend.name}
                    </div>
                  )}
                  <div className="fmeta">{v.friend.steamId}</div>
                </span>
                <div className="fstats">
                  <span>
                    MMR <b>{fmt(l?.mmr)}</b>
                  </span>
                  <span>
                    KD <b>{fmt(l?.kd, 2)}</b>
                  </span>
                  <span>
                    Kills <b>{fmt(l?.kills)}</b>
                  </span>
                  <span>
                    Bounty <b>{fmt(l?.bounty)}</b>
                  </span>
                  {v.friend.lastFetchedAt && (
                    <span style={{ fontSize: 11 }}>fetched {fmtDateTime(v.friend.lastFetchedAt)}</span>
                  )}
                </div>
                {v.friend.lastError && <div className="ferr">{v.friend.lastError}</div>}
                <div className="factions">
                  {!v.friend.demo && (
                    <button className="btn small" disabled={busyIds.has(v.friend.steamId)} onClick={() => void refreshOne(v.friend.steamId)}>
                      {busyIds.has(v.friend.steamId) ? '…' : 'Refresh'}
                    </button>
                  )}
                  <button className="btn small" onClick={() => startRename(v.friend.steamId, v.friend.name)}>
                    Rename
                  </button>
                  <button className="btn small" onClick={() => onOpen(v.friend.steamId)}>
                    View
                  </button>
                  <button className="btn small danger" onClick={() => void remove(v.friend.steamId)}>
                    Remove
                  </button>
                </div>
              </div>
            )
          })}
          {views.length === 0 && data.friends.length > 0 && (
            <p className="hint">No players match "{query}".</p>
          )}
        </div>
      </div>
    </div>
  )
}
