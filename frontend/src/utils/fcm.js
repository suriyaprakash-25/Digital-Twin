import axios from 'axios';
import { initializeApp, getApps } from 'firebase/app';
import { getMessaging, getToken, isSupported } from 'firebase/messaging';

function getFirebaseConfigFromEnv() {
  const apiKey = import.meta.env.VITE_FIREBASE_API_KEY;
  const authDomain = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN;
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;
  const messagingSenderId = import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID;
  const appId = import.meta.env.VITE_FIREBASE_APP_ID;

  if (!apiKey || !authDomain || !projectId || !messagingSenderId || !appId) {
    return null;
  }

  return { apiKey, authDomain, projectId, messagingSenderId, appId };
}

export async function tryRegisterFcmToken({ authToken, requestPermission = false }) {
  if (!authToken) return { ok: false, reason: 'missing_auth_token' };

  const supported = await isSupported().catch(() => false);
  if (!supported) return { ok: false, reason: 'messaging_not_supported' };

  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return { ok: false, reason: 'not_in_browser' };
  }

  const firebaseConfig = getFirebaseConfigFromEnv();
  if (!firebaseConfig) {
    return { ok: false, reason: 'missing_firebase_web_config' };
  }

  if (!('serviceWorker' in navigator)) {
    return { ok: false, reason: 'no_service_worker' };
  }

  let permission = Notification.permission;
  if (permission !== 'granted') {
    if (!requestPermission) {
      return { ok: false, reason: 'permission_not_granted_yet' };
    }
    permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return { ok: false, reason: 'notification_permission_denied' };
    }
  }

  const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
  if (!vapidKey) {
    return { ok: false, reason: 'missing_vapid_key' };
  }

  const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
  const messaging = getMessaging(app);

  const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');

  const token = await getToken(messaging, {
    vapidKey,
    serviceWorkerRegistration: registration
  });

  if (!token) {
    return { ok: false, reason: 'no_token_returned' };
  }

  await axios.post(
    'http://localhost:5000/api/notifications/token',
    { token, platform: 'web' },
    {
      headers: {
        Authorization: `Bearer ${authToken}`
      }
    }
  );

  return { ok: true, token };
}
