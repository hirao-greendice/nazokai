import {
  Timestamp,
  collection,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore'

import { db } from './firebase'

export const TEAM_COUNT = 12
export const PRESENCE_HEARTBEAT_MS = 20_000
export const PRESENCE_ACTIVE_WINDOW_MS = 60_000

const DEVICE_ID_STORAGE_KEY = 'nazokai-device-id'
const SELECTION_STORAGE_KEY = 'nazokai-selection'
const PRESENCE_COLLECTION = 'presence'

export type ControlRole = 'screen' | 'staff' | 'master'
export type Selection =
  | { role: 'player'; teamNumber: number }
  | { role: ControlRole }

type PresenceDoc = {
  role?: string
  teamNumber?: number | null
  updatedAt?: Timestamp | null
}

function createDeviceId() {
  return `device-${crypto.randomUUID()}`
}

export function getDeviceId() {
  const existingId = window.localStorage.getItem(DEVICE_ID_STORAGE_KEY)
  if (existingId) {
    return existingId
  }

  const newId = createDeviceId()
  window.localStorage.setItem(DEVICE_ID_STORAGE_KEY, newId)
  return newId
}

export function readStoredSelection(): Selection | null {
  const raw = window.localStorage.getItem(SELECTION_STORAGE_KEY)
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
    window.localStorage.removeItem(SELECTION_STORAGE_KEY)
  }

  return null
}

export function storeSelection(selection: Selection | null) {
  if (!selection) {
    window.localStorage.removeItem(SELECTION_STORAGE_KEY)
    return
  }

  window.localStorage.setItem(SELECTION_STORAGE_KEY, JSON.stringify(selection))
}

export async function publishSelection(selection: Selection) {
  const deviceId = getDeviceId()

  await setDoc(
    doc(db, PRESENCE_COLLECTION, deviceId),
    {
      deviceId,
      role: selection.role,
      teamNumber: selection.role === 'player' ? selection.teamNumber : null,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  )
}

export async function clearSelection() {
  const deviceId = getDeviceId()

  await setDoc(
    doc(db, PRESENCE_COLLECTION, deviceId),
    {
      deviceId,
      role: null,
      teamNumber: null,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  )
}

function isPresenceActive(updatedAt: Timestamp | null | undefined) {
  if (!updatedAt) {
    return false
  }

  return Date.now() - updatedAt.toMillis() <= PRESENCE_ACTIVE_WINDOW_MS
}

export function subscribeToOccupiedTeams(
  onChange: (occupiedTeams: Set<number>) => void,
) {
  return onSnapshot(collection(db, PRESENCE_COLLECTION), (snapshot) => {
    const occupiedTeams = new Set<number>()

    for (const documentSnapshot of snapshot.docs) {
      const data = documentSnapshot.data() as PresenceDoc

      if (
        data.role === 'player' &&
        typeof data.teamNumber === 'number' &&
        isPresenceActive(data.updatedAt)
      ) {
        occupiedTeams.add(data.teamNumber)
      }
    }

    onChange(occupiedTeams)
  })
}
