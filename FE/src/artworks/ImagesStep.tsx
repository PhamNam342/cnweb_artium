import { useRef, useState } from 'react';
import type { DragEvent } from 'react';
import { ApiError } from '../lib/api';
import { artworksApi, uploadToCloudinary } from './artworks-api';
import { IMAGE_FORMATS, LIMITS, type ImageItem } from './form';
import { formatBytes } from './units';

interface Props {
  images: ImageItem[];
  onChange: (update: (prev: ImageItem[]) => ImageItem[]) => void;
  error?: string;
}

const extOf = (name: string) => name.split('.').pop()?.toLowerCase() ?? '';

/**
 * Bước 1: tải ảnh. File được upload thẳng lên Cloudinary ngay khi chọn (backend chỉ ký tham số);
 * thứ tự trong lưới = thứ tự hiển thị, ảnh đầu tiên là ảnh bìa.
 */
export function ImagesStep({ images, onChange, error }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const dragKey = useRef<string | null>(null);

  const patch = (key: string, p: Partial<ImageItem>) =>
    onChange((prev) => prev.map((i) => (i.key === key ? { ...i, ...p } : i)));

  async function addFiles(fileList: FileList | File[]) {
    setNotice(null);
    const files = Array.from(fileList);
    const room = LIMITS.images - images.length;
    const rejected: string[] = [];
    const accepted = files.filter((f) => {
      if (!IMAGE_FORMATS.includes(extOf(f.name))) {
        rejected.push(`${f.name}: định dạng không hỗ trợ`);
        return false;
      }
      if (f.size > LIMITS.imageBytes) {
        rejected.push(`${f.name}: lớn hơn ${formatBytes(LIMITS.imageBytes)}`);
        return false;
      }
      return true;
    });
    if (accepted.length > room) {
      rejected.push(`Chỉ thêm được tối đa ${LIMITS.images} ảnh`);
      accepted.splice(room);
    }
    if (rejected.length) setNotice(rejected.join(' · '));
    if (accepted.length === 0) return;

    const items: ImageItem[] = accepted.map((f) => ({
      key: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      previewUrl: URL.createObjectURL(f),
      fileName: f.name,
      status: 'uploading',
      progress: 0,
    }));
    onChange((prev) => [...prev, ...items]);

    let ticket;
    try {
      ticket = await artworksApi.uploadTicket(accepted.length);
    } catch (e) {
      const msg =
        e instanceof ApiError && e.status === 503
          ? 'Máy chủ chưa cấu hình Cloudinary nên chưa tải ảnh được'
          : e instanceof Error
            ? e.message
            : 'Không xin được quyền tải ảnh';
      items.forEach((it) => patch(it.key, { status: 'error', error: msg }));
      return;
    }

    await Promise.all(
      accepted.map(async (file, i) => {
        const it = items[i];
        try {
          const r = await uploadToCloudinary(file, ticket, ticket.items[i], (p) =>
            patch(it.key, { progress: p }),
          );
          patch(it.key, { ...r, status: 'uploaded', progress: 100, error: undefined });
        } catch (e) {
          patch(it.key, {
            status: 'error',
            error: e instanceof Error ? e.message : 'Tải ảnh thất bại',
          });
        }
      }),
    );
  }

  function remove(key: string) {
    onChange((prev) => {
      const it = prev.find((i) => i.key === key);
      if (it?.previewUrl.startsWith('blob:')) URL.revokeObjectURL(it.previewUrl);
      return prev.filter((i) => i.key !== key);
    });
  }

  function move(key: string, to: number) {
    onChange((prev) => {
      const from = prev.findIndex((i) => i.key === key);
      if (from < 0 || to < 0 || to >= prev.length || from === to) return prev;
      const next = [...prev];
      const [it] = next.splice(from, 1);
      next.splice(to, 0, it);
      return next;
    });
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (dragKey.current) return; // đang kéo để sắp xếp, không phải thả file
    if (e.dataTransfer.files.length) void addFiles(e.dataTransfer.files);
  }

  const full = images.length >= LIMITS.images;

  return (
    <div className="wizard__stack">
      <div
        className="dropzone"
        data-over={dragOver || undefined}
        data-compact={images.length > 0 || undefined}
        onDragOver={(e) => {
          if (dragKey.current) return;
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
      >
        <div className="dropzone__art" aria-hidden="true">
          <span />
          <span>+</span>
        </div>
        <h2 className="dropzone__title">
          {images.length ? 'Thêm ảnh khác' : 'Tải ảnh tác phẩm của bạn'}
        </h2>
        <p className="dropzone__hint">
          Kéo thả ảnh vào đây hoặc chọn từ máy. Hỗ trợ JPG, PNG, GIF, WEBP, HEIC — tối đa{' '}
          {LIMITS.images} ảnh, mỗi ảnh ≤ {formatBytes(LIMITS.imageBytes)}.
        </p>
        <p className="dropzone__hint">
          Khi tải ảnh lên, bạn đồng ý với <a href="#guidelines">Tiêu chuẩn cộng đồng</a> của Artium.
        </p>
        <button
          type="button"
          className="btn btn--outline"
          disabled={full}
          onClick={() => inputRef.current?.click()}
        >
          {full ? `Đã đủ ${LIMITS.images} ảnh` : 'Chọn ảnh'}
        </button>
        <input
          ref={inputRef}
          type="file"
          multiple
          hidden
          accept={IMAGE_FORMATS.map((f) => `.${f}`).join(',') + ',image/*'}
          data-testid="image-input"
          onChange={(e) => {
            if (e.target.files) void addFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </div>

      {notice && (
        <p className="alert alert--error" role="alert">
          {notice}
        </p>
      )}
      {error && (
        <p className="field__error" role="alert">
          {error}
        </p>
      )}

      {images.length > 0 && (
        <>
          <p className="field__hint">
            Kéo để sắp xếp. Ảnh đầu tiên là <strong>ảnh bìa</strong>, hiển thị ở mọi danh sách.
          </p>
          <ol className="image-grid" aria-label="Ảnh tác phẩm">
            {images.map((img, idx) => (
              <li
                key={img.key}
                className="image-tile"
                data-status={img.status}
                draggable
                onDragStart={(e) => {
                  dragKey.current = img.key;
                  e.dataTransfer.effectAllowed = 'move';
                }}
                onDragEnd={() => (dragKey.current = null)}
                onDragOver={(e) => {
                  if (dragKey.current) e.preventDefault();
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (dragKey.current) move(dragKey.current, idx);
                  dragKey.current = null;
                }}
              >
                <img
                  src={img.previewUrl}
                  alt={img.fileName ?? `Ảnh ${idx + 1}`}
                  onLoad={(e) => e.currentTarget.setAttribute('data-loaded', '')}
                />
                {idx === 0 && <span className="image-tile__cover">Ảnh bìa</span>}
                {img.status === 'uploading' && (
                  <div className="image-tile__progress" aria-label={`Đang tải ${img.progress}%`}>
                    <span style={{ width: `${img.progress}%` }} />
                  </div>
                )}
                {img.status === 'error' && (
                  <p className="image-tile__error" role="alert">
                    {img.error}
                  </p>
                )}
                <div className="image-tile__actions">
                  {idx > 0 && (
                    <button
                      type="button"
                      onClick={() => move(img.key, 0)}
                      title="Đặt làm ảnh bìa"
                      aria-label={`Đặt ảnh ${idx + 1} làm ảnh bìa`}
                    >
                      ★
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => move(img.key, idx - 1)}
                    disabled={idx === 0}
                    aria-label={`Đưa ảnh ${idx + 1} lên trước`}
                  >
                    ←
                  </button>
                  <button
                    type="button"
                    onClick={() => move(img.key, idx + 1)}
                    disabled={idx === images.length - 1}
                    aria-label={`Đưa ảnh ${idx + 1} ra sau`}
                  >
                    →
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(img.key)}
                    aria-label={`Xóa ảnh ${idx + 1}`}
                  >
                    ✕
                  </button>
                </div>
              </li>
            ))}
          </ol>
        </>
      )}
    </div>
  );
}
