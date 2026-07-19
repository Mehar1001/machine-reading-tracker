import { describe, it, expect } from 'vitest';
import { calcRun } from '../calc';
import type { Machine, Run } from '../types';

const ownerId = 'owner_1';
const storeId = 'store_1';

function machine(label: string, id: string, initialIn = 0, initialOut = 0): Machine {
  return {
    id,
    code: `M${id.slice(-1)}`,
    label,
    order: 1,
    active: true,
    initialIn,
    initialOut,
  };
}

describe('calcRun formula rules', () => {
  it('positive net: one machine', () => {
    const run = calcRun({
      runId: 'run_1',
      storeId,
      storeName: 'Test Store',
      employeeUid: 'emp_1',
      employeeName: 'Test Employee',
      date: '2026-06-29',
      timestamp: 1,
      previousRun: null,
      machineDefs: [machine('Slot A', 'm1', 0, 0)],
      machines: [{ machineId: 'm1', label: 'Slot A', presentIn: 500, presentOut: 200 }],
      visitNumber: 1,
      machineVisitNumbers: { m1: 1 },
    });
    expect(run.totalNewIn).toBe(500);
    expect(run.totalNewOut).toBe(200);
    expect(run.netTotal).toBe(300);
    expect(run.isPositive).toBe(true);
    expect(run.machines.m1.netMachine).toBe(300);
  });

  it('negative net: one machine (OUT > IN)', () => {
    const run = calcRun({
      runId: 'run_1',
      storeId,
      storeName: 'Test Store',
      employeeUid: 'emp_1',
      employeeName: 'Test Employee',
      date: '2026-06-29',
      timestamp: 1,
      previousRun: null,
      machineDefs: [machine('Slot A', 'm1', 0, 0)],
      machines: [{ machineId: 'm1', label: 'Slot A', presentIn: 500, presentOut: 578 }],
      visitNumber: 1,
      machineVisitNumbers: { m1: 1 },
    });
    expect(run.machines.m1.netMachine).toBe(-78);
    expect(run.netTotal).toBe(-78);
    expect(run.isPositive).toBe(false);
  });

  it('zero net', () => {
    const run = calcRun({
      runId: 'run_1',
      storeId,
      storeName: 'Test Store',
      employeeUid: 'emp_1',
      employeeName: 'Test Employee',
      date: '2026-06-29',
      timestamp: 1,
      previousRun: null,
      machineDefs: [machine('Slot A', 'm1', 0, 0)],
      machines: [{ machineId: 'm1', label: 'Slot A', presentIn: 250, presentOut: 250 }],
      visitNumber: 1,
      machineVisitNumbers: { m1: 1 },
    });
    expect(run.netTotal).toBe(0);
    expect(run.isPositive).toBe(true);
  });

  it('multiple machines accumulate correctly', () => {
    const run = calcRun({
      runId: 'run_1',
      storeId,
      storeName: 'Test Store',
      employeeUid: 'emp_1',
      employeeName: 'Test Employee',
      date: '2026-06-29',
      timestamp: 1,
      previousRun: null,
      machineDefs: [
        machine('Slot A', 'm1', 0, 0),
        machine('Slot B', 'm2', 0, 0),
      ],
      machines: [
        { machineId: 'm1', label: 'Slot A', presentIn: 3644, presentOut: 1925 },
        { machineId: 'm2', label: 'Slot B', presentIn: 2187, presentOut: 3100 },
      ],
      visitNumber: 1,
      machineVisitNumbers: { m1: 1, m2: 1 },
    });
    expect(run.totalNewIn).toBe(5831);
    expect(run.totalNewOut).toBe(5025);
    expect(run.netTotal).toBe(806);
    expect(run.machines.m1.netMachine).toBe(1719);
    expect(run.machines.m2.netMachine).toBe(-913);
    expect(run.isPositive).toBe(true);
  });

  it('decimal/currency input formatting', () => {
    const run = calcRun({
      runId: 'run_1',
      storeId,
      storeName: 'Test Store',
      employeeUid: 'emp_1',
      employeeName: 'Test Employee',
      date: '2026-06-29',
      timestamp: 1,
      previousRun: null,
      machineDefs: [machine('Slot A', 'm1', 0, 0)],
      machines: [{ machineId: 'm1', label: 'Slot A', presentIn: 1234.56, presentOut: 987.65 }],
      visitNumber: 1,
      machineVisitNumbers: { m1: 1 },
    });
    expect(run.totalNewIn).toBeCloseTo(1234.56, 2);
    expect(run.totalNewOut).toBeCloseTo(987.65, 2);
    expect(run.netTotal).toBeCloseTo(246.91, 2);
  });

  it('very large values', () => {
    const run = calcRun({
      runId: 'run_1',
      storeId,
      storeName: 'Test Store',
      employeeUid: 'emp_1',
      employeeName: 'Test Employee',
      date: '2026-06-29',
      timestamp: 1,
      previousRun: null,
      machineDefs: [machine('Slot A', 'm1', 0, 0)],
      machines: [{ machineId: 'm1', label: 'Slot A', presentIn: 1_000_000_000, presentOut: 999_999_999 }],
      visitNumber: 1,
      machineVisitNumbers: { m1: 1 },
    });
    expect(run.netTotal).toBe(1);
    expect(run.isPositive).toBe(true);
  });

  it('empty input defaults to 0.00', () => {
    const run = calcRun({
      runId: 'run_1',
      storeId,
      storeName: 'Test Store',
      employeeUid: 'emp_1',
      employeeName: 'Test Employee',
      date: '2026-06-29',
      timestamp: 1,
      previousRun: null,
      machineDefs: [machine('Slot A', 'm1', 0, 0)],
      machines: [{ machineId: 'm1', label: 'Slot A', presentIn: 0, presentOut: 0 }],
      visitNumber: 1,
      machineVisitNumbers: { m1: 1 },
    });
    expect(run.totalNewIn).toBe(0);
    expect(run.totalNewOut).toBe(0);
    expect(run.netTotal).toBe(0);
    expect(run.machines.m1.netMachine).toBe(0);
  });
});

describe('calcRun repeat-visit carry-forward', () => {
  function buildPreviousRun(presentIn: number, presentOut: number): Run {
    return {
      id: 'prev',
      storeId,
      storeName: 'Test Store',
      employeeUid: 'emp_1',
      employeeName: 'Test Employee',
      timestamp: 1,
      date: '2026-06-29',
      status: 'locked',
      machines: {
        m1: {
          code: 'MA',
          label: 'Slot A',
          presentIn,
          presentOut,
          lastIn: 0,
          lastOut: 0,
          newIn: presentIn,
          newOut: presentOut,
          netMachine: presentIn - presentOut,
        },
      },
      totalNewIn: presentIn,
      totalNewOut: presentOut,
      netTotal: presentIn - presentOut,
      isPositive: presentIn >= presentOut,
      visitNumber: 1,
      createdAt: 1,
      updatedAt: 1,
    };
  }

  it('first visit uses initial values as previous', () => {
    const run = calcRun({
      runId: 'run_1',
      storeId,
      storeName: 'Test Store',
      employeeUid: 'emp_1',
      employeeName: 'Test Employee',
      date: '2026-06-29',
      timestamp: 2,
      previousRun: null,
      machineDefs: [machine('Slot A', 'm1', 100, 50)],
      machines: [{ machineId: 'm1', label: 'Slot A', presentIn: 500, presentOut: 200 }],
      visitNumber: 1,
      machineVisitNumbers: { m1: 1 },
    });
    expect(run.machines.m1.lastIn).toBe(100);
    expect(run.machines.m1.lastOut).toBe(50);
    expect(run.machines.m1.newIn).toBe(400);
    expect(run.machines.m1.newOut).toBe(150);
    expect(run.machines.m1.netMachine).toBe(250);
  });

  it('second visit carries from previous saved visit', () => {
    const previous = buildPreviousRun(500, 200);
    const run = calcRun({
      runId: 'run_2',
      storeId,
      storeName: 'Test Store',
      employeeUid: 'emp_1',
      employeeName: 'Test Employee',
      date: '2026-06-29',
      timestamp: 2,
      previousRunTimestamp: previous.timestamp,
      previousRun: previous,
      machineDefs: [machine('Slot A', 'm1', 0, 0)],
      machines: [{ machineId: 'm1', label: 'Slot A', presentIn: 900, presentOut: 350 }],
      visitNumber: 2,
      machineVisitNumbers: { m1: 2 },
    });
    expect(run.machines.m1.lastIn).toBe(500);
    expect(run.machines.m1.lastOut).toBe(200);
    expect(run.machines.m1.newIn).toBe(400);
    expect(run.machines.m1.newOut).toBe(150);
    expect(run.machines.m1.netMachine).toBe(250);
    expect(run.visitNumber).toBe(2);
  });

  it('third visit continues chaining', () => {
    const first = buildPreviousRun(500, 200);
    const second = calcRun({
      runId: 'run_2',
      storeId,
      storeName: 'Test Store',
      employeeUid: 'emp_1',
      employeeName: 'Test Employee',
      date: '2026-06-29',
      timestamp: 2,
      previousRunTimestamp: first.timestamp,
      previousRun: first,
      machineDefs: [machine('Slot A', 'm1', 0, 0)],
      machines: [{ machineId: 'm1', label: 'Slot A', presentIn: 900, presentOut: 350 }],
      visitNumber: 2,
      machineVisitNumbers: { m1: 2 },
    });
    const third = calcRun({
      runId: 'run_3',
      storeId,
      storeName: 'Test Store',
      employeeUid: 'emp_1',
      employeeName: 'Test Employee',
      date: '2026-06-29',
      timestamp: 3,
      previousRunTimestamp: second.timestamp,
      previousRun: second,
      machineDefs: [machine('Slot A', 'm1', 0, 0)],
      machines: [{ machineId: 'm1', label: 'Slot A', presentIn: 1200, presentOut: 500 }],
      visitNumber: 3,
      machineVisitNumbers: { m1: 3 },
    });
    expect(third.machines.m1.lastIn).toBe(900);
    expect(third.machines.m1.lastOut).toBe(350);
    expect(third.machines.m1.newIn).toBe(300);
    expect(third.machines.m1.newOut).toBe(150);
    expect(third.machines.m1.netMachine).toBe(150);
    expect(third.visitNumber).toBe(3);
  });

  it('multiple same-day visits each create new history', () => {
    const first = calcRun({
      runId: 'run_1',
      storeId,
      storeName: 'Test Store',
      employeeUid: 'emp_1',
      employeeName: 'Test Employee',
      date: '2026-06-29',
      timestamp: 1,
      previousRun: null,
      machineDefs: [machine('Slot A', 'm1', 0, 0)],
      machines: [{ machineId: 'm1', label: 'Slot A', presentIn: 100, presentOut: 50 }],
      visitNumber: 1,
      machineVisitNumbers: { m1: 1 },
    });
    const second = calcRun({
      runId: 'run_2',
      storeId,
      storeName: 'Test Store',
      employeeUid: 'emp_1',
      employeeName: 'Test Employee',
      date: '2026-06-29',
      timestamp: 2,
      previousRunTimestamp: first.timestamp,
      previousRun: first,
      machineDefs: [machine('Slot A', 'm1', 0, 0)],
      machines: [{ machineId: 'm1', label: 'Slot A', presentIn: 250, presentOut: 100 }],
      visitNumber: 2,
      machineVisitNumbers: { m1: 2 },
    });
    expect(second.machines.m1.lastIn).toBe(100);
    expect(second.machines.m1.lastOut).toBe(50);
    expect(second.machines.m1.newIn).toBe(150);
    expect(second.machines.m1.newOut).toBe(50);
    expect(second.machines.m1.netMachine).toBe(100);
  });

  it('multiple different-day visits carry forward latest per machine', () => {
    const first = buildPreviousRun(1000, 400);
    const second = calcRun({
      runId: 'run_2',
      storeId,
      storeName: 'Test Store',
      employeeUid: 'emp_1',
      employeeName: 'Test Employee',
      date: '2026-06-30',
      timestamp: 2,
      previousRunTimestamp: first.timestamp,
      previousRun: first,
      machineDefs: [machine('Slot A', 'm1', 0, 0)],
      machines: [{ machineId: 'm1', label: 'Slot A', presentIn: 1500, presentOut: 700 }],
      visitNumber: 1,
      machineVisitNumbers: { m1: 1 },
    });
    expect(second.machines.m1.lastIn).toBe(1000);
    expect(second.machines.m1.lastOut).toBe(400);
    expect(second.machines.m1.newIn).toBe(500);
    expect(second.machines.m1.newOut).toBe(300);
  });

  it('multiple machines and stores stay isolated', () => {
    const storeA = 'store_a';
    const storeB = 'store_b';
    const runA = calcRun({
      runId: 'run_a',
      storeId: storeA,
      storeName: 'Store A',
      employeeUid: 'emp_1',
      employeeName: 'Test Employee',
      date: '2026-06-29',
      timestamp: 1,
      previousRun: null,
      machineDefs: [machine('Slot A', 'mA', 0, 0)],
      machines: [{ machineId: 'mA', label: 'Slot A', presentIn: 100, presentOut: 40 }],
      visitNumber: 1,
      machineVisitNumbers: { mA: 1 },
    });
    const runB = calcRun({
      runId: 'run_b',
      storeId: storeB,
      storeName: 'Store B',
      employeeUid: 'emp_2',
      employeeName: 'Other Employee',
      date: '2026-06-29',
      timestamp: 2,
      previousRun: null,
      machineDefs: [machine('Slot B', 'mB', 0, 0)],
      machines: [{ machineId: 'mB', label: 'Slot B', presentIn: 50, presentOut: 30 }],
      visitNumber: 1,
      machineVisitNumbers: { mB: 1 },
    });
    expect(runA.storeId).toBe(storeA);
    expect(runB.storeId).toBe(storeB);
    expect(runA.employeeUid).toBe('emp_1');
    expect(runB.employeeUid).toBe('emp_2');
    expect(runA.netTotal).toBe(60);
    expect(runB.netTotal).toBe(20);
  });
});
