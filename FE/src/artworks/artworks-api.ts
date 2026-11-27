import { api } from '../lib/api';
import type {
  Artwork,
  ArtworkInput,
  ArtworkStatus,
  Folder,
  ImageInput,
  InventoryPage,
  Page,
  PublicArtwork,
  Tag,
  TagCategory,
  UploadTicket,
} from './types';

export interface InventoryQuery {
  q?: string;
  status?: ArtworkStatus | 'all';
  folderId?: string;
  sort?: string;
  page?: number;
  pageSize?: number;
}

export interface PublicQuery {
  q?: string;
  tag?: string;
  listingType?: string;
  sellerSlug?: string;
  sort?: string;
  page?: number;
  pageSize?: number;
}

/** Tác phẩm công khai (đã đăng / hết hàng) — trang Khám phá, chi tiết tác phẩm. */
export const publicApi = {
  list: (q: PublicQuery, signal?: AbortSignal) =>
    api<Page<PublicArtwork>>('/artworks', {
      signal,
      query: {
        q: q.q,
        tag: q.tag,
        listingType: q.listingType,
        sellerSlug: q.sellerSlug,
        sort: q.sort,
        page: q.page ? String(q.page) : undefined,
        pageSize: q.pageSize ? String(q.pageSize) : undefined,
      },
    }),
  get: (id: string) => api<PublicArtwork>(`/artworks/${id}`),
  systemTags: () => api<Tag[]>('/tags', { query: { scope: 'system' } }),
};

export const artworksApi = {
  listMine: (q: InventoryQuery, signal?: AbortSignal) =>
    api<InventoryPage>('/artworks/mine', {
      signal,
      query: {
        q: q.q,
        status: q.status,
        folderId: q.folderId,
        sort: q.sort,
        page: q.page ? String(q.page) : undefined,
        pageSize: q.pageSize ? String(q.pageSize) : undefined,
      },
    }),
  getMine: (id: string) => api<Artwork>(`/artworks/mine/${id}`),
  create: (body: ArtworkInput & { images: ImageInput[] }) => api<Artwork>('/artworks', { body }),
  update: (id: string, body: Partial<ArtworkInput>) =>
    api<Artwork>(`/artworks/${id}`, { method: 'PATCH', body }),
  replaceImages: (id: string, images: ImageInput[]) =>
    api<Artwork>(`/artworks/${id}/images`, { method: 'PUT', body: { images } }),
  publish: (id: string) => api<Artwork>(`/artworks/${id}/publish`, { method: 'POST' }),
  unpublish: (id: string) => api<Artwork>(`/artworks/${id}/unpublish`, { method: 'POST' }),
  archive: (id: string) => api<Artwork>(`/artworks/${id}/archive`, { method: 'POST' }),
  restore: (id: string) => api<Artwork>(`/artworks/${id}/restore`, { method: 'POST' }),
  remove: (id: string) => api<void>(`/artworks/${id}`, { method: 'DELETE' }),
  move: (ids: string[], folderId: string | null) =>
    api<{ updated: number }>('/artworks/bulk', { body: { ids, action: 'move', folderId } }),

  folders: () => api<Folder[]>('/folders'),
  createFolder: (name: string, parentId: string | null = null) =>
    api<Folder>('/folders', { body: { name, parentId } }),
  updateFolder: (id: string, body: { name?: string; parentId?: string | null }) =>
    api<Folder>(`/folders/${id}`, { method: 'PATCH', body }),
  deleteFolder: (id: string) => api<void>(`/folders/${id}`, { method: 'DELETE' }),

  tags: () => api<Tag[]>('/tags'),
  createTag: (name: string, category: TagCategory) =>
    api<Tag>('/tags', { body: { name, category } }),

  uploadTicket: (count: number) =>
    api<UploadTicket>('/uploads/artwork-images', { body: { count } }),
};

/** Kết quả Cloudinary trả về sau khi upload (đã đổi sang camelCase cho backend). */
export interface UploadedImage extends Required<ImageInput> {
  url: string;
}

/**
 * Upload một file thẳng lên Cloudinary bằng tham số đã ký. Dùng XHR để có tiến độ (%).
 */
export function uploadToCloudinary(
  file: File,
  ticket: UploadTicket,
  item: UploadTicket['items'][number],
  onProgress: (percent: number) => void,
  signal?: AbortSignal,
): Promise<UploadedImage> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append('file', file);
    form.append('api_key', ticket.apiKey);
    form.append('timestamp', String(item.timestamp));
    form.append('signature', item.signature);
    form.append('public_id', item.publicId);
    form.append('allowed_formats', ticket.allowedFormats);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', ticket.uploadUrl);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      try {
        const r = JSON.parse(xhr.responseText) as Record<string, unknown> & {
          error?: { message?: string };
        };
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve({
            publicId: r.public_id as string,
            version: r.version as number,
            signature: r.signature as string,
            format: r.format as string,
            width: r.width as number,
            height: r.height as number,
            bytes: r.bytes as number,
            url: r.secure_url as string,
          });
        } else {
          reject(new Error(r.error?.message ?? `Upload lỗi (${xhr.status})`));
        }
      } catch {
        reject(new Error(`Upload lỗi (${xhr.status})`));
      }
    };
    xhr.onerror = () => reject(new Error('Mất kết nối khi tải ảnh lên'));
    xhr.onabort = () => reject(new DOMException('Đã hủy', 'AbortError'));
    signal?.addEventListener('abort', () => xhr.abort());
    xhr.send(form);
  });
}
