import admin from 'firebase-admin';
import { env } from '../config/env';

let appInstance: admin.app.App | null = null;

export function getFirebaseAdminApp(): admin.app.App {
  if (appInstance) return appInstance;

  if (admin.apps.length > 0 && admin.apps[0]) {
    appInstance = admin.apps[0];
    return appInstance;
  }

  // Use Firebase Project ID from env; in Cloud Run, Application Default Credentials will be automatically picked up
  appInstance = admin.initializeApp({
    projectId: env.FIREBASE_PROJECT_ID,
  });

  return appInstance;
}

export function getFirebaseAuth(): admin.auth.Auth {
  return getFirebaseAdminApp().auth();
}

export function getFirestore(): admin.firestore.Firestore {
  return getFirebaseAdminApp().firestore();
}
