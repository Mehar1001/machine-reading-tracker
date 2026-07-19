// In-memory mock backend. Seeded on startup. Data resets on full app reload.
// Implements the same Backend interface as the (future) firebase adapter.

import type {
  Backend,
  CreateEmployeeInput,
  CreateMachineInput,
  CreateOwnerInput,
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
  role: 'owner' | 'employee';
  ownerId: string;
  active: boolean;
}

const credentials: Credential[] = [];

// ─── In-memory tables (keyed by ownerId) ─────────────────────
interface OwnerData {
  stores: Store[];
  machines: Record<string, Machine[]>; // storeId -> machines
  employees: Employee[];
  runs: Run[];
}

function buildSeed(): Record<string, OwnerData> {
  // Real working app: start empty; owner signs up and creates stores/machines.
  return {};
}

const db: Record<string, OwnerData> = buildSeed();

function ownerData(ownerId: string): OwnerData {
  if (!db[ownerId]) db[ownerId] = { stores: [], machines: {}, employees: [], runs: [] };
  return db[ownerId];
}

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
const delay = (ms = 120) => new Promise((r) => setTimeout(r, ms));

// ─── Adapter implementation ──────────────────────────────────
export const localAdapter: Backend = {
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
    return clone(store);
  },

  async updateStore(ownerId, storeId, patch) {
    await delay(80);
    const s = ownerData(ownerId).stores.find((x) => x.id === storeId);
    if (s) Object.assign(s, patch);
  },

  async deleteStore(ownerId, storeId) {
    await delay(80);
    const data = ownerData(ownerId);
    data.stores = data.stores.filter((s) => s.id !== storeId);
    delete data.machines[storeId];
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
    return clone(machine);
  },

  async updateMachine(ownerId, storeId, machineId, patch) {
    await delay(60);
    const m = (ownerData(ownerId).machines[storeId] ?? []).find((x) => x.id === machineId);
    if (m) Object.assign(m, patch);
  },

  async deleteMachine(ownerId, storeId, machineId) {
    await delay(60);
    const data = ownerData(ownerId);
    data.machines[storeId] = (data.machines[storeId] ?? []).filter((m) => m.id !== machineId);
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
    const employee: Employee = {
      uid,
      name: input.name,
      email: input.email.trim(),
      role: 'employee',
      active: true,
      createdAt: Date.now(),
    };
    ownerData(ownerId).employees.push(employee);
    credentials.push({ uid, email: employee.email, password: input.password, name: input.name, role: 'employee', ownerId, active: true });
    return clone(employee);
  },

  async setEmployeeActive(ownerId, uid, active) {
    await delay(80);
    const e = ownerData(ownerId).employees.find((x) => x.uid === uid);
    if (e) e.active = active;
    const c = credentials.find((x) => x.uid === uid);
    if (c) c.active = active;
  },

  async deleteEmployee(ownerId, uid) {
    await delay(80);
    const data = ownerData(ownerId);
    data.employees = data.employees.filter((e) => e.uid !== uid);
    const idx = credentials.findIndex((c) => c.uid === uid);
    if (idx >= 0) credentials.splice(idx, 1);
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
    const lastRun = data.runs
      .filter((r) => r.storeId === input.storeId)
      .sort((a, b) => b.timestamp - a.timestamp)[0];

    const storeMachines = data.machines[input.storeId] ?? [];
    const machines: Record<string, RunMachine> = {};
    let totalNewIn = 0;
    let totalNewOut = 0;
    input.machines.forEach((m) => {
      const machineDef = storeMachines.find((x) => x.id === m.machineId);
      // Cumulative meter readings: the user enters the current reading, and the
      // incremental amount for this run is current reading minus previous reading.
      const lastIn = lastRun?.machines[m.machineId]?.presentIn ?? machineDef?.initialIn ?? 0;
      const lastOut = lastRun?.machines[m.machineId]?.presentOut ?? machineDef?.initialOut ?? 0;
      const newIn = m.presentIn - lastIn;
      const newOut = m.presentOut - lastOut;
      totalNewIn += newIn;
      totalNewOut += newOut;
      machines[m.machineId] = {
        code: machineDef?.code,
        label: m.label,
        name: machineDef?.name,
        presentIn: m.presentIn,
        presentOut: m.presentOut,
        lastIn,
        lastOut,
        newIn,
        newOut,
        netMachine: newOut - newIn,
        photoUrl: m.photoUrl,
      };
    });
    const netTotal = totalNewOut - totalNewIn;
    const now = Date.now();
    const run: Run = {
      id: genId('run'),
      storeId: input.storeId,
      storeName: store?.name ?? 'Store',
      employeeUid: input.employeeUid,
      employeeName: input.employeeName,
      timestamp: now,
      previousRunTimestamp: lastRun?.timestamp,
      date: input.date,
      status: 'open',
      machines,
      totalNewIn,
      totalNewOut,
      netTotal,
      isPositive: netTotal >= 0,
    };
    data.runs.push(run);
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
    const store = data.stores.find((s) => s.id === run.storeId);
    if (store) {
      store.lastStorePercentage = input.storePercentage;
      store.lastVendorPercentage = input.vendorPercentage;
    }
    return clone(run);
  },

  async unlockRun(ownerId, runId) {
    await delay(80);
    const run = ownerData(ownerId).runs.find((r) => r.id === runId);
    if (run) {
      run.status = 'open';
      run.submittedAt = undefined;
    }
  },

  async deleteRun(ownerId, runId) {
    await delay(80);
    const data = ownerData(ownerId);
    data.runs = data.runs.filter((r) => r.id !== runId);
  },
};

// Exposed for the login screen hint in local mode.
export const SEED_CREDENTIALS = credentials.map((c) => ({ email: c.email, password: c.password, role: c.role }));
