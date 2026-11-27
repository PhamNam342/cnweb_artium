import { describe, expect, it } from 'vitest';
import {
  canCreateIn,
  childrenOf,
  depthOf,
  flattenTree,
  moveTargets,
  pathTo,
  totalArtworks,
} from './folder-tree';
import type { Folder } from './types';

const f = (id: string, parentId: string | null, position = 0, artworkCount = 1): Folder => ({
  id,
  name: id.toUpperCase(),
  parentId,
  position,
  isHidden: false,
  artworkCount,
});
// a ─ b ─ c      d
const folders = [f('a', null, 0), f('b', 'a'), f('c', 'b'), f('d', null, 1, 4)];

describe('folder-tree', () => {
  it('đường dẫn, cấp, con trực tiếp', () => {
    expect(pathTo(folders, 'c').map((x) => x.id)).toEqual(['a', 'b', 'c']);
    expect(depthOf(folders, 'c')).toBe(3);
    expect(childrenOf(folders, null).map((x) => x.id)).toEqual(['a', 'd']);
    expect(pathTo(folders, 'zzz')).toEqual([]);
  });

  it('dàn phẳng theo thứ tự cây', () => {
    expect(flattenTree(folders).map((x) => `${x.folder.id}${x.depth}`)).toEqual([
      'a1',
      'b2',
      'c3',
      'd1',
    ]);
  });

  it('chỉ tạo thư mục con khi chưa đủ 3 cấp', () => {
    expect(canCreateIn(folders, null)).toBe(true);
    expect(canCreateIn(folders, 'b')).toBe(true);
    expect(canCreateIn(folders, 'c')).toBe(false);
  });

  it('không chuyển được vào chính nó, con cháu, hoặc vượt 3 cấp', () => {
    // a cao 3 cấp → chỉ còn cấp gốc (không nằm trong danh sách) — không thư mục nào nhận được
    expect(moveTargets(folders, 'a')).toEqual([]);
    // b cao 2 cấp → chỉ nằm được trong thư mục cấp 1: a (cha hiện tại) hoặc d
    expect(moveTargets(folders, 'b').map((x) => x.folder.id)).toEqual(['a', 'd']);
    // d (1 cấp) → vào a hoặc b, không vào c (sẽ thành cấp 4)
    expect(moveTargets(folders, 'd').map((x) => x.folder.id)).toEqual(['a', 'b']);
  });

  it('đếm tác phẩm cả cây con', () => {
    expect(totalArtworks(folders, 'a')).toBe(3);
  });
});
