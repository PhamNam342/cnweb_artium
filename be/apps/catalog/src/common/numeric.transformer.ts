import { ValueTransformer } from 'typeorm';

/** Postgres trả numeric dạng string => chuyển về number (null giữ nguyên). */
export const numericTransformer: ValueTransformer = {
  to: (v: number | null | undefined) => v,
  from: (v: string | null) =>
    v === null || v === undefined ? null : Number(v),
};
