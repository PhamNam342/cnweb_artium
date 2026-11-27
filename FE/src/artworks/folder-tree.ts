import type { Folder } from './types';

/** Khớp FoldersService.MAX_FOLDER_DEPTH ở backend. */
export const MAX_FOLDER_DEPTH = 3;

const byOrder = (a: Folder, b: Folder) =>
  a.position - b.position || a.name.localeCompare(b.name, 'vi');

export function childrenOf(folders: Folder[], parentId: string | null): Folder[] {
  return folders.filter((f) => f.parentId === parentId).sort(byOrder);
}

/** Đường dẫn từ gốc tới thư mục (gồm cả nó). Rỗng nếu không tìm thấy. */
export function pathTo(folders: Folder[], id: string | null | undefined): Folder[] {
  const byId = new Map(folders.map((f) => [f.id, f]));
  const path: Folder[] = [];
  let cur = id ? byId.get(id) : undefined;
  while (cur && path.length <= folders.length) {
    path.unshift(cur);
    cur = cur.parentId ? byId.get(cur.parentId) : undefined;
  }
  return path;
}

/** Cấp của thư mục: thư mục gốc = 1. */
export const depthOf = (folders: Folder[], id: string) => pathTo(folders, id).length;

/** Mọi thư mục con cháu của id (không gồm chính nó). */
export function descendantsOf(folders: Folder[], id: string): Set<string> {
  const out = new Set<string>();
  const stack = [id];
  while (stack.length) {
    const cur = stack.pop()!;
    for (const c of folders) {
      if (c.parentId === cur && !out.has(c.id)) {
        out.add(c.id);
        stack.push(c.id);
      }
    }
  }
  return out;
}

/** Số cấp của cây con tính từ id (1 = không có con). */
export function heightOf(folders: Folder[], id: string): number {
  const kids = folders.filter((f) => f.parentId === id);
  return 1 + (kids.length ? Math.max(...kids.map((k) => heightOf(folders, k.id))) : 0);
}

/** Cây dàn phẳng theo thứ tự hiển thị, kèm cấp — dùng cho ô chọn thư mục. */
export function flattenTree(folders: Folder[]): { folder: Folder; depth: number }[] {
  const out: { folder: Folder; depth: number }[] = [];
  const walk = (parentId: string | null, depth: number) => {
    for (const f of childrenOf(folders, parentId)) {
      out.push({ folder: f, depth });
      walk(f.id, depth + 1);
    }
  };
  walk(null, 1);
  return out;
}

/** Nhãn có thụt lề theo cấp cho <option>. */
export const indentLabel = (name: string, depth: number) =>
  `${'   '.repeat(depth - 1)}${depth > 1 ? '└ ' : ''}${name}`;

/** Có tạo thêm thư mục con trong parentId được không (null = cấp gốc). */
export const canCreateIn = (folders: Folder[], parentId: string | null) =>
  !parentId || depthOf(folders, parentId) < MAX_FOLDER_DEPTH;

/**
 * Những nơi có thể chuyển thư mục id tới: không phải chính nó / con cháu của nó,
 * và sau khi chuyển cả cây con không vượt quá MAX_FOLDER_DEPTH cấp.
 */
export function moveTargets(folders: Folder[], id: string): { folder: Folder; depth: number }[] {
  const banned = descendantsOf(folders, id);
  banned.add(id);
  const h = heightOf(folders, id);
  return flattenTree(folders).filter(
    ({ folder, depth }) => !banned.has(folder.id) && depth + h <= MAX_FOLDER_DEPTH,
  );
}

/** Tổng số tác phẩm trong thư mục và mọi thư mục con. */
export function totalArtworks(folders: Folder[], id: string): number {
  const ids = descendantsOf(folders, id);
  ids.add(id);
  return folders.filter((f) => ids.has(f.id)).reduce((n, f) => n + f.artworkCount, 0);
}
