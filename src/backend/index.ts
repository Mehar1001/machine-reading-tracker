// Single entry point for all data/auth. Screens import `backend` from here.
// Swap backends by setting EXPO_PUBLIC_BACKEND in .env ("local" | "firebase").

import type { Backend } from './types';
import { localAdapter } from './localAdapter';

const mode = (process.env.EXPO_PUBLIC_BACKEND ?? 'local').toLowerCase();

function getBackend(): Backend {
  if (mode === 'firebase') {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { firebaseAdapter } = require('./firebaseAdapter');
    return firebaseAdapter;
  }
  return localAdapter;
}

export const backend: Backend = getBackend();

export const BACKEND_MODE = mode;

export * from './types';
export { SEED_CREDENTIALS } from './localAdapter';
