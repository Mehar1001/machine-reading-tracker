// Shared formatting helpers.

export function money(n: number | undefined | null): string {
  const v = Number(n ?? 0);
  const formatted = Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (v < 0) return `-$${formatted}`;
  return `$${formatted}`;
}

export function moneyPlain(n: number | undefined | null): string {
  return Number(n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function num(n: number | undefined | null): string {
  return Number(n ?? 0).toLocaleString('en-US');
}

export function toNumber(value: string): number {
  const n = Number(String(value).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

export function digitsOnly(value: string): string {
  return value.replace(/[^0-9]/g, '');
}

export function numericInput(value: string): string {
  // Allow one decimal point and only digits; strip leading zeros before non-zero digit
  let cleaned = value.replace(/[^0-9.]/g, '');
  const parts = cleaned.split('.');
  if (parts.length > 2) cleaned = `${parts[0]}.${parts.slice(1).join('')}`;
  return cleaned;
}

export function moneyInput(value: string): string {
  // Strip everything except digits and one decimal point, then prefix with $.
  const cleaned = value.replace(/[^0-9.]/g, '');
  const formatted = numericInput(cleaned);
  return formatted ? `$${formatted}` : '';
}

// "May 25, 2:30 PM"
export function formatDateTime(ts: number): string {
  return new Date(ts).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// "May 25, 2025  08:45 AM"
export function formatFullDateTime(ts: number): string {
  return new Date(ts).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// "May 25, 2025"
export function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}

// "YYYY-MM-DD"
export function toDateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function dateKeyToLabel(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}
