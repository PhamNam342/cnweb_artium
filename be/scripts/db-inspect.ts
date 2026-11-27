/**
 * Xem database đang có những bảng nào, mỗi bảng có những cột nào (đọc trực tiếp từ Postgres).
 *
 *   npm run db:inspect                         mọi service
 *   npm run db:inspect -- catalog              một service
 *   npm run db:inspect -- catalog artworks     một bảng
 *   npm run db:inspect -- all --md             ghi ra file docs/database/db-actual.md
 *   npm run db:inspect -- all --summary        chỉ liệt kê tên bảng + số cột + số dòng
 *
 * Kết nối lấy từ <SERVICE>_DATABASE_URL trong be/.env.
 */
import { config } from 'dotenv';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DataSource } from 'typeorm';

config({ path: join(__dirname, '..', '.env'), quiet: true });

const SERVICES = ['identity', 'catalog', 'commerce', 'social', 'crm'];

interface ColumnRow {
  table_name: string;
  column_name: string;
  data_type: string;
  is_nullable: boolean;
  column_default: string | null;
  ordinal: number;
}
interface ConstraintRow {
  table_name: string;
  name: string;
  type: 'p' | 'f' | 'u' | 'c';
  definition: string;
}
interface IndexRow {
  table_name: string;
  name: string;
  definition: string;
  is_constraint: boolean;
}
interface TableRow {
  table_name: string;
  row_estimate: string;
  comment: string | null;
}

interface TableInfo {
  name: string;
  rows: number;
  comment: string | null;
  columns: {
    name: string;
    type: string;
    nullable: boolean;
    default: string | null;
    pk: boolean;
    fk: string | null;
    unique: boolean;
  }[];
  constraints: ConstraintRow[];
  indexes: IndexRow[];
}

interface ServiceResult {
  service: string;
  tables: TableInfo[];
  enums: Map<string, string[]>;
}

const indexLabel = (i: IndexRow) =>
  /^CREATE UNIQUE/.test(i.definition) ? 'UNIQUE INDEX' : 'INDEX';

/** Bảng nội bộ, ẩn trừ khi truyền --all-tables */
const INFRA = new Set(['typeorm_migrations', 'outbox', 'inbox']);

async function inspect(
  url: string,
  onlyTable?: string,
): Promise<{ tables: TableInfo[]; enums: Map<string, string[]> }> {
  const ds = await new DataSource({ type: 'postgres', url }).initialize();
  try {
    const tables: TableRow[] = await ds.query(
      `SELECT c.relname AS table_name,
              -- reltuples = -1 khi chưa ANALYZE: đếm thật ở dưới
              c.reltuples::bigint AS row_estimate,
              obj_description(c.oid) AS comment
       FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND c.relkind = 'r' AND ($1::text IS NULL OR c.relname = $1)
       ORDER BY c.relname`,
      [onlyTable ?? null],
    );
    const columns: ColumnRow[] = await ds.query(
      `SELECT c.relname AS table_name, a.attname AS column_name,
              format_type(a.atttypid, a.atttypmod) AS data_type,
              NOT a.attnotnull AS is_nullable,
              pg_get_expr(d.adbin, d.adrelid) AS column_default,
              a.attnum AS ordinal
       FROM pg_attribute a
       JOIN pg_class c ON c.oid = a.attrelid
       JOIN pg_namespace n ON n.oid = c.relnamespace
       LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
       WHERE n.nspname = 'public' AND c.relkind = 'r' AND a.attnum > 0 AND NOT a.attisdropped
       ORDER BY c.relname, a.attnum`,
    );
    const constraints: ConstraintRow[] = await ds.query(
      `SELECT c.relname AS table_name, con.conname AS name, con.contype AS type,
              pg_get_constraintdef(con.oid) AS definition
       FROM pg_constraint con
       JOIN pg_class c ON c.oid = con.conrelid
       JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND con.contype IN ('p', 'f', 'u', 'c')
       ORDER BY c.relname, con.contype, con.conname`,
    );
    const indexes: IndexRow[] = await ds.query(
      `SELECT i.tablename AS table_name, i.indexname AS name, i.indexdef AS definition,
              EXISTS (SELECT 1 FROM pg_constraint con WHERE con.conname = i.indexname) AS is_constraint
       FROM pg_indexes i WHERE i.schemaname = 'public'
       ORDER BY i.tablename, i.indexname`,
    );

    const enumRows: { name: string; value: string }[] = await ds.query(
      `SELECT t.typname AS name, e.enumlabel AS value
       FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid
       JOIN pg_namespace n ON n.oid = t.typnamespace
       WHERE n.nspname = 'public' ORDER BY t.typname, e.enumsortorder`,
    );
    const enums = new Map<string, string[]>();
    for (const r of enumRows)
      enums.set(r.name, [...(enums.get(r.name) ?? []), r.value]);

    const result: TableInfo[] = [];
    for (const t of tables) {
      let rows = Number(t.row_estimate);
      if (rows < 0 || rows < 10_000) {
        const [{ n }]: { n: string }[] = await ds.query(
          `SELECT COUNT(*) AS n FROM "${t.table_name}"`,
        );
        rows = Number(n);
      }
      const cons = constraints.filter((c) => c.table_name === t.table_name);
      // Cột thuộc PK / FK / UNIQUE: tách từ định nghĩa constraint, VD "FOREIGN KEY (seller_id) REFERENCES ..."
      const colsOf = (def: string) =>
        (def.match(/\(([^)]*)\)/)?.[1] ?? '')
          .split(',')
          .map((s) => s.trim().replace(/"/g, ''));
      const pkCols = new Set(
        cons.filter((c) => c.type === 'p').flatMap((c) => colsOf(c.definition)),
      );
      const uniqueCols = new Set(
        cons
          .filter((c) => c.type === 'u')
          .map((c) => colsOf(c.definition))
          .filter((cols) => cols.length === 1)
          .flat(),
      );
      const fkOf = new Map<string, string>();
      for (const c of cons.filter((x) => x.type === 'f')) {
        const ref = c.definition.match(/REFERENCES ([^(]+)\(([^)]*)\)(.*)$/);
        const target = ref
          ? `${ref[1].trim()}.${ref[2]}${ref[3].includes('CASCADE') ? ' (cascade)' : ref[3].includes('SET NULL') ? ' (set null)' : ''}`
          : c.definition;
        for (const col of colsOf(c.definition)) fkOf.set(col, target);
      }
      // Unique index một cột (VD tạo bằng CREATE UNIQUE INDEX) cũng tính là unique
      for (const i of indexes.filter(
        (x) => x.table_name === t.table_name && /UNIQUE/.test(x.definition),
      )) {
        const cols = colsOf(
          i.definition.slice(i.definition.indexOf(' USING ')),
        );
        if (cols.length === 1 && !/ WHERE /.test(i.definition))
          uniqueCols.add(cols[0]);
      }
      result.push({
        name: t.table_name,
        rows,
        comment: t.comment,
        columns: columns
          .filter((c) => c.table_name === t.table_name)
          .map((c) => ({
            name: c.column_name,
            type: c.data_type,
            nullable: c.is_nullable,
            default: c.column_default,
            pk: pkCols.has(c.column_name),
            fk: fkOf.get(c.column_name) ?? null,
            unique: uniqueCols.has(c.column_name),
          })),
        constraints: cons,
        indexes: indexes.filter(
          (i) => i.table_name === t.table_name && !i.is_constraint,
        ),
      });
    }
    return { tables: result, enums };
  } finally {
    await ds.destroy();
  }
}

// ───────────────────────── Hiển thị ─────────────────────────

const c = {
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
  cyan: (s: string) => `\x1b[36m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
};
const plain = !process.stdout.isTTY;
const style = (fn: (s: string) => string, s: string) => (plain ? s : fn(s));

function flags(col: TableInfo['columns'][number]): string {
  return [
    col.pk && 'PK',
    col.unique && !col.pk && 'UNIQUE',
    col.fk && `FK → ${col.fk}`,
  ]
    .filter(Boolean)
    .join(', ');
}

function shortDefault(d: string | null): string {
  if (!d) return '';
  return d
    .replace(/::[a-z_ ]+(\[\])?/g, '')
    .replace(/^nextval\(.*\)$/, 'tự tăng');
}

function printTable(t: TableInfo): void {
  console.log(
    `\n  ${style(c.bold, t.name)} ${style(c.dim, `— ${t.columns.length} cột, ${t.rows} dòng`)}`,
  );
  const rows = t.columns.map((col) => [
    col.name,
    col.type,
    col.nullable ? 'NULL' : 'NOT NULL',
    shortDefault(col.default),
    flags(col),
  ]);
  const head = ['Cột', 'Kiểu', 'Null', 'Mặc định', 'Khóa'];
  const widths = head.map((h, i) =>
    Math.min(48, Math.max(h.length, ...rows.map((r) => r[i].length))),
  );
  const line = (cells: string[]) =>
    '    ' +
    cells
      .map((s, i) =>
        s.length > widths[i]
          ? s.slice(0, widths[i] - 1) + '…'
          : s.padEnd(widths[i]),
      )
      .join('  ');
  console.log(style(c.dim, line(head)));
  for (const r of rows) console.log(line(r));
  const checks = t.constraints.filter((x) => x.type === 'c');
  const multiUnique = t.constraints.filter(
    (x) => x.type === 'u' && x.definition.includes(','),
  );
  for (const x of [...multiUnique, ...checks]) {
    console.log(
      style(
        c.dim,
        `    ${x.type === 'c' ? 'CHECK' : 'UNIQUE'} ${x.name}: ${x.definition}`,
      ),
    );
  }
  for (const i of t.indexes) {
    console.log(
      style(
        c.dim,
        `    ${indexLabel(i)} ${i.name}: ${i.definition.replace(/^.* USING /, '')}`,
      ),
    );
  }
}

function toMarkdown(all: ServiceResult[]): string {
  const out: string[] = [
    '# Schema thực tế trong database',
    '',
    `> Sinh bởi \`npm run db:inspect -- all --md\` lúc ${new Date().toLocaleString('vi-VN')}. ` +
      'Đọc trực tiếp từ Postgres — dùng để đối chiếu với `schema-entities.md` (thiết kế).',
    '',
  ];
  for (const { service, tables, enums } of all) {
    out.push(`## ${service}_db (${tables.length} bảng)`, '');
    for (const t of tables) {
      out.push(
        `### \`${t.name}\` — ${t.rows} dòng`,
        '',
        '| Cột | Kiểu | Null | Mặc định | Khóa |',
        '| --- | --- | --- | --- | --- |',
      );
      for (const col of t.columns) {
        out.push(
          `| \`${col.name}\` | \`${col.type}\` | ${col.nullable ? 'NULL' : 'NOT NULL'} | ${shortDefault(col.default).replace(/\|/g, '\\|')} | ${flags(col)} |`,
        );
      }
      const extra = [
        ...t.constraints.filter(
          (x) =>
            x.type === 'c' || (x.type === 'u' && x.definition.includes(',')),
        ),
      ].map(
        (x) =>
          `- ${x.type === 'c' ? 'CHECK' : 'UNIQUE'} \`${x.name}\`: \`${x.definition}\``,
      );
      extra.push(
        ...t.indexes.map(
          (i) =>
            `- ${indexLabel(i)} \`${i.name}\`: \`${i.definition.replace(/^.* USING /, '')}\``,
        ),
      );
      if (extra.length) out.push('', ...extra);
      out.push('');
    }
    if (enums.size) {
      out.push('### Kiểu enum', '');
      for (const [name, values] of enums)
        out.push(`- \`${name}\`: ${values.join(' | ')}`);
      out.push('');
    }
  }
  return out.join('\n');
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const opts = new Set(args.filter((a) => a.startsWith('--')));
  const [target = 'all', table] = args.filter((a) => !a.startsWith('--'));
  const services = target === 'all' ? SERVICES : [target];
  if (!services.every((s) => SERVICES.includes(s))) {
    console.error(
      `Service không hợp lệ: ${target}. Chọn: ${SERVICES.join(', ')} hoặc all`,
    );
    process.exit(1);
  }

  const all: ServiceResult[] = [];
  for (const service of services) {
    const url = process.env[`${service.toUpperCase()}_DATABASE_URL`];
    if (!url) {
      console.error(
        `⚠ Thiếu ${service.toUpperCase()}_DATABASE_URL trong be/.env — bỏ qua ${service}`,
      );
      continue;
    }
    try {
      const r = await inspect(url, table);
      let tables = r.tables;
      if (!opts.has('--all-tables') && !table)
        tables = tables.filter((t) => !INFRA.has(t.name));
      // Chỉ giữ enum mà các bảng đang hiển thị dùng tới
      const used = new Set(
        tables.flatMap((t) =>
          t.columns.map((col) => col.type.replace(/\[\]$/, '')),
        ),
      );
      const enums = new Map([...r.enums].filter(([name]) => used.has(name)));
      all.push({ service, tables, enums });
    } catch (e) {
      console.error(
        `✖ ${service}: không kết nối được (${(e as Error).message})`,
      );
    }
  }

  if (opts.has('--md')) {
    const file = join(
      __dirname,
      '..',
      '..',
      'docs',
      'database',
      'db-actual.md',
    );
    writeFileSync(file, toMarkdown(all) + '\n');
    console.log(`✔ Đã ghi ${file}`);
    return;
  }

  for (const { service, tables, enums } of all) {
    const url = new URL(process.env[`${service.toUpperCase()}_DATABASE_URL`]!);
    console.log(
      `\n${style(c.cyan, `■ ${service}_db`)} ${style(c.dim, `(${url.hostname}:${url.port}${url.pathname}) — ${tables.length} bảng`)}`,
    );
    if (tables.length === 0) {
      console.log(
        style(
          c.yellow,
          table
            ? `  Không có bảng "${table}"`
            : '  Chưa có bảng nghiệp vụ (service chưa làm hoặc chưa chạy migrate)',
        ),
      );
      continue;
    }
    if (opts.has('--summary')) {
      const w = Math.max(...tables.map((t) => t.name.length));
      for (const t of tables)
        console.log(
          `  ${t.name.padEnd(w)}  ${String(t.columns.length).padStart(3)} cột  ${t.rows} dòng`,
        );
      continue;
    }
    tables.forEach(printTable);
    if (enums.size) {
      console.log(`\n  ${style(c.bold, 'Kiểu enum')}`);
      for (const [name, values] of enums) {
        console.log(`    ${name}: ${style(c.dim, values.join(' | '))}`);
      }
    }
  }
  const total = all.reduce((n, s) => n + s.tables.length, 0);
  console.log(
    `\nTổng: ${total} bảng ở ${all.length} database${opts.has('--all-tables') ? '' : ' (ẩn bảng nội bộ: outbox, inbox, typeorm_migrations — thêm --all-tables để xem)'}`,
  );
}

main().catch((e: unknown) => {
  console.error('✖', e instanceof Error ? e.message : e);
  process.exit(1);
});
