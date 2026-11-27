import type { DimensionUnit, WeightUnit } from './types';

/** Backend luôn lưu cm / kg; người dùng nhập theo đơn vị đã chọn. */
export const CM_PER_IN = 2.54;
export const KG_PER_LB = 0.45359237;

const round2 = (n: number) => Math.round(n * 100) / 100;

/** "12,5" hoặc "12.5" → 12.5; rỗng → null; không hợp lệ → NaN */
export function parseDecimal(s: string): number | null {
  const t = s.trim().replace(',', '.');
  if (t === '') return null;
  if (!/^\d+(\.\d+)?$/.test(t)) return Number.NaN;
  return Number(t);
}

export function toCm(value: number | null, unit: DimensionUnit): number | null {
  if (value === null || Number.isNaN(value)) return value;
  return round2(unit === 'in' ? value * CM_PER_IN : value);
}

export function fromCm(cm: number | null | undefined, unit: DimensionUnit): number | null {
  if (cm === null || cm === undefined) return null;
  return round2(unit === 'in' ? cm / CM_PER_IN : cm);
}

export function toKg(value: number | null, unit: WeightUnit): number | null {
  if (value === null || Number.isNaN(value)) return value;
  return round2(unit === 'lb' ? value * KG_PER_LB : value);
}

export function fromKg(kg: number | null | undefined, unit: WeightUnit): number | null {
  if (kg === null || kg === undefined) return null;
  return round2(unit === 'lb' ? kg / KG_PER_LB : kg);
}

/** Số → chuỗi để đặt vào ô nhập (dấu phẩy thập phân kiểu Việt). */
export function numToInput(n: number | null | undefined): string {
  return n === null || n === undefined ? '' : String(n).replace('.', ',');
}

/** "25.000.000" ← 25000000 */
export function formatVnd(n: number | null | undefined): string {
  if (n === null || n === undefined) return '';
  return new Intl.NumberFormat('vi-VN').format(n);
}

/** Chỉ giữ chữ số: "25.000.000 ₫" → 25000000; rỗng → null */
export function parseVnd(s: string): number | null {
  const digits = s.replace(/\D/g, '');
  return digits === '' ? null : Number(digits);
}

/** "60 × 80 × 4 cm" theo đơn vị hiển thị đã chọn */
export function formatDimensions(a: {
  widthCm: number | null;
  heightCm: number | null;
  depthCm: number | null;
  dimensionUnit: DimensionUnit;
}): string {
  const parts = [a.heightCm, a.widthCm, a.depthCm]
    .filter((v): v is number => v !== null)
    .map((v) => numToInput(fromCm(v, a.dimensionUnit)));
  return parts.length ? `${parts.join(' × ')} ${a.dimensionUnit}` : '—';
}

export function formatBytes(n: number): string {
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;
}
