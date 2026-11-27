import { AuthUser } from '@app/common';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Repository } from 'typeorm';
import { ArtworkFolder } from './artwork-folder.entity';
import { CreateFolderDto, UpdateFolderDto } from './dto/folder.dto';

export const MAX_FOLDER_DEPTH = 3;
export const MAX_FOLDERS = 200;

export interface FolderResponse {
  id: string;
  name: string;
  parentId: string | null;
  position: number;
  isHidden: boolean;
  /** Số tác phẩm (chưa lưu trữ, chưa xóa) nằm trực tiếp trong thư mục */
  artworkCount: number;
}

@Injectable()
export class FoldersService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(ArtworkFolder)
    private readonly folders: Repository<ArtworkFolder>,
  ) {}

  /** Danh sách phẳng, sắp theo vị trí — FE tự dựng cây từ parentId. */
  async list(user: AuthUser): Promise<FolderResponse[]> {
    const rows: (ArtworkFolder & { artwork_count: string })[] =
      await this.folders
        .createQueryBuilder('f')
        .addSelect(
          `(SELECT COUNT(*) FROM artworks a WHERE a.folder_id = f.id
          AND a.deleted_at IS NULL AND a.status <> 'archived')`,
          'artwork_count',
        )
        .where('f.seller_id = :sid', { sid: user.id })
        .orderBy('f.position', 'ASC')
        .addOrderBy('f.created_at', 'ASC')
        .getRawAndEntities()
        .then(({ raw, entities }) =>
          entities.map((e, i) =>
            Object.assign(e, {
              artwork_count: (raw[i] as { artwork_count: string })
                .artwork_count,
            }),
          ),
        );
    return rows.map((f) => this.toResponse(f, Number(f.artwork_count)));
  }

  async create(user: AuthUser, dto: CreateFolderDto): Promise<FolderResponse> {
    const total = await this.folders.count({ where: { sellerId: user.id } });
    if (total >= MAX_FOLDERS)
      throw new BadRequestException(`Tối đa ${MAX_FOLDERS} thư mục`);
    const parentId = dto.parentId ?? null;
    if (parentId) await this.assertDepth(user.id, parentId, 1);
    await this.assertUniqueName(user.id, parentId, dto.name);
    const last = await this.folders.maximum('position', {
      sellerId: user.id,
      parentId: parentId ?? IsNull(),
    });
    const saved = await this.folders.save(
      this.folders.create({
        sellerId: user.id,
        parentId,
        name: dto.name,
        position: (last ?? -1) + 1,
      }),
    );
    return this.toResponse(saved, 0);
  }

  async update(
    user: AuthUser,
    id: string,
    dto: UpdateFolderDto,
  ): Promise<FolderResponse> {
    const f = await this.owned(user, id);
    if (dto.parentId !== undefined && dto.parentId !== f.parentId) {
      if (dto.parentId) {
        await this.assertNoCycle(user.id, id, dto.parentId);
        await this.assertDepth(
          user.id,
          dto.parentId,
          // Chiều cao cây con đã tính cả chính thư mục này
          await this.subtreeHeight(user.id, id),
        );
      }
      f.parentId = dto.parentId;
    }
    if (dto.name !== undefined && dto.name !== f.name) {
      await this.assertUniqueName(user.id, f.parentId, dto.name, id);
      f.name = dto.name;
    } else if (dto.parentId !== undefined) {
      await this.assertUniqueName(user.id, f.parentId, f.name, id);
    }
    if (dto.position !== undefined) f.position = dto.position;
    if (dto.isHidden !== undefined) f.isHidden = dto.isHidden;
    const saved = await this.folders.save(f);
    const [r] = (await this.list(user)).filter((x) => x.id === saved.id);
    return r;
  }

  /**
   * Xóa thư mục: tác phẩm bên trong chuyển ra "chưa xếp thư mục" (FK SET NULL),
   * thư mục con được đưa lên thay chỗ thư mục bị xóa.
   */
  async remove(user: AuthUser, id: string): Promise<void> {
    await this.dataSource.transaction(async (m) => {
      const f = await m.findOne(ArtworkFolder, {
        where: { id, sellerId: user.id },
      });
      if (!f) throw new NotFoundException('Không tìm thấy thư mục');
      await m.update(ArtworkFolder, { parentId: id }, { parentId: f.parentId });
      await m.delete(ArtworkFolder, { id });
    });
  }

  private async owned(user: AuthUser, id: string): Promise<ArtworkFolder> {
    const f = await this.folders.findOne({ where: { id, sellerId: user.id } });
    if (!f) throw new NotFoundException('Không tìm thấy thư mục');
    return f;
  }

  private async assertUniqueName(
    sellerId: string,
    parentId: string | null,
    name: string,
    exceptId?: string,
  ) {
    const qb = this.folders
      .createQueryBuilder('f')
      .where('f.seller_id = :sid AND lower(f.name) = lower(:name)', {
        sid: sellerId,
        name,
      });
    if (parentId) qb.andWhere('f.parent_id = :pid', { pid: parentId });
    else qb.andWhere('f.parent_id IS NULL');
    if (exceptId) qb.andWhere('f.id <> :id', { id: exceptId });
    if (await qb.getExists())
      throw new ConflictException('Đã có thư mục cùng tên ở cấp này');
  }

  /** Chuỗi tổ tiên của một thư mục (kể cả chính nó), từ dưới lên. */
  private async ancestors(sellerId: string, id: string): Promise<string[]> {
    const rows: { id: string }[] = await this.dataSource.query(
      `WITH RECURSIVE up AS (
         SELECT id, parent_id, 1 AS d FROM artwork_folders WHERE id = $1 AND seller_id = $2
         UNION ALL
         SELECT f.id, f.parent_id, up.d + 1 FROM artwork_folders f JOIN up ON f.id = up.parent_id
         WHERE up.d < 50
       ) SELECT id FROM up ORDER BY d`,
      [id, sellerId],
    );
    if (rows.length === 0)
      throw new BadRequestException('Thư mục cha không tồn tại');
    return rows.map((r) => r.id);
  }

  private async assertNoCycle(
    sellerId: string,
    id: string,
    newParentId: string,
  ) {
    if ((await this.ancestors(sellerId, newParentId)).includes(id)) {
      throw new BadRequestException(
        'Không thể chuyển thư mục vào bên trong chính nó',
      );
    }
  }

  /** Số tầng của cây con tính từ id (1 = không có con). */
  private async subtreeHeight(sellerId: string, id: string): Promise<number> {
    const [row]: { h: number }[] = await this.dataSource.query(
      `WITH RECURSIVE down AS (
         SELECT id, 1 AS d FROM artwork_folders WHERE id = $1 AND seller_id = $2
         UNION ALL
         SELECT f.id, down.d + 1 FROM artwork_folders f JOIN down ON f.parent_id = down.id
         WHERE down.d < 50
       ) SELECT MAX(d)::int AS h FROM down`,
      [id, sellerId],
    );
    return row?.h ?? 1;
  }

  private async assertDepth(
    sellerId: string,
    parentId: string,
    addedLevels: number,
  ) {
    const depth = (await this.ancestors(sellerId, parentId)).length;
    if (depth + addedLevels > MAX_FOLDER_DEPTH) {
      throw new BadRequestException(
        `Thư mục chỉ lồng tối đa ${MAX_FOLDER_DEPTH} cấp`,
      );
    }
  }

  private toResponse(f: ArtworkFolder, artworkCount: number): FolderResponse {
    return {
      id: f.id,
      name: f.name,
      parentId: f.parentId,
      position: f.position,
      isHidden: f.isHidden,
      artworkCount,
    };
  }
}
