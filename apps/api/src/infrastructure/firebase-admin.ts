import admin from 'firebase-admin';
import { env } from '../config/env';

import fs from 'node:fs';
import path from 'node:path';

let appInstance: admin.app.App | null = null;

function resolveCredential(): admin.credential.Credential | undefined {
  // 1. Check FIREBASE_SERVICE_ACCOUNT_KEY env var (raw JSON string, base64, or file path)
  if (env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    try {
      const val = env.FIREBASE_SERVICE_ACCOUNT_KEY.trim();
      if (val.startsWith('{')) {
        return admin.credential.cert(JSON.parse(val));
      }
      if (fs.existsSync(val)) {
        return admin.credential.cert(JSON.parse(fs.readFileSync(val, 'utf8')));
      }
      // Try base64 decoded JSON string
      try {
        const decoded = Buffer.from(val, 'base64').toString('utf8');
        if (decoded.trim().startsWith('{')) {
          return admin.credential.cert(JSON.parse(decoded));
        }
      } catch (_) {}
    } catch (e) {
      console.warn('Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY:', e);
    }
  }

  // 2. Check for local serviceAccountKey.json file
  const localCandidates = [
    path.resolve(process.cwd(), 'serviceAccountKey.json'),
    path.resolve(process.cwd(), 'apps/api/serviceAccountKey.json'),
    path.resolve(process.cwd(), '../serviceAccountKey.json'),
  ];
  for (const candidate of localCandidates) {
    if (fs.existsSync(candidate)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(candidate, 'utf8'));
        console.log(`[Firebase Admin] Loaded service account from ${candidate}`);
        return admin.credential.cert(parsed);
      } catch (e) {
        console.warn(`[Firebase Admin] Failed reading ${candidate}:`, e);
      }
    }
  }

  return undefined;
}

export function hasFirebaseCredentials(): boolean {
  if (env.USE_FIREBASE_EMULATOR) return true;
  return resolveCredential() !== undefined || Boolean(process.env.GOOGLE_APPLICATION_CREDENTIALS);
}

export function getFirebaseAdminApp(): admin.app.App {
  if (appInstance) return appInstance;

  if (admin.apps.length > 0 && admin.apps[0]) {
    appInstance = admin.apps[0];
    return appInstance;
  }

  if (!env.USE_FIREBASE_EMULATOR) {
    delete process.env.FIRESTORE_EMULATOR_HOST;
    delete process.env.FIREBASE_AUTH_EMULATOR_HOST;
  }

  const credential = resolveCredential();
  const options: admin.AppOptions = {
    projectId: env.FIREBASE_PROJECT_ID,
  };
  if (credential) {
    options.credential = credential;
  }

  appInstance = admin.initializeApp(options);
  return appInstance;
}

export function getFirebaseAuth(): admin.auth.Auth {
  return getFirebaseAdminApp().auth();
}

let firestoreInstance: admin.firestore.Firestore | null = null;

export function getFirestore(): admin.firestore.Firestore {
  if (firestoreInstance) return firestoreInstance;

  const app = getFirebaseAdminApp();
  const db = app.firestore();
  try {
    db.settings({ ignoreUndefinedProperties: true });
  } catch (err) {
    // Settings might have already been initialized in the runtime
  }
  firestoreInstance = db;
  return firestoreInstance;
}
