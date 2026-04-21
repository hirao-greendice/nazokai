import { useEffect, useState } from 'react'

import './App.css'
import { hasRealtimeDatabaseConfig, realtimeDatabaseConfigHint } from './lib/firebase'
import {
  bindSelectionPresence,
  clearSelectionPresence,
  getDeviceId,
  getSessionId,
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

function StatusBanner({
  isRealtimeConnected,
  presenceError,
}: {
  isRealtimeConnected: boolean
  presenceError: string | null
}) {
  const statusText = hasRealtimeDatabaseConfig
    ? isRealtimeConnected
      ? 'RTDB connected'
      : 'RTDB connecting'
    : 'RTDB not configured'

  return (
    <div className="status-banner" aria-live="polite">
      <p>{statusText}</p>
      {presenceError ? <p className="status-error">{presenceError}</p> : null}
      {!hasRealtimeDatabaseConfig ? (
        <p className="status-error">{realtimeDatabaseConfigHint}</p>
      ) : null}
    </div>
  )
}

function PlayerScreen({
  teamNumber,
  occupiedTeams,
  isRealtimeConnected,
  presenceError,
  onBack,
}: {
  teamNumber: number
  occupiedTeams: Set<number>
  isRealtimeConnected: boolean
  presenceError: string | null
  onBack: () => void
}) {
  const occupiedTeamList = Array.from(occupiedTeams).sort((left, right) => left - right)

  return (
    <main className="player-screen">
      <section className="player-card">
        <StatusBanner
          isRealtimeConnected={isRealtimeConnected}
          presenceError={presenceError}
        />
        <p className="player-screen-label">PLAYER</p>
        <h1>TEAM {teamNumber}</h1>
        <p className="player-screen-message">
          This is a temporary player screen for connection testing.
        </p>

        <div className="player-status-list" aria-label="connection status">
          <p>
            Connection:
            <strong>{isRealtimeConnected ? ' online' : ' offline'}</strong>
          </p>
          <p>
            Device ID:
            <strong> {getDeviceId()}</strong>
          </p>
          <p>
            Session ID:
            <strong> {getSessionId()}</strong>
          </p>
          <p>
            Occupied teams:
            <strong>
              {occupiedTeamList.length > 0 ? ` ${occupiedTeamList.join(', ')}` : ' none'}
            </strong>
          </p>
        </div>

        <p className="player-screen-hint">
          Open another tab and this team should stay highlighted while this tab is connected.
        </p>

        <button type="button" className="back-button" onClick={onBack}>
          Back to top
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
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false)
  const [presenceError, setPresenceError] = useState<string | null>(null)

  useEffect(() => {
    const unsubscribe = subscribeToOccupiedTeams(setOccupiedTeams, setPresenceError)
    return unsubscribe
  }, [])

  useEffect(() => {
    storeSelection(selection)

    const cleanup = bindSelectionPresence(selection, {
      onConnectionChange: setIsRealtimeConnected,
      onError: setPresenceError,
    })

    return cleanup
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

  const handleBackToTop = () => {
    setSelection(null)
    void clearSelectionPresence().catch((error: unknown) => {
      if (error instanceof Error) {
        setPresenceError(error.message)
        return
      }

      setPresenceError('Failed to clear presence.')
    })
  }

  if (selection?.role === 'player') {
    return (
      <PlayerScreen
        teamNumber={selection.teamNumber}
        occupiedTeams={occupiedTeams}
        isRealtimeConnected={isRealtimeConnected}
        presenceError={presenceError}
        onBack={handleBackToTop}
      />
    )
  }

  return (
    <main className="start-screen">
      <StatusBanner
        isRealtimeConnected={isRealtimeConnected}
        presenceError={presenceError}
      />

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
