// Shared domain models + backend interface.
// All screens talk to this interface only — never to a concrete backend.

export type Role = 'owner' | 'employee';

export type RunStatus = 'open' | 'submitted' | 'locked';

export interface SessionUser {
  ownerId: string; // the owner UID whose data tree is used for all queries
  uid: string; // the logged-in user's UID (owner or employee)
  name: string;
  email: string;
  role: Role;
}

export interface Store {
  id: string;
  code: string; // short auto-generated display ID, e.g. TX001
  name: string;
  address: string;
  zipCode?: string;
  lastStorePercentage: number;
  lastVendorPercentage: number;
  active: boolean;
  createdAt: number; // epoch ms
}

export interface Machine {
  id: string;
  code: string; // short auto-generated display ID, e.g. XY001
  label: string;
  name?: string; // optional human-friendly name (e.g. "Slot A")
  order: number;
  initialIn?: number;
  initialOut?: number;
  photoRequired?: boolean;
  active: boolean;
}

export interface Employee {
  uid: string;
  name: string;
  email: string;
  role: Role;
  active: boolean;
  createdAt: number;
}

export interface RunMachine {
  code?: string;
  label: string;
  name?: string;
  presentIn: number;
  presentOut: number;
  lastIn: number;
  lastOut: number;
  newIn: number;
  newOut: number;
  netMachine: number;
  photoUrl?: string;
}

export interface Run {
  id: string;
  storeId: string;
  storeName: string;
  employeeUid: string;
  employeeName: string;
  timestamp: number; // epoch ms
  previousRunTimestamp?: number; // epoch ms for the last run used as the baseline
  date: string; // "YYYY-MM-DD"
  status: RunStatus;
  machines: Record<string, RunMachine>;
  totalNewIn: number;
  totalNewOut: number;
  netTotal: number;
  isPositive: boolean;
  storePercentage?: number;
  vendorPercentage?: number;
  storeCalculatedAmount?: number;
  vendorCalculatedAmount?: number;
  submittedAt?: number;
  notes?: string;
}

// ─── Input payloads ──────────────────────────────────────────

export interface CreateRunInput {
  storeId: string;
  employeeUid: string;
  employeeName: string;
  date: string;
  machines: {
    machineId: string;
    label: string;
    presentIn: number;
    presentOut: number;
    photoUrl?: string;
  }[];
}

export interface SubmitRunInput {
  runId: string;
  storePercentage: number;
  vendorPercentage: number;
}

export interface CreateStoreInput {
  name: string;
  address: string;
  zipCode?: string;
  storePercentage?: number;
  vendorPercentage?: number;
  code?: string; // auto-generated if omitted
}

export interface CreateMachineInput {
  storeId: string;
  label: string;
  name?: string;
  code?: string; // auto-generated if omitted
  order?: number;
  initialIn?: number;
  initialOut?: number;
  photoRequired?: boolean;
}

export interface CreateEmployeeInput {
  name: string;
  email: string;
  password: string;
}

export interface RunFilters {
  storeId?: string;
  employeeUid?: string;
  status?: RunStatus;
  isPositive?: boolean;
  dateFrom?: string; // "YYYY-MM-DD"
  dateTo?: string; // "YYYY-MM-DD"
}

// ─── Backend interface ───────────────────────────────────────

export interface Backend {
  // auth
  login(email: string, password: string): Promise<SessionUser>;
  logout(): Promise<void>;

  // stores
  getStores(ownerId: string): Promise<Store[]>;
  getStore(ownerId: string, storeId: string): Promise<Store | null>;
  createStore(ownerId: string, input: CreateStoreInput): Promise<Store>;
  updateStore(ownerId: string, storeId: string, patch: Partial<Store>): Promise<void>;
  deleteStore(ownerId: string, storeId: string): Promise<void>;

  // machines
  getMachines(ownerId: string, storeId: string): Promise<Machine[]>;
  createMachine(ownerId: string, input: CreateMachineInput): Promise<Machine>;
  updateMachine(ownerId: string, storeId: string, machineId: string, patch: Partial<Machine>): Promise<void>;
  deleteMachine(ownerId: string, storeId: string, machineId: string): Promise<void>;

  // employees
  getEmployees(ownerId: string): Promise<Employee[]>;
  createEmployee(ownerId: string, input: CreateEmployeeInput): Promise<Employee>;
  setEmployeeActive(ownerId: string, uid: string, active: boolean): Promise<void>;
  deleteEmployee(ownerId: string, uid: string): Promise<void>;

  // runs
  getRuns(ownerId: string, filters?: RunFilters): Promise<Run[]>;
  getRun(ownerId: string, runId: string): Promise<Run | null>;
  getLastRun(ownerId: string, storeId: string): Promise<Run | null>;
  createRun(ownerId: string, input: CreateRunInput): Promise<Run>;
  submitRun(ownerId: string, input: SubmitRunInput): Promise<Run>;
  unlockRun(ownerId: string, runId: string): Promise<void>;
  deleteRun(ownerId: string, runId: string): Promise<void>;
}
