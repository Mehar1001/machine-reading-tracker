// Pure calculation helpers for voucher runs.
// These have no side effects and can be unit tested in isolation.

import type { Machine, Run, RunMachine } from './types';

export interface CalcRunInput {
  runId: string;
  storeId: string;
  storeName: string;
  employeeUid: string;
  employeeName: string;
  date: string;
  timestamp: number;
  previousRunTimestamp?: number;
  previousRun: Pick<Run, 'machines'> | null;
  machineDefs: Machine[];
  machines: { machineId: string; label: string; presentIn: number; presentOut: number; photoUrl?: string }[];
  visitNumber: number;
  machineVisitNumbers: Record<string, number>;
  createdAt?: number;
}

/**
 * Core formula rules:
 *   machine_net = voucher_new_in - voucher_new_out
 *   new_in      = present_in - last_in
 *   new_out     = present_out - last_out
 *   total_new_in = sum(machine new_in)
 *   total_new_out = sum(machine new_out)
 *   net_total    = total_new_in - total_new_out
 */
export function calcRun(input: CalcRunInput): Run {
  const machines: Record<string, RunMachine> = {};
  let totalNewIn = 0;
  let totalNewOut = 0;

  input.machines.forEach((m) => {
    const def = input.machineDefs.find((d) => d.id === m.machineId);
    const prev = input.previousRun?.machines[m.machineId];

    const lastIn = prev?.presentIn ?? def?.initialIn ?? 0;
    const lastOut = prev?.presentOut ?? def?.initialOut ?? 0;

    const newIn = m.presentIn - lastIn;
    const newOut = m.presentOut - lastOut;
    const netMachine = newIn - newOut;

    totalNewIn += newIn;
    totalNewOut += newOut;

    machines[m.machineId] = {
      code: def?.code,
      label: m.label,
      name: def?.name,
      presentIn: m.presentIn,
      presentOut: m.presentOut,
      lastIn,
      lastOut,
      newIn,
      newOut,
      netMachine,
      photoUrl: m.photoUrl,
      visitNumber: input.machineVisitNumbers[m.machineId] ?? input.visitNumber,
    };
  });

  const netTotal = totalNewIn - totalNewOut;
  const now = input.createdAt ?? input.timestamp;

  return {
    id: input.runId,
    storeId: input.storeId,
    storeName: input.storeName,
    employeeUid: input.employeeUid,
    employeeName: input.employeeName,
    timestamp: input.timestamp,
    previousRunTimestamp: input.previousRunTimestamp,
    date: input.date,
    status: 'open',
    machines,
    totalNewIn,
    totalNewOut,
    netTotal,
    isPositive: netTotal >= 0,
    visitNumber: input.visitNumber,
    createdAt: now,
    updatedAt: now,
    printStatus: 'pending',
  };
}
