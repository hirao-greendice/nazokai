import { getAnalytics, isSupported } from 'firebase/analytics'
import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: 'AIzaSyDa6OZ9kMV7tE8ld1vcb4ATR5wAJCbzOjA',
  authDomain: 'nazonokai-7c135.firebaseapp.com',
  projectId: 'nazonokai-7c135',
  storageBucket: 'nazonokai-7c135.firebasestorage.app',
  messagingSenderId: '906976394172',
  appId: '1:906976394172:web:883e54ae0f13608b1309b9',
  measurementId: 'G-64CBC8X40S',
}

export const firebaseApp = initializeApp(firebaseConfig)
export const db = getFirestore(firebaseApp)

export const analyticsPromise = isSupported().then((supported) => {
  if (!supported) {
    return null
  }

  return getAnalytics(firebaseApp)
})
