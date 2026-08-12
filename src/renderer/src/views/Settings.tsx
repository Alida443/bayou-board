import { useEffect, useState } from 'react'
import type { AppData } from '@shared/types'
import { fmtDateTime } from '../utils'
import ColorPicker from '../components/ColorPicker'

interface Props {
  data: AppData
  onRefresh: () => void
}

export default function Settings({ data, onRefresh }: Props): React.ReactNode {
  const [minutes, setMinutes] = useState(String(data.settings.refreshMinutes))
  const [auto, setAuto] = useState(data.settings.autoRefresh)
  const [alert, setAlert] = useState(String(data.settings.mmrAlertThreshold ?? 0))
  const [saved, setSaved] = useState(false)
  const [login, setLogin] = useState(false)
  const [backupMsg, setBackupMsg] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    void window.api.getLoginItem().then((v) => {
      if (mounted) setLogin(v)
    })
    return () => {
      mounted = false
    }
  }, [])

  const poll = data.settings.pollStatus

  const save = async (): Promise<void> => {
    setSaved(false)
    const n = Math.max(2, Math.round(Number(minutes)) || 30)
    const a = Math.max(0, Math.round(Number(alert)) || 0)
    await window.api.updateSettings({ refreshMinutes: n, autoRefresh: auto, mmrAlertThreshold: a })
    setMinutes(String(n))
    setAlert(String(a))
    setSaved(true)
    setTimeout(() => setSaved(false), 1800)
  }

  const loadDemo = async (): Promise<void> => {
    await window.api.loadDemo()
  }
  const clearDemo = async (): Promise<void> => {
    await window.api.clearDemo()
  }

  const exportData = async (): Promise<void> => {
    const r = await window.api.exportData()
    setBackupMsg(r.ok ? `Saved to ${r.path}` : r.canceled ? null : `Export failed: ${r.error ?? ''}`)
  }

  const importData = async (): Promise<void> => {
    const r = await window.api.importData()
    setBackupMsg(
      r.ok
        ? `Imported ${r.count?.friends ?? 0} players and ${r.count?.snapshots ?? 0} snapshots.`
        : r.canceled
          ? null
          : `Import failed: ${r.error ?? ''}`
    )
  }

  const toggleLogin = async (): Promise<void> => {
    setLogin(await window.api.setLoginItem(!login))
  }

  const demoCount = data.friends.filter((f) => f.demo).length

  return (
    <div>
      <div className="page-head">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-sub">How Bayou Board pulls and stores your squad's stats.</p>
        </div>
      </div>

      <div className="card">
        <h3>Auto refresh</h3>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
          <label className="hint" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} />
            Poll the Bayou Ledger automatically
          </label>
          <label className="hint" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            Every
            <input
              className="input"
              type="number"
              min={2}
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
              style={{ width: 80 }}
            />
            minutes
          </label>
          <label className="hint" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            Alert me when MMR changes by at least
            <input
              className="input"
              type="number"
              min={0}
              value={alert}
              onChange={(e) => setAlert(e.target.value)}
              style={{ width: 70 }}
            />
            (0 = off)
          </label>
          <button className="btn primary" onClick={() => void save()}>
            Save
          </button>
          {saved && <span className="hint">Saved ✓</span>}
        </div>
      </div>

      <div className="card section">
        <h3>Player colors</h3>
        <p className="hint" style={{ marginTop: 0 }}>
          Give each player a distinct color so the curves and dots on the board are easy to tell apart.
        </p>
        {data.friends.length === 0 ? (
          <p className="hint">No players yet — colors appear here once you add Steam IDs.</p>
        ) : (
          <div className="color-list">
            {data.friends.map((f) => (
              <div key={f.steamId} className="color-row">
                <span className="friend-dot" style={{ background: f.color }} />
                <span className="color-name">{f.name}</span>
                <ColorPicker
                  value={f.color}
                  onChange={(c) => void window.api.setFriendColor(f.steamId, c)}
                  label={`Color for ${f.name}`}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card section">
        <h3>Status</h3>
        <div className="hint" style={{ marginTop: 0 }}>
          {poll?.state === 'polling' ? (
            <>
              <span className="spinner" style={{ verticalAlign: 'middle', marginRight: 8 }} />
              {poll.message ?? 'Checking stats…'}
            </>
          ) : poll?.lastPollAt ? (
            <>Last refresh: {fmtDateTime(poll.lastPollAt)}</>
          ) : (
            'No refresh yet.'
          )}
        </div>
        <div style={{ marginTop: 12 }}>
          <button className="btn" onClick={onRefresh}>
            Refresh all now
          </button>
        </div>
      </div>

      <div className="card section">
        <h3>Backup & restore</h3>
        <p className="hint" style={{ marginTop: 0 }}>
          Export everything (players, colors, and snapshot history) to a JSON file, or restore
          from a previous backup. Handy before reinstalling or moving to another PC.
        </p>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn" onClick={() => void exportData()}>
            Export data…
          </button>
          <button className="btn" onClick={() => void importData()}>
            Import data…
          </button>
        </div>
        {backupMsg && <p className="hint" style={{ margin: '10px 0 0' }}>{backupMsg}</p>}
      </div>

      <div className="card section">
        <h3>Demo data</h3>
        <p className="hint" style={{ marginTop: 0 }}>
          {demoCount > 0
            ? `${demoCount} demo players on the board. Remove them any time.`
            : 'Load a few generated players so you can see the graphs working immediately.'}
        </p>
        <div style={{ display: 'flex', gap: 10 }}>
          {demoCount > 0 ? (
            <button className="btn danger" onClick={() => void clearDemo()}>
              Remove demo data
            </button>
          ) : (
            <button className="btn" onClick={() => void loadDemo()}>
              Load demo data
            </button>
          )}
        </div>
      </div>

      <div className="card section">
        <h3>Data & privacy</h3>
        <div className="hint" style={{ marginTop: 0 }}>
          <p>
            Stats come from{' '}
            <a className="link" href="https://bayouledger.com" target="_blank" rel="noreferrer">
              The Bayou Ledger
            </a>
            , a fan-made tracker that mirrors each player's public in-game stats by Steam ID. Bayou
            Board only ever requests the players you add — it never browses the lobby for strangers.
          </p>
          <p>
            Everything is stored locally in this app's data folder. Nothing is uploaded by Bayou
            Board itself.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <button className="btn" onClick={() => void window.api.openDataFolder()}>
            Open data folder
          </button>
          <label className="hint" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" checked={login} onChange={() => void toggleLogin()} />
            Launch Bayou Board at Windows login
          </label>
        </div>
      </div>

      <div className="card section">
        <h3>Credits</h3>
        <div className="hint" style={{ marginTop: 0 }}>
          <p>Concept and design by Alida.</p>
          <p>
            Stats powered by{' '}
            <a className="link" href="https://bayouledger.com" target="_blank" rel="noreferrer">
              The Bayou Ledger
            </a>
            , a fan-made tracker of Hunt: Showdown 1896 stats.
          </p>
          <p>Hunt: Showdown is a trademark of Crytek GmbH.</p>
        </div>
      </div>

      <div className="warn section">
        <strong>Not affiliated with Crytek.</strong> Hunt: Showdown is a trademark of Crytek GmbH.
        Bayou Board is an unofficial personal tool; the Bayou Ledger could change or disappear, in
        which case your history and graphs stay safe in the data folder.
      </div>
    </div>
  )
}
