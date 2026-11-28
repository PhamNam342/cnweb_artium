import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { SocialTargetType } from './social-target-type';

export interface TargetInfo {
  /** Chủ đối tượng (chủ tác phẩm, tác giả bình luận, người đăng moment). */
  ownerId: string;
  /** Người xem hiện tại có được thấy / tương tác không (VD: tác phẩm nháp, moment hết hạn => false). */
  visible: boolean;
}

export type TargetCountField = 'reactions' | 'comments';

/**
 * Mỗi loại đối tượng (artwork, comment, moment...) đăng ký một resolver.
 * Like (#01) và bình luận (#02) chỉ làm việc với registry, không phải biết từng loại.
 */
export interface TargetResolver {
  readonly type: SocialTargetType;
  /** null = không tồn tại. viewerId: để chủ moment hết hạn vẫn thấy moment của mình (#05). */
  resolve(
    m: EntityManager,
    id: string,
    viewerId?: string,
  ): Promise<TargetInfo | null>;
  /**
   * Ghi số đếm mới vào bảng của đối tượng (comments.reaction_count, moments.comment_count...).
   * Bỏ trống nếu số đếm nằm ở service khác (artwork: catalog cập nhật qua event).
   */
  setCount?(
    m: EntityManager,
    id: string,
    field: TargetCountField,
    count: number,
  ): Promise<void>;
}

export const TARGET_NOT_FOUND = 'Không tìm thấy đối tượng';
export const TARGET_UNSUPPORTED = 'Chưa hỗ trợ loại đối tượng này';

@Injectable()
export class TargetRegistry {
  private readonly resolvers = new Map<SocialTargetType, TargetResolver>();

  register(resolver: TargetResolver): void {
    if (this.resolvers.has(resolver.type)) {
      throw new Error(`Resolver cho "${resolver.type}" đã được đăng ký`);
    }
    this.resolvers.set(resolver.type, resolver);
  }

  supports(type: string): type is SocialTargetType {
    return this.resolvers.has(type as SocialTargetType);
  }

  /** Loại chưa đăng ký (moodboard, review...) => 400. */
  resolverFor(type: string): TargetResolver {
    const r = this.resolvers.get(type as SocialTargetType);
    if (!r) throw new BadRequestException(TARGET_UNSUPPORTED);
    return r;
  }

  /** Tìm đối tượng, KHÔNG kiểm tra visible (dùng cho bỏ like / xóa bình luận trên đối tượng đã bị gỡ). */
  find(
    m: EntityManager,
    type: string,
    id: string,
    viewerId?: string,
  ): Promise<TargetInfo | null> {
    return this.resolverFor(type).resolve(m, id, viewerId);
  }

  /** Đối tượng phải tồn tại và người xem được thấy, nếu không => 404. */
  async require(
    m: EntityManager,
    type: string,
    id: string,
    viewerId?: string,
  ): Promise<TargetInfo> {
    const info = await this.find(m, type, id, viewerId);
    if (!info || !info.visible) throw new NotFoundException(TARGET_NOT_FOUND);
    return info;
  }

  /** Ghi số đếm nếu loại đối tượng có lưu số đếm tại social; không thì bỏ qua. */
  async setCount(
    m: EntityManager,
    type: string,
    id: string,
    field: TargetCountField,
    count: number,
  ): Promise<void> {
    await this.resolverFor(type).setCount?.(m, id, field, count);
  }
}
