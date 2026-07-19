// In-memory mock backend. Seeded on startup. Data resets on full app reload.
// Implements the same Backend interface as the (future) firebase adapter.

import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  AuditLog,
  Backend,
  CreateEmployeeInput,
  CreateMachineInput,
  CreateOwnerInput,
  CreateRunInput,
  CreateStoreInput,
  Employee,
  Machine,
  Role,
  Run,
  RunFilters,
  RunMachine,
  SessionUser,
  Store,
  SubmitRunInput,
} from './types';
import { calcRun } from './calc';

// ─── ID + date helpers ───────────────────────────────────────
let idCounter = 1000;
const genId = (prefix: string) => `${prefix}_${(++idCounter).toString(36)}${Date.now().toString(36).slice(-4)}`;

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

// ─── Seed identities ─────────────────────────────────────────
interface Credential {
  uid: string;
  email: string;
  password: string;
  name: string;
  role: Role;
  ownerId: string;
  active: boolean;
}

let credentials: Credential[] = [];
export const SEED_CREDENTIALS: { email: string; password: string; role: Role }[] = [];

// ─── In-memory tables (keyed by ownerId) ─────────────────────
interface OwnerData {
  stores: Store[];
  machines: Record<string, Machine[]>; // storeId -> machines
  employees: Employee[];
  runs: Run[];
  auditLogs: AuditLog[];
}

function buildSeed(): Record<string, OwnerData> {
  // Real working app: start empty; owner signs up and creates stores/machines.
  return {};
}

function emptyOwnerData(): OwnerData {
  return { stores: [], machines: {}, employees: [], runs: [], auditLogs: [] };
}

let db: Record<string, OwnerData> = buildSeed();
let initPromise: Promise<void> | null = null;
let initialized = false;

const STORAGE_KEYS = {
  db: 'machine-reading-tracker:local:db',
  credentials: 'machine-reading-tracker:local:credentials',
} as const;

async function init() {
  if (initialized) return;
  if (initPromise) return initPromise;
  initPromise = (async () => {
    try {
      const pairs = await AsyncStorage.multiGet([STORAGE_KEYS.db, STORAGE_KEYS.credentials]);
      const dbValue = pairs.find(([k]) => k === STORAGE_KEYS.db)?.[1];
      const credsValue = pairs.find(([k]) => k === STORAGE_KEYS.credentials)?.[1];
      if (dbValue) {
        const parsed = JSON.parse(dbValue);
        if (parsed && typeof parsed === 'object') db = parsed;
      }
      if (credsValue) {
        const parsed = JSON.parse(credsValue);
        if (Array.isArray(parsed)) credentials = parsed;
      }
    } catch {
      // ignore corrupted storage
    }
    syncSeed();
    initialized = true;
  })();
  return initPromise;
}

async function persist() {
  try {
    await AsyncStorage.multiSet([
      [STORAGE_KEYS.db, JSON.stringify(db)],
      [STORAGE_KEYS.credentials, JSON.stringify(credentials)],
    ]);
    syncSeed();
  } catch {
    // ignore storage errors
  }
}

function syncSeed() {
  SEED_CREDENTIALS.length = 0;
  SEED_CREDENTIALS.push(...credentials.map((c) => ({ email: c.email, password: c.password, role: c.role })));
}

export async function getSeedCredentials(): Promise<{ email: string; password: string; role: Role }[]> {
  await init();
  return SEED_CREDENTIALS.slice();
}

function ownerData(ownerId: string): OwnerData {
  if (!db[ownerId]) db[ownerId] = emptyOwnerData();
  return db[ownerId];
}

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
const delay = (ms = 120) => new Promise((r) => setTimeout(r, ms));

function logAudit(
  ownerId: string,
  action: string,
  entity: AuditLog['entity'],
  entityId?: string,
  details?: string
) {
  const data = ownerData(ownerId);
  data.auditLogs.push({
    id: genId('audit'),
    action,
    entity,
    entityId,
    ownerId,
    userUid: ownerId,
    userName: 'System',
    details,
    timestamp: Date.now(),
  });
}

function wrapBackend<T extends Backend>(adapter: T): Backend {
  const mutationKeys: (keyof Backend)[] = [
    'registerOwner',
    'createStore',
    'updateStore',
    'deleteStore',
    'createMachine',
    'updateMachine',
    'deleteMachine',
    'createEmployee',
    'setEmployeeActive',
    'deleteEmployee',
    'createRun',
    'submitRun',
    'printRun',
    'unlockRun',
    'deleteRun',
  ];
  const mutations = new Set(mutationKeys);
  const wrapped = {} as Backend;
  for (const key of Object.keys(adapter) as (keyof Backend)[]) {
    const fn = (adapter as any)[key] as unknown as (...args: any[]) => any;
    if (typeof fn !== 'function') {
      (wrapped as any)[key] = fn;
      continue;
    }
    (wrapped as any)[key] = async (...args: any[]) => {
      await init();
      const result = await fn(...args);
      if (mutations.has(key)) await persist();
      return result;
    };
  }
  return wrapped;
}

// ─── Adapter implementation ──────────────────────────────────
const _localAdapter: Backend = {
  async login(email, password) {
    await delay();
    const cred = credentials.find((c) => c.email.toLowerCase() === email.trim().toLowerCase());
    if (!cred || cred.password !== password) {
      throw new Error('Invalid email or password.');
    }
    if (!cred.active) {
      throw new Error('Account disabled. Contact your admin.');
    }
    const user: SessionUser = {
      ownerId: cred.ownerId,
      uid: cred.uid,
      name: cred.name,
      email: cred.email,
      role: cred.role,
    };
    return user;
  },

  async registerOwner(input: CreateOwnerInput) {
    await delay();
    const existing = credentials.find((c) => c.email.toLowerCase() === input.email.trim().toLowerCase());
    if (existing) throw new Error('Email already in use.');
    const ownerId = genId('owner');
    const user: SessionUser = {
      ownerId,
      uid: ownerId,
      name: input.name.trim(),
      email: input.email.trim(),
      role: 'owner',
    };
    credentials.push({
      uid: ownerId,
      email: user.email,
      password: input.password,
      name: user.name,
      role: 'owner',
      ownerId,
      active: true,
    });
    ownerData(ownerId); // create empty data tree
    logAudit(ownerId, 'registerOwner', 'auth', ownerId, `Owner ${user.email} registered`);
    return user;
  },

  async logout() {
    await delay(50);
  },

  // ── stores ──
  async getStores(ownerId) {
    await delay();
    return clone(ownerData(ownerId).stores.filter((s) => s.active));
  },

  async getStore(ownerId, storeId) {
    await delay(60);
    return clone(ownerData(ownerId).stores.find((s) => s.id === storeId) ?? null);
  },

  async createStore(ownerId, input: CreateStoreInput) {
    await delay();
    const data = ownerData(ownerId);
    const prefix = namePrefix(input.name);
    const existingCodes = data.stores.map((s) => s.code);
    const code = input.code ?? nextCode(prefix, existingCodes);
    const store: Store = {
      id: genId('store'),
      code,
      name: input.name,
      address: input.address,
      zipCode: input.zipCode,
      lastStorePercentage: input.storePercentage ?? 40,
      lastVendorPercentage: input.vendorPercentage ?? 60,
      active: true,
      createdAt: Date.now(),
    };
    data.stores.push(store);
    logAudit(ownerId, 'createStore', 'store', store.id, `Store ${store.name} created`);
    return clone(store);
  },

  async updateStore(ownerId, storeId, patch) {
    await delay(80);
    const s = ownerData(ownerId).stores.find((x) => x.id === storeId);
    if (s) {
      Object.assign(s, patch);
      logAudit(ownerId, 'updateStore', 'store', storeId, `Store ${s.name} updated`);
    }
  },

  async deleteStore(ownerId, storeId) {
    await delay(80);
    const data = ownerData(ownerId);
    const store = data.stores.find((s) => s.id === storeId);
    data.stores = data.stores.filter((s) => s.id !== storeId);
    delete data.machines[storeId];
    logAudit(ownerId, 'deleteStore', 'store', storeId, `Store ${store?.name ?? storeId} deleted`);
  },

  // ── machines ──
  async getMachines(ownerId, storeId) {
    await delay();
    const list = ownerData(ownerId).machines[storeId] ?? [];
    return clone(list.filter((m) => m.active).sort((a, b) => a.order - b.order));
  },

  async createMachine(ownerId, input: CreateMachineInput) {
    await delay(80);
    const data = ownerData(ownerId);
    const store = data.stores.find((s) => s.id === input.storeId);
    const storeName = store?.name ?? '';
    const prefix = namePrefix(storeName);
    const existing = data.machines[input.storeId] ?? [];
    const nextOrder = input.order ?? existing.length + 1;
    const existingCodes = existing.map((m) => m.code);
    const code = input.code ?? nextCode(prefix, existingCodes);
    const machine: Machine = {
      id: genId('m'),
      code,
      label: input.label,
      name: input.name,
      order: nextOrder,
      initialIn: input.initialIn ?? 0,
      initialOut: input.initialOut ?? 0,
      photoRequired: input.photoRequired ?? false,
      active: true,
    };
    if (!data.machines[input.storeId]) data.machines[input.storeId] = [];
    data.machines[input.storeId].push(machine);
    logAudit(ownerId, 'createMachine', 'machine', machine.id, `Machine ${machine.label} created for store ${storeName}`);
    return clone(machine);
  },

  async updateMachine(ownerId, storeId, machineId, patch) {
    await delay(60);
    const m = (ownerData(ownerId).machines[storeId] ?? []).find((x) => x.id === machineId);
    if (m) {
      Object.assign(m, patch);
      logAudit(ownerId, 'updateMachine', 'machine', machineId, `Machine ${m.label} updated`);
    }
  },

  async deleteMachine(ownerId, storeId, machineId) {
    await delay(60);
    const data = ownerData(ownerId);
    const machine = (data.machines[storeId] ?? []).find((m) => m.id === machineId);
    data.machines[storeId] = (data.machines[storeId] ?? []).filter((m) => m.id !== machineId);
    logAudit(ownerId, 'deleteMachine', 'machine', machineId, `Machine ${machine?.label ?? machineId} deleted`);
  },

  // ── employees ──
  async getEmployees(ownerId) {
    await delay();
    return clone(ownerData(ownerId).employees);
  },

  async createEmployee(ownerId, input: CreateEmployeeInput) {
    await delay();
    const existing = credentials.find((c) => c.email.toLowerCase() === input.email.trim().toLowerCase());
    if (existing) throw new Error('Email already in use.');
    const uid = genId('emp');
    const role = input.role === 'viewer' ? 'viewer' : 'employee';
    const employee: Employee = {
      uid,
      name: input.name,
      email: input.email.trim(),
      role,
      active: true,
      createdAt: Date.now(),
    };
    ownerData(ownerId).employees.push(employee);
    credentials.push({ uid, email: employee.email, password: input.password, name: input.name, role, ownerId, active: true });
    logAudit(ownerId, 'createEmployee', 'employee', uid, `Employee ${employee.email} created as ${role}`);
    return clone(employee);
  },

  async setEmployeeActive(ownerId, uid, active) {
    await delay(80);
    const e = ownerData(ownerId).employees.find((x) => x.uid === uid);
    if (e) e.active = active;
    const c = credentials.find((x) => x.uid === uid);
    if (c) c.active = active;
    logAudit(ownerId, 'setEmployeeActive', 'employee', uid, `Employee ${uid} set active=${active}`);
  },

  async deleteEmployee(ownerId, uid) {
    await delay(80);
    const data = ownerData(ownerId);
    const employee = data.employees.find((e) => e.uid === uid);
    data.employees = data.employees.filter((e) => e.uid !== uid);
    const idx = credentials.findIndex((c) => c.uid === uid);
    if (idx >= 0) credentials.splice(idx, 1);
    logAudit(ownerId, 'deleteEmployee', 'employee', uid, `Employee ${employee?.email ?? uid} deleted`);
  },

  // ── runs ──
  async getRuns(ownerId, filters: RunFilters = {}) {
    await delay();
    let list = ownerData(ownerId).runs.slice();
    if (filters.storeId) list = list.filter((r) => r.storeId === filters.storeId);
    if (filters.employeeUid) list = list.filter((r) => r.employeeUid === filters.employeeUid);
    if (filters.status) list = list.filter((r) => r.status === filters.status);
    if (typeof filters.isPositive === 'boolean') list = list.filter((r) => r.isPositive === filters.isPositive);
    if (filters.dateFrom) list = list.filter((r) => r.date >= filters.dateFrom!);
    if (filters.dateTo) list = list.filter((r) => r.date <= filters.dateTo!);
    list.sort((a, b) => b.timestamp - a.timestamp);
    return clone(list);
  },

  async getRun(ownerId, runId) {
    await delay(80);
    return clone(ownerData(ownerId).runs.find((r) => r.id === runId) ?? null);
  },

  async getLastRun(ownerId, storeId) {
    await delay(80);
    const list = ownerData(ownerId)
      .runs.filter((r) => r.storeId === storeId)
      .sort((a, b) => b.timestamp - a.timestamp);
    return clone(list[0] ?? null);
  },

  async createRun(ownerId, input: CreateRunInput) {
    await delay();
    const data = ownerData(ownerId);
    const store = data.stores.find((s) => s.id === input.storeId);
    const allPrevious = data.runs
      .filter((r) => r.storeId === input.storeId)
      .sort((a, b) => b.timestamp - a.timestamp);
    const lastPositiveRun =
      allPrevious.find((r) => r.isPositive && (r.status === 'locked' || r.status === 'submitted')) ?? null;
    const completedPreviousForStoreDay = allPrevious.filter(
      (r) => r.date === input.date && (r.status === 'locked' || r.status === 'submitted')
    );
    const visitNumber = completedPreviousForStoreDay.length + 1;

    const machineVisitNumbers: Record<string, number> = {};
    input.machines.forEach((m) => {
      const count = completedPreviousForStoreDay.filter((r) => r.machines[m.machineId] != null).length;
      machineVisitNumbers[m.machineId] = count + 1;
    });

    const storeMachines = data.machines[input.storeId] ?? [];
    const now = Date.now();
    const run = calcRun({
      runId: genId('run'),
      storeId: input.storeId,
      storeName: store?.name ?? 'Store',
      employeeUid: input.employeeUid,
      employeeName: input.employeeName,
      date: input.date,
      timestamp: now,
      previousRunTimestamp: lastPositiveRun?.timestamp,
      previousRun: lastPositiveRun,
      machineDefs: storeMachines,
      machines: input.machines,
      visitNumber,
      machineVisitNumbers,
    });

    data.runs.push(run);
    logAudit(ownerId, 'createRun', 'run', run.id, `Run ${run.id} created for ${run.storeName}`);
    return clone(run);
  },

  async submitRun(ownerId, input: SubmitRunInput) {
    await delay();
    const data = ownerData(ownerId);
    const run = data.runs.find((r) => r.id === input.runId);
    if (!run) throw new Error('Run not found.');
    run.storePercentage = input.storePercentage;
    run.vendorPercentage = input.vendorPercentage;
    run.storeCalculatedAmount = (run.netTotal * input.storePercentage) / 100;
    run.vendorCalculatedAmount = (run.netTotal * input.vendorPercentage) / 100;
    run.status = 'locked';
    run.submittedAt = Date.now();
    run.updatedAt = Date.now();
    const store = data.stores.find((s) => s.id === run.storeId);
    if (store) {
      store.lastStorePercentage = input.storePercentage;
      store.lastVendorPercentage = input.vendorPercentage;
    }
    logAudit(ownerId, 'submitRun', 'run', run.id, `Run ${run.id} submitted and locked`);
    return clone(run);
  },

  async printRun(ownerId, runId) {
    await delay(50);
    const data = ownerData(ownerId);
    const run = data.runs.find((r) => r.id === runId);
    if (!run) return null;
    run.printedAt = Date.now();
    run.printStatus = run.printStatus === 'printed' ? 'reprinted' : 'printed';
    run.updatedAt = Date.now();
    logAudit(ownerId, 'printRun', 'run', run.id, `Run ${run.id} printed/reprinted`);
    return clone(run);
  },

  async unlockRun(ownerId, runId) {
    await delay(80);
    const run = ownerData(ownerId).runs.find((r) => r.id === runId);
    if (run) {
      run.status = 'open';
      run.submittedAt = undefined;
      run.updatedAt = Date.now();
      logAudit(ownerId, 'unlockRun', 'run', run.id, `Run ${run.id} unlocked for editing`);
    }
  },

  async deleteRun(ownerId, runId) {
    await delay(80);
    const data = ownerData(ownerId);
    data.runs = data.runs.filter((r) => r.id !== runId);
    logAudit(ownerId, 'deleteRun', 'run', runId, `Run ${runId} deleted`);
  },

  // ── audit ──
  async getAuditLogs(ownerId, limit = 100) {
    await delay(50);
    const logs = ownerData(ownerId).auditLogs.slice();
    logs.sort((a, b) => b.timestamp - a.timestamp);
    return clone(logs.slice(0, limit));
  },
};

export const localAdapter: Backend = wrapBackend(_localAdapter);
