import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';

initializeApp();

interface CreateEmployeePayload {
  ownerId?: string;
  name?: string;
  email?: string;
  password?: string;
}

export const createEmployee = onCall<CreateEmployeePayload>(async (request) => {
  const ownerUid = request.auth?.uid;
  if (!ownerUid) {
    throw new HttpsError('unauthenticated', 'Sign in as an owner before creating employees.');
  }

  const ownerId = request.data.ownerId || ownerUid;
  if (ownerId !== ownerUid) {
    throw new HttpsError('permission-denied', 'Owners can only create employees for their own account.');
  }

  const name = request.data.name?.trim();
  const email = request.data.email?.trim().toLowerCase();
  const password = request.data.password;

  if (!name || !email || !password) {
    throw new HttpsError('invalid-argument', 'Name, email and password are required.');
  }
  if (password.length < 6) {
    throw new HttpsError('invalid-argument', 'Password must be at least 6 characters.');
  }

  const db = getFirestore();
  const ownerSnap = await db.doc(`owners/${ownerId}`).get();
  if (!ownerSnap.exists) {
    throw new HttpsError('failed-precondition', 'Owner profile does not exist.');
  }
  if (ownerSnap.get('subscriptionStatus') && ownerSnap.get('subscriptionStatus') !== 'active') {
    throw new HttpsError('failed-precondition', 'Owner subscription is inactive.');
  }

  const userRecord = await getAuth().createUser({
    email,
    password,
    displayName: name,
    disabled: false,
  });

  const employee = {
    uid: userRecord.uid,
    name,
    email,
    role: 'employee',
    active: true,
    createdAt: FieldValue.serverTimestamp(),
  };

  const batch = db.batch();
  batch.set(db.doc(`owners/${ownerId}/employees/${userRecord.uid}`), employee);
  batch.set(db.doc(`employeeIndex/${userRecord.uid}`), {
    ownerId,
    name,
    role: 'employee',
    active: true,
  });
  await batch.commit();

  return {
    uid: userRecord.uid,
    name,
    email,
    role: 'employee',
    active: true,
    createdAt: Date.now(),
  };
});
