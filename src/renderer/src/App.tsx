import { useEffect, useMemo, useState } from 'react'
import type { AppData, PollStatus } from '@shared/types'
import Sidebar, { type View } from './components/Sidebar'
import Dashboard from './views/Dashboard'
import Players from './views/Players'
import PlayerDetail from './views/PlayerDetail'
import Settings from './views/Settings'
import './styles.css'

function viewFromHash(): View {
  const h = window.location.hash.replace(/^#\/?/, '')
  const [seg, param] = h.split('/')
  if (seg === 'players') return { kind: 'players' }
  if (seg === 'settings') return { kind: 'settings' }
  if (seg === 'player' && param) return { kind: 'player', steamId: param }
  return { kind: 'dashboard' }
}

export default function App(): React.ReactNode {
  const [data, setData] = useState<AppData | null>(null)
  const [view, setView] = useState<View>(viewFromHash)
  const [poll, setPoll] = useState<PollStatus | null>(null)

  useEffect(() => {
    let mounted = true
    void window.api.getData().then((d) => {
      if (mounted) setData(d)
    })
    const offData = window.api.onData((d) => setData(d))
    const offPoll = window.api.onPoll((s) => setPoll(s))
    return () => {
      mounted = false
      offData()
      offPoll()
    }
  }, [])

  const friendIds = useMemo(
    () => new Set((data?.friends ?? []).map((f) => f.steamId)),
    [data]
  )

  useEffect(() => {
    if (view.kind === 'player' && data && !friendIds.has(view.steamId)) {
      setView({ kind: 'dashboard' })
    }
  }, [view, data, friendIds])

  if (!data) {
    return (
      <div className="empty" style={{ height: '100vh', display: 'grid', placeItems: 'center' }}>
        Loading…
      </div>
    )
  }

  const refreshAll = (): Promise<void> => window.api.refreshAll()

  return (
    <div className="app">
      <Sidebar view={view} setView={setView} poll={poll} />
      <main className="main">
        {view.kind === 'dashboard' && (
          <Dashboard
            data={data}
            onRefresh={() => void refreshAll()}
            onOpen={(steamId) => setView({ kind: 'player', steamId })}
            onGoAdd={() => setView({ kind: 'players' })}
          />
        )}
        {view.kind === 'players' && (
          <Players data={data} onOpen={(steamId) => setView({ kind: 'player', steamId })} />
        )}
        {view.kind === 'player' && (
          <PlayerDetail
            data={data}
            steamId={view.steamId}
            onBack={() => setView({ kind: 'players' })}
          />
        )}
        {view.kind === 'settings' && <Settings data={data} onRefresh={() => void refreshAll()} />}
      </main>
    </div>
  )
}
