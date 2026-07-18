import {
  addDoc,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  type DocumentData,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { getFirebaseServices } from '@/firebaseConfig';
import type {
  Backend,
  CreateEmployeeInput,
  CreateMachineInput,
  CreateRunInput,
  CreateStoreInput,
  Employee,
  Machine,
  Run,
  RunFilters,
  RunMachine,
  SessionUser,
  Store,
  SubmitRunInput,
} from './types';

const nowMs = () => Date.now();

function namePrefix(name: string): string {
  const firstWord = name.trim().split(/\s+/)[0] ?? '';
  const letters = (firstWord.match(/[a-zA-Z]/) ? firstWord.match(/[a-zA-Z]*/)?.[0] : name.trim()) ?? '';
  const prefix = letters.slice(0, 2).toUpperCase();
  return prefix || 'XX';
}

function nextCode(prefix: string, existing: string[]): string {
  const re = new RegExp(`^${prefix}(\\d{3})$`);
  let max = 0;
  existing.forEach((c) => {
    const m = c.match(re);
    if (m) max = Math.max(max, Number(m[1]));
  });
  return `${prefix}${String(max + 1).padStart(3, '0')}`;
}

function millis(value: unknown, fallback = nowMs()): number {
  if (typeof value === 'number') return value;
  if (value instanceof Timestamp) return value.toMillis();
  if (value && typeof (value as { toMillis?: () => number }).toMillis === 'function') {
    return (value as { toMillis: () => number }).toMillis();
  }
  return fallback;
}

function compact<T extends Record<string, unknown>>(value: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== undefined && item !== null)
  ) as Partial<T>;
}

function storeFromDoc(snapshot: QueryDocumentSnapshot<DocumentData>): Store {
  const data = snapshot.data();
  return {
    id: snapshot.id,
    code: String(data.code ?? snapshot.id),
    name: String(data.name ?? ''),
    address: String(data.address ?? ''),
    zipCode: data.zipCode ? String(data.zipCode) : undefined,
    lastStorePercentage: Number(data.lastStorePercentage ?? 40),
    lastVendorPercentage: Number(data.lastVendorPercentage ?? 60),
    active: data.active !== false,
    createdAt: millis(data.createdAt),
  };
}

function machineFromDoc(snapshot: QueryDocumentSnapshot<DocumentData>): Machine {
  const data = snapshot.data();
  return {
    id: snapshot.id,
    code: String(data.code ?? snapshot.id),
    label: String(data.label ?? 'Machine'),
    name: data.name ? String(data.name) : undefined,
    order: Number(data.order ?? 0),
    initialIn: data.initialIn != null ? Number(data.initialIn) : undefined,
    initialOut: data.initialOut != null ? Number(data.initialOut) : undefined,
    photoRequired: data.photoRequired === true,
    active: data.active !== false,
  };
}

function employeeFromDoc(snapshot: QueryDocumentSnapshot<DocumentData>): Employee {
  const data = snapshot.data();
  return {
    uid: String(data.uid ?? snapshot.id),
    name: String(data.name ?? ''),
    email: String(data.email ?? ''),
    role: 'employee',
    active: data.active !== false,
    createdAt: millis(data.createdAt),
  };
}

function runFromDoc(snapshot: QueryDocumentSnapshot<DocumentData>): Run {
  const data = snapshot.data();
  const machines = (data.machines ?? {}) as Record<string, RunMachine>;
  return {
    id: snapshot.id,
    storeId: String(data.storeId ?? ''),
    storeName: String(data.storeName ?? 'Store'),
    employeeUid: String(data.employeeUid ?? ''),
    employeeName: String(data.employeeName ?? ''),
    timestamp: millis(data.timestamp),
    previousRunTimestamp: data.previousRunTimestamp ? millis(data.previousRunTimestamp) : undefined,
    date: String(data.date ?? ''),
    status: data.status ?? 'open',
    machines,
    totalNewIn: Number(data.totalNewIn ?? 0),
    totalNewOut: Number(data.totalNewOut ?? 0),
    netTotal: Number(data.netTotal ?? 0),
    isPositive: data.isPositive !== false,
    storePercentage: data.storePercentage,
    vendorPercentage: data.vendorPercentage,
    storeCalculatedAmount: data.storeCalculatedAmount,
    vendorCalculatedAmount: data.vendorCalculatedAmount,
    submittedAt: data.submittedAt ? millis(data.submittedAt) : undefined,
    notes: data.notes,
  };
}

async function uploadMachinePhoto(
  ownerId: string,
  storeId: string,
  runId: string,
  machineId: string,
  uri?: string
): Promise<string | undefined> {
  if (!uri) return undefined;
  if (/^https?:\/\//i.test(uri)) return uri;

  const { storage } = getFirebaseServices();
  const response = await fetch(uri);
  const blob = await response.blob();
  const storageRef = ref(storage, `machinePhotos/${ownerId}/${storeId}/${runId}/${machineId}.jpg`);
  await uploadBytes(storageRef, blob, { contentType: blob.type || 'image/jpeg' });
  return getDownloadURL(storageRef);
}

function applyRunFilters(runs: Run[], filters: RunFilters = {}): Run[] {
  return runs.filter((run) => {
    if (filters.storeId && run.storeId !== filters.storeId) return false;
    if (filters.employeeUid && run.employeeUid !== filters.employeeUid) return false;
    if (filters.status && run.status !== filters.status) return false;
    if (typeof filters.isPositive === 'boolean' && run.isPositive !== filters.isPositive) return false;
    if (filters.dateFrom && run.date < filters.dateFrom) return false;
    if (filters.dateTo && run.date > filters.dateTo) return false;
    return true;
  });
}

export const firebaseAdapter: Backend = {
  async login(email, password) {
    const { auth, db } = getFirebaseServices();
    const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
    const uid = credential.user.uid;

    const employeeSnap = await getDoc(doc(db, 'employeeIndex', uid));
    if (employeeSnap.exists()) {
      const employee = employeeSnap.data();
      if (employee.active === false) throw new Error('Account disabled. Contact your admin.');
      if (!employee.ownerId) throw new Error('Employee account is missing owner routing.');
      return {
        ownerId: String(employee.ownerId),
        uid,
        name: String(employee.name ?? credential.user.displayName ?? 'Employee'),
        email: credential.user.email ?? email.trim(),
        role: 'employee',
      };
    }

    const ownerSnap = await getDoc(doc(db, 'owners', uid));
    if (!ownerSnap.exists()) {
      throw new Error('Not registered as an employee or owner.');
    }

    const owner = ownerSnap.data();
    if (owner.subscriptionStatus && owner.subscriptionStatus !== 'active') {
      throw new Error('Owner subscription inactive.');
    }

    const user: SessionUser = {
      ownerId: uid,
      uid,
      name: String(owner.gameroomName ?? owner.name ?? credential.user.displayName ?? 'Owner'),
      email: credential.user.email ?? String(owner.email ?? email.trim()),
      role: 'owner',
    };
    return user;
  },

  async logout() {
    const { auth } = getFirebaseServices();
    await signOut(auth);
  },

  async getStores(ownerId) {
    const { db } = getFirebaseServices();
    const snap = await getDocs(collection(db, 'owners', ownerId, 'stores'));
    return snap.docs
      .map(storeFromDoc)
      .filter((store) => store.active)
      .sort((a, b) => a.name.localeCompare(b.name));
  },

  async getStore(ownerId, storeId) {
    const { db } = getFirebaseServices();
    const snap = await getDoc(doc(db, 'owners', ownerId, 'stores', storeId));
    return snap.exists() ? storeFromDoc(snap as QueryDocumentSnapshot<DocumentData>) : null;
  },

  async createStore(ownerId, input: CreateStoreInput) {
    const { db } = getFirebaseServices();
    let code = input.code;
    if (!code) {
      const snap = await getDocs(collection(db, 'owners', ownerId, 'stores'));
      const existing = snap.docs.map((d) => storeFromDoc(d).code);
      code = nextCode(namePrefix(input.name.trim()), existing);
    }
    const refDoc = await addDoc(collection(db, 'owners', ownerId, 'stores'), {
      code,
      name: input.name.trim(),
      address: input.address.trim(),
      zipCode: input.zipCode ?? null,
      lastStorePercentage: input.storePercentage ?? 40,
      lastVendorPercentage: input.vendorPercentage ?? 60,
      createdAt: serverTimestamp(),
      active: true,
    });
    return {
      id: refDoc.id,
      code,
      name: input.name.trim(),
      address: input.address.trim(),
      zipCode: input.zipCode,
      lastStorePercentage: input.storePercentage ?? 40,
      lastVendorPercentage: input.vendorPercentage ?? 60,
      active: true,
      createdAt: nowMs(),
    };
  },

  async updateStore(ownerId, storeId, patch) {
    const { db } = getFirebaseServices();
    const { id: _id, createdAt: _createdAt, ...rest } = patch;
    await updateDoc(doc(db, 'owners', ownerId, 'stores', storeId), compact(rest));
  },

  async deleteStore(ownerId, storeId) {
    const { db } = getFirebaseServices();
    await updateDoc(doc(db, 'owners', ownerId, 'stores', storeId), { active: false });
  },

  async getMachines(ownerId, storeId) {
    const { db } = getFirebaseServices();
    const snap = await getDocs(query(collection(db, 'owners', ownerId, 'stores', storeId, 'machines'), orderBy('order', 'asc')));
    return snap.docs.map(machineFromDoc).filter((machine) => machine.active);
  },

  async createMachine(ownerId, input: CreateMachineInput) {
    const { db } = getFirebaseServices();
    let code = input.code;
    if (!code) {
      const snap = await getDocs(collection(db, 'owners', ownerId, 'stores', input.storeId, 'machines'));
      const existing = snap.docs.map((d) => machineFromDoc(d).code);
      const storeSnap = await getDoc(doc(db, 'owners', ownerId, 'stores', input.storeId));
      const storeName = storeSnap.exists() ? storeFromDoc(storeSnap as QueryDocumentSnapshot<DocumentData>).name : '';
      code = nextCode(namePrefix(storeName), existing);
    }
    const order = input.order ?? 0;
    const refDoc = await addDoc(collection(db, 'owners', ownerId, 'stores', input.storeId, 'machines'), {
      code,
      label: input.label.trim(),
      name: input.name ?? null,
      order,
      initialIn: input.initialIn ?? 0,
      initialOut: input.initialOut ?? 0,
      photoRequired: input.photoRequired === true,
      active: true,
    });
    return {
      id: refDoc.id,
      code,
      label: input.label.trim(),
      name: input.name,
      order,
      initialIn: input.initialIn ?? 0,
      initialOut: input.initialOut ?? 0,
      photoRequired: input.photoRequired === true,
      active: true,
    };
  },

  async updateMachine(ownerId, storeId, machineId, patch) {
    const { db } = getFirebaseServices();
    const { id: _id, ...rest } = patch;
    await updateDoc(doc(db, 'owners', ownerId, 'stores', storeId, 'machines', machineId), compact(rest));
  },

  async deleteMachine(ownerId, storeId, machineId) {
    const { db } = getFirebaseServices();
    await updateDoc(doc(db, 'owners', ownerId, 'stores', storeId, 'machines', machineId), { active: false });
  },

  async getEmployees(ownerId) {
    const { db } = getFirebaseServices();
    const snap = await getDocs(collection(db, 'owners', ownerId, 'employees'));
    return snap.docs.map(employeeFromDoc).sort((a, b) => a.name.localeCompare(b.name));
  },

  async createEmployee(ownerId, input: CreateEmployeeInput) {
    const { functions } = getFirebaseServices();
    const createEmployee = httpsCallable<CreateEmployeeInput & { ownerId: string }, Employee>(functions, 'createEmployee');
    const result = await createEmployee({
      ownerId,
      name: input.name.trim(),
      email: input.email.trim(),
      password: input.password,
    });
    return result.data;
  },

  async setEmployeeActive(ownerId, uid, active) {
    const { db } = getFirebaseServices();
    await Promise.all([
      updateDoc(doc(db, 'owners', ownerId, 'employees', uid), { active }),
      updateDoc(doc(db, 'employeeIndex', uid), { active }),
    ]);
  },

  async deleteEmployee(ownerId, uid) {
    const { db } = getFirebaseServices();
    await Promise.all([
      updateDoc(doc(db, 'owners', ownerId, 'employees', uid), { active: false }),
      updateDoc(doc(db, 'employeeIndex', uid), { active: false }),
    ]);
  },

  async getRuns(ownerId, filters: RunFilters = {}) {
    const { db } = getFirebaseServices();
    const snap = await getDocs(query(collection(db, 'owners', ownerId, 'runs'), orderBy('timestamp', 'desc')));
    return applyRunFilters(snap.docs.map(runFromDoc), filters);
  },

  async getRun(ownerId, runId) {
    const { db } = getFirebaseServices();
    const snap = await getDoc(doc(db, 'owners', ownerId, 'runs', runId));
    return snap.exists() ? runFromDoc(snap as QueryDocumentSnapshot<DocumentData>) : null;
  },

  async getLastRun(ownerId, storeId) {
    const { db } = getFirebaseServices();
    const snap = await getDocs(
      query(
        collection(db, 'owners', ownerId, 'runs'),
        where('storeId', '==', storeId),
        orderBy('timestamp', 'desc'),
        limit(1)
      )
    );
    return snap.docs[0] ? runFromDoc(snap.docs[0]) : null;
  },

  async createRun(ownerId, input: CreateRunInput) {
    const { db } = getFirebaseServices();
    const [storeSnap, lastRun] = await Promise.all([
      getDoc(doc(db, 'owners', ownerId, 'stores', input.storeId)),
      this.getLastRun(ownerId, input.storeId),
    ]);

    const store = storeSnap.exists() ? storeFromDoc(storeSnap as QueryDocumentSnapshot<DocumentData>) : null;
    const runRef = doc(collection(db, 'owners', ownerId, 'runs'));
    const timestamp = Timestamp.now();

    const machineDefsSnap = await getDocs(
      query(collection(db, 'owners', ownerId, 'stores', input.storeId, 'machines'), where('active', '==', true))
    );
    const machineDefs = Object.fromEntries(machineDefsSnap.docs.map((d) => [d.id, machineFromDoc(d as QueryDocumentSnapshot<DocumentData>)]));

    const machineEntries = await Promise.all(
      input.machines.map(async (machine) => {
        const def = machineDefs[machine.machineId];
        // Cumulative meter readings: the user enters the current reading, and the
        // incremental amount for this run is current reading minus previous reading.
        const lastIn = lastRun?.machines[machine.machineId]?.presentIn ?? def?.initialIn ?? 0;
        const lastOut = lastRun?.machines[machine.machineId]?.presentOut ?? def?.initialOut ?? 0;
        const newIn = machine.presentIn - lastIn;
        const newOut = machine.presentOut - lastOut;
        const photoUrl = await uploadMachinePhoto(ownerId, input.storeId, runRef.id, machine.machineId, machine.photoUrl);
        const runMachine: RunMachine = {
          code: def?.code,
          label: machine.label,
          name: def?.name,
          presentIn: machine.presentIn,
          presentOut: machine.presentOut,
          lastIn,
          lastOut,
          newIn,
          newOut,
          netMachine: newIn - newOut,
          photoUrl,
        };
        return [machine.machineId, runMachine] as const;
      })
    );

    const machines = Object.fromEntries(machineEntries);
    const totalNewIn = Object.values(machines).reduce((sum, machine) => sum + machine.newIn, 0);
    const totalNewOut = Object.values(machines).reduce((sum, machine) => sum + machine.newOut, 0);
    const netTotal = totalNewIn - totalNewOut;

    const payload = {
      storeId: input.storeId,
      storeName: store?.name ?? 'Store',
      employeeUid: input.employeeUid,
      employeeName: input.employeeName,
      timestamp,
      previousRunTimestamp: lastRun?.timestamp,
      date: input.date,
      status: 'open',
      machines,
      totalNewIn,
      totalNewOut,
      netTotal,
      isPositive: netTotal >= 0,
    };

    await setDoc(runRef, payload);
    return {
      id: runRef.id,
      ...payload,
      timestamp: timestamp.toMillis(),
      status: 'open',
    };
  },

  async submitRun(ownerId, input: SubmitRunInput) {
    if (input.storePercentage < 0 || input.storePercentage > 100 || input.vendorPercentage < 0 || input.vendorPercentage > 100) {
      throw new Error('Each percentage must be between 0 and 100.');
    }
    if (input.storePercentage + input.vendorPercentage !== 100) {
      throw new Error('Store and vendor percentages must add to 100%.');
    }

    const { db } = getFirebaseServices();
    const run = await this.getRun(ownerId, input.runId);
    if (!run) throw new Error('Run not found.');

    const storeCalculatedAmount = (run.netTotal * input.storePercentage) / 100;
    const vendorCalculatedAmount = (run.netTotal * input.vendorPercentage) / 100;

    await Promise.all([
      updateDoc(doc(db, 'owners', ownerId, 'runs', input.runId), {
        status: 'locked',
        storePercentage: input.storePercentage,
        vendorPercentage: input.vendorPercentage,
        storeCalculatedAmount,
        vendorCalculatedAmount,
        submittedAt: serverTimestamp(),
      }),
      updateDoc(doc(db, 'owners', ownerId, 'stores', run.storeId), {
        lastStorePercentage: input.storePercentage,
        lastVendorPercentage: input.vendorPercentage,
      }),
    ]);

    return {
      ...run,
      status: 'locked',
      storePercentage: input.storePercentage,
      vendorPercentage: input.vendorPercentage,
      storeCalculatedAmount,
      vendorCalculatedAmount,
      submittedAt: nowMs(),
    };
  },

  async unlockRun(ownerId, runId) {
    const { db } = getFirebaseServices();
    await updateDoc(doc(db, 'owners', ownerId, 'runs', runId), {
      status: 'open',
      submittedAt: deleteField(),
    });
  },

  async deleteRun(ownerId, runId) {
    const { db } = getFirebaseServices();
    await deleteDoc(doc(db, 'owners', ownerId, 'runs', runId));
  },
};
