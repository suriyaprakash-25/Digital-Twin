// Lazy wrapper so pages can register for push without bundling Firebase.

/** Best-effort FCM registration after a user gesture; firebase is loaded lazily. */
export function registerPushAfterLogin() {
  import('./fcm')
    .then(({ tryRegisterFcmToken }) => tryRegisterFcmToken({ requestPermission: true }))
    .catch(() => {});
}
