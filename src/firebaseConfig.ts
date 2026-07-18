import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getFunctions, type Functions } from 'firebase/functions';
import { getStorage, type FirebaseStorage } from 'firebase/storage';

export const firebaseEnv = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

export interface FirebaseServices {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
  storage: FirebaseStorage;
  functions: Functions;
}

let services: FirebaseServices | null = null;

export function getFirebaseServices(): FirebaseServices {
  if (services) return services;

  const required = [
    ['EXPO_PUBLIC_FIREBASE_API_KEY', firebaseEnv.apiKey],
    ['EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN', firebaseEnv.authDomain],
    ['EXPO_PUBLIC_FIREBASE_PROJECT_ID', firebaseEnv.projectId],
    ['EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET', firebaseEnv.storageBucket],
    ['EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID', firebaseEnv.messagingSenderId],
    ['EXPO_PUBLIC_FIREBASE_APP_ID', firebaseEnv.appId],
  ];
  const missing = required.filter(([, value]) => !value).map(([key]) => key);
  if (missing.length > 0) {
    throw new Error(`Missing Firebase environment values: ${missing.join(', ')}`);
  }

  const app = getApps().length > 0 ? getApp() : initializeApp(firebaseEnv);
  const region = process.env.EXPO_PUBLIC_FIREBASE_FUNCTIONS_REGION || 'us-central1';

  services = {
    app,
    auth: getAuth(app),
    db: getFirestore(app),
    storage: getStorage(app),
    functions: getFunctions(app, region),
  };
  return services;
}
