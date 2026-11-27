import { useEffect, useRef, useState } from 'react';
import { uploadToCloudinary } from '../artworks/artworks-api';
import { formatBytes } from '../artworks/units';
import { useAuth } from '../auth/auth-context';
import { Avatar } from '../components/Avatar';
import { ApiError } from '../lib/api';
import { AVATAR_FORMATS, AVATAR_MAX_BYTES, profileApi } from './profile-api';

/**
 * Ảnh đại diện trên trang Hồ sơ: chọn ảnh → xem trước ngay → upload thẳng lên Cloudinary
 * (backend chỉ ký) → gắn vào tài khoản. Ảnh cũ do backend xóa.
 */
export function AvatarEditor() {
  const { user, updateUser } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: 'error' | 'success'; text: string } | null>(null);

  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );

  if (!user) return null;

  async function onFile(file: File) {
    setMessage(null);
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    if (!AVATAR_FORMATS.includes(ext)) {
      return setMessage({ kind: 'error', text: 'Chỉ nhận ảnh JPG, PNG, WEBP, GIF hoặc HEIC' });
    }
    if (file.size > AVATAR_MAX_BYTES) {
      return setMessage({
        kind: 'error',
        text: `Ảnh lớn hơn ${formatBytes(AVATAR_MAX_BYTES)} — hãy chọn ảnh nhỏ hơn`,
      });
    }
    setPreview(URL.createObjectURL(file));
    setBusy(true);
    setProgress(0);
    try {
      const ticket = await profileApi.avatarTicket();
      const r = await uploadToCloudinary(file, ticket, ticket.items[0], setProgress);
      const updated = await profileApi.setAvatar({
        publicId: r.publicId,
        version: r.version,
        signature: r.signature,
      });
      updateUser(updated);
      setMessage({ kind: 'success', text: 'Đã cập nhật ảnh đại diện' });
    } catch (e) {
      const text =
        e instanceof ApiError && e.status === 503
          ? 'Máy chủ chưa cấu hình Cloudinary nên chưa tải ảnh được'
          : e instanceof Error
            ? e.message
            : 'Không tải được ảnh';
      setMessage({ kind: 'error', text });
    } finally {
      setPreview(null);
      setProgress(null);
      setBusy(false);
    }
  }

  async function onRemove() {
    if (!window.confirm('Gỡ ảnh đại diện?')) return;
    setBusy(true);
    setMessage(null);
    try {
      updateUser(await profileApi.removeAvatar());
      setMessage({ kind: 'success', text: 'Đã gỡ ảnh đại diện' });
    } catch (e) {
      setMessage({ kind: 'error', text: e instanceof ApiError ? e.message : 'Không gỡ được ảnh' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="avatar-editor">
      <button
        type="button"
        className="avatar-editor__pick"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        aria-label="Đổi ảnh đại diện"
      >
        {preview ? (
          <span className="avatar" style={{ width: 96, height: 96 }} aria-hidden="true">
            <img src={preview} alt="" />
          </span>
        ) : (
          <Avatar name={user.fullName} url={user.avatarUrl} size={96} />
        )}
        <span className="avatar-editor__overlay" aria-hidden="true">
          {progress !== null ? `${progress}%` : 'Đổi ảnh'}
        </span>
      </button>
      <input
        ref={inputRef}
        type="file"
        hidden
        accept={AVATAR_FORMATS.map((f) => `.${f}`).join(',') + ',image/*'}
        data-testid="avatar-input"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) void onFile(f);
        }}
      />
      <div className="avatar-editor__actions">
        <button
          type="button"
          className="btn btn--outline btn--sm"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          {busy && progress !== null ? 'Đang tải…' : user.avatarUrl ? 'Đổi ảnh' : 'Tải ảnh lên'}
        </button>
        {user.avatarUrl && (
          <button
            type="button"
            className="btn-link"
            disabled={busy}
            onClick={() => void onRemove()}
          >
            Gỡ ảnh
          </button>
        )}
      </div>
      <p className="field__hint">JPG, PNG, WEBP, HEIC · tối đa {formatBytes(AVATAR_MAX_BYTES)}</p>
      {message && (
        <p className={message.kind === 'error' ? 'field__error' : 'field__success'} role="status">
          {message.text}
        </p>
      )}
    </div>
  );
}
