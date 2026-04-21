import {
  onDisconnect,
  onValue,
  ref,
  remove,
  serverTimestamp,
  set,
  type DatabaseReference,
} from 'firebase/database'

import { hasRealtimeDatabaseConfig, realtimeDb } from './firebase'

export const TEAM_COUNT = 12

const DEVICE_ID_STORAGE_KEY = 'nazokai-device-id'
const SESSION_ID_STORAGE_KEY = 'nazokai-session-id'
const SELECTION_STORAGE_KEY = 'nazokai-selection'
const CONNECTIONS_PATH = 'presence/connections'

export type ControlRole = 'screen' | 'staff' | 'master'
export type Selection =
  | { role: 'player'; teamNumber: number }
  | { role: ControlRole }

type PresenceRecord = {
  connectedAt?: number | Record<string, string> | null
  deviceId?: string
  role?: string | null
  teamNumber?: number | null
  updatedAt?: number | Record<string, string> | null
}

type PresenceBindingCallbacks = {
  onConnectionChange?: (isConnected: boolean) => void
  onError?: (message: string | null) => void
}

function createId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`
}

export function getDeviceId() {
  const existingId = window.localStorage.getItem(DEVICE_ID_STORAGE_KEY)
  if (existingId) {
    return existingId
  }

  const newId = createId('device')
  window.localStorage.setItem(DEVICE_ID_STORAGE_KEY, newId)
  return newId
}

export function getSessionId() {
  const existingId = window.sessionStorage.getItem(SESSION_ID_STORAGE_KEY)
  if (existingId) {
    return existingId
  }

  const newId = createId('session')
  window.sessionStorage.setItem(SESSION_ID_STORAGE_KEY, newId)
  return newId
}

export function readStoredSelection(): Selection | null {
  const raw = window.sessionStorage.getItem(SELECTION_STORAGE_KEY)
  if (!raw) {
    return null
  }

  try {
    const parsed = JSON.parse(raw) as Partial<Selection>

    if (
      parsed.role === 'player' &&
      typeof parsed.teamNumber === 'number' &&
      parsed.teamNumber >= 1 &&
      parsed.teamNumber <= TEAM_COUNT
    ) {
      return { role: 'player', teamNumber: parsed.teamNumber }
    }

    if (
      parsed.role === 'screen' ||
      parsed.role === 'staff' ||
      parsed.role === 'master'
    ) {
      return { role: parsed.role }
    }
  } catch {
    window.sessionStorage.removeItem(SELECTION_STORAGE_KEY)
  }

  return null
}

export function storeSelection(selection: Selection | null) {
  if (!selection) {
    window.sessionStorage.removeItem(SELECTION_STORAGE_KEY)
    return
  }

  window.sessionStorage.setItem(SELECTION_STORAGE_KEY, JSON.stringify(selection))
}

function toErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message
  }

  return 'Failed to synchronize presence.'
}

function createPresenceRecord(selection: Selection) {
  return {
    deviceId: getDeviceId(),
    sessionId: getSessionId(),
    role: selection.role,
    teamNumber: selection.role === 'player' ? selection.teamNumber : null,
    connectedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }
}

export function bindSelectionPresence(
  selection: Selection | null,
  callbacks: PresenceBindingCallbacks = {},
) {
  if (!hasRealtimeDatabaseConfig || !realtimeDb) {
    callbacks.onConnectionChange?.(false)
    callbacks.onError?.('Realtime Database URL is not configured.')
    return () => undefined
  }

  const connectedRef = ref(realtimeDb, '.info/connected')
  const presenceRef = ref(realtimeDb, `${CONNECTIONS_PATH}/${getSessionId()}`)
  let isDisposed = false

  const unsubscribe = onValue(
    connectedRef,
    async (snapshot) => {
      if (isDisposed) {
        return
      }

      const isConnected = snapshot.val() === true
      callbacks.onConnectionChange?.(isConnected)

      if (!isConnected) {
        return
      }

      try {
        await onDisconnect(presenceRef).remove()

        if (!selection) {
          await remove(presenceRef)
        } else {
          await set(presenceRef, createPresenceRecord(selection))
        }

        callbacks.onError?.(null)
      } catch (error) {
        callbacks.onError?.(toErrorMessage(error))
      }
    },
    (error) => {
      callbacks.onError?.(toErrorMessage(error))
    },
  )

  return () => {
    isDisposed = true
    unsubscribe()
    callbacks.onConnectionChange?.(false)
    void onDisconnect(presenceRef).cancel().catch(() => undefined)
    void remove(presenceRef).catch(() => undefined)
  }
}

export function subscribeToOccupiedTeams(
  onChange: (occupiedTeams: Set<number>) => void,
  onError?: (message: string | null) => void,
) {
  if (!hasRealtimeDatabaseConfig || !realtimeDb) {
    onChange(new Set())
    onError?.('Realtime Database URL is not configured.')
    return () => undefined
  }

  const connectionsRef = ref(realtimeDb, CONNECTIONS_PATH)

  return onValue(
    connectionsRef,
    (snapshot) => {
      const occupiedTeams = new Set<number>()
      const rawValue = snapshot.val() as Record<string, PresenceRecord> | null

      if (rawValue) {
        for (const record of Object.values(rawValue)) {
          if (record.role === 'player' && typeof record.teamNumber === 'number') {
            occupiedTeams.add(record.teamNumber)
          }
        }
      }

      onError?.(null)
      onChange(occupiedTeams)
    },
    (error) => {
      onError?.(toErrorMessage(error))
    },
  )
}

export function clearSelectionPresence() {
  if (!hasRealtimeDatabaseConfig || !realtimeDb) {
    return Promise.resolve()
  }

  const presenceRef = ref(realtimeDb, `${CONNECTIONS_PATH}/${getSessionId()}`)
  return remove(presenceRef)
}

export function getSelectionPresenceRef(): DatabaseReference | null {
  if (!hasRealtimeDatabaseConfig || !realtimeDb) {
    return null
  }

  return ref(realtimeDb, `${CONNECTIONS_PATH}/${getSessionId()}`)
}
