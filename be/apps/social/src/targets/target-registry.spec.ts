import { BadRequestException, NotFoundException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { SocialTargetType } from './social-target-type';
import { TargetInfo, TargetRegistry, TargetResolver } from './target-registry';

const m = {} as EntityManager;

function fakeResolver(
  type: SocialTargetType,
  data: Record<string, TargetInfo>,
  withCount = false,
): TargetResolver & { counts: [string, string, number][] } {
  const counts: [string, string, number][] = [];
  return {
    type,
    counts,
    resolve: (_m, id) => Promise.resolve(data[id] ?? null),
    ...(withCount
      ? {
          setCount: (
            _m: EntityManager,
            id: string,
            field: string,
            n: number,
          ) => {
            counts.push([id, field, n]);
            return Promise.resolve();
          },
        }
      : {}),
  };
}

describe('TargetRegistry', () => {
  let registry: TargetRegistry;

  beforeEach(() => {
    registry = new TargetRegistry();
    registry.register(
      fakeResolver(SocialTargetType.Artwork, {
        pub: { ownerId: 'u1', visible: true },
        draft: { ownerId: 'u1', visible: false },
      }),
    );
  });

  it('require trả về chủ đối tượng khi đối tượng hiển thị', async () => {
    await expect(registry.require(m, 'artwork', 'pub')).resolves.toEqual({
      ownerId: 'u1',
      visible: true,
    });
  });

  it('require ném 404 khi không tồn tại hoặc không hiển thị', async () => {
    await expect(registry.require(m, 'artwork', 'nope')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(
      registry.require(m, 'artwork', 'draft'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('find vẫn trả về đối tượng không hiển thị (dùng khi bỏ like / xóa)', async () => {
    await expect(registry.find(m, 'artwork', 'draft')).resolves.toEqual({
      ownerId: 'u1',
      visible: false,
    });
  });

  it('loại chưa đăng ký => 400', async () => {
    expect(registry.supports('review')).toBe(false);
    await expect(registry.require(m, 'review', 'x')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(registry.require(m, 'banana', 'x')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('không cho đăng ký trùng loại', () => {
    expect(() =>
      registry.register(fakeResolver(SocialTargetType.Artwork, {})),
    ).toThrow();
  });

  it('setCount gọi resolver nếu có, bỏ qua nếu không', async () => {
    const comment = fakeResolver(SocialTargetType.Comment, {}, true);
    registry.register(comment);
    await registry.setCount(m, 'comment', 'c1', 'reactions', 3);
    await registry.setCount(m, 'artwork', 'a1', 'reactions', 3); // artwork: không có setCount
    expect(comment.counts).toEqual([['c1', 'reactions', 3]]);
  });
});
