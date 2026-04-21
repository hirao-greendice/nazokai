import { useEffect, useEffectEvent, useState } from 'react'

import './App.css'
import {
  PRESENCE_HEARTBEAT_MS,
  clearSelection,
  getDeviceId,
  publishSelection,
  readStoredSelection,
  storeSelection,
  subscribeToOccupiedTeams,
  type ControlRole,
  type Selection,
} from './lib/presence'

const controlButtons: Array<{ label: string; role: ControlRole }> = [
  { label: 'SCREEN', role: 'screen' },
  { label: 'STAFF', role: 'staff' },
  { label: 'MASTER', role: 'master' },
]
const playerButtons = Array.from({ length: 12 }, (_, index) => index + 1)

function PlayerScreen({
  teamNumber,
  occupiedTeams,
  onBack,
}: {
  teamNumber: number
  occupiedTeams: Set<number>
  onBack: () => void
}) {
  const occupiedTeamList = Array.from(occupiedTeams).sort((left, right) => left - right)

  return (
    <main className="player-screen">
      <section className="player-card">
        <p className="player-screen-label">PLAYER</p>
        <h1>TEAM {teamNumber}</h1>
        <p className="player-screen-message">
          プレイヤー画面の仮表示です。Firebase への接続確認用に表示しています。
        </p>

        <div className="player-status-list" aria-label="connection status">
          <p>
            接続状態:
            <strong> 送信中 </strong>
          </p>
          <p>
            端末ID:
            <strong> {getDeviceId()}</strong>
          </p>
          <p>
            使用中チーム:
            <strong>{occupiedTeamList.length > 0 ? ` ${occupiedTeamList.join(', ')}` : ' なし'}</strong>
          </p>
        </div>

        <p className="player-screen-hint">
          別タブで最初の画面を開いて、このチーム番号が黄色になれば通信できています。
        </p>

        <button type="button" className="back-button" onClick={onBack}>
          トップに戻る
        </button>
      </section>
    </main>
  )
}

function App() {
  const [selection, setSelection] = useState<Selection | null>(() => {
    if (typeof window === 'undefined') {
      return null
    }

    return readStoredSelection()
  })
  const [occupiedTeams, setOccupiedTeams] = useState<Set<number>>(new Set())

  const syncSelection = useEffectEvent((nextSelection: Selection | null) => {
    if (!nextSelection) {
      void clearSelection()
      return
    }

    void publishSelection(nextSelection)
  })

  useEffect(() => {
    const unsubscribe = subscribeToOccupiedTeams(setOccupiedTeams)
    return unsubscribe
  }, [])

  useEffect(() => {
    storeSelection(selection)
    syncSelection(selection)

    if (!selection) {
      return
    }

    const timerId = window.setInterval(() => {
      syncSelection(selection)
    }, PRESENCE_HEARTBEAT_MS)

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        syncSelection(selection)
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.clearInterval(timerId)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [selection])

  const handlePlayerClick = (teamNumber: number) => {
    setSelection({ role: 'player', teamNumber })
  }

  const handleControlClick = (role: ControlRole) => {
    setSelection((currentSelection) => {
      if (currentSelection?.role === role) {
        return null
      }

      return { role }
    })
  }

  if (selection?.role === 'player') {
    return (
      <PlayerScreen
        teamNumber={selection.teamNumber}
        occupiedTeams={occupiedTeams}
        onBack={() => setSelection(null)}
      />
    )
  }

  return (
    <main className="start-screen">
      <section className="player-area" aria-label="player selection">
        <div className="player-grid">
          {playerButtons.map((playerNumber) => (
            <button
              key={playerNumber}
              type="button"
              className={[
                'player-button',
                occupiedTeams.has(playerNumber) ? 'is-occupied' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              aria-label={`Player ${playerNumber}`}
              onClick={() => handlePlayerClick(playerNumber)}
            >
              {playerNumber}
            </button>
          ))}
        </div>
      </section>

      <aside className="control-area" aria-label="system controls">
        <div className="control-buttons">
          {controlButtons.map(({ label, role }) => (
            <button
              key={role}
              type="button"
              className={[
                'control-button',
                selection?.role === role ? 'is-selected' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => handleControlClick(role)}
            >
              {label}
            </button>
          ))}
        </div>
      </aside>
    </main>
  )
}

export default App
