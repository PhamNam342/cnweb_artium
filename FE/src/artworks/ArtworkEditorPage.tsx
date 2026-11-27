import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ApiError } from '../lib/api';
import { artworksApi } from './artworks-api';
import { DetailsStep } from './DetailsStep';
import {
  emptyForm,
  formFromArtwork,
  imagesFromArtwork,
  toArtworkInput,
  validateDetails,
  validateImages,
  validateTags,
  STATUS_LABEL,
  type ArtworkForm,
  type FormErrors,
  type ImageItem,
} from './form';
import { ImagesStep } from './ImagesStep';
import { TagsStep } from './TagsStep';
import type { Artwork, Folder, ImageInput, Tag } from './types';

const STEPS = ['Tải ảnh', 'Thông tin tác phẩm', 'Tag'];

const toImageInput = (i: ImageItem): ImageInput =>
  i.status === 'saved'
    ? { publicId: i.publicId! }
    : {
        publicId: i.publicId!,
        version: i.version,
        signature: i.signature,
        format: i.format,
        width: i.width,
        height: i.height,
        bytes: i.bytes,
      };

const isPublic = (a: Artwork | null) => a?.status === 'published' || a?.status === 'sold_out';

/**
 * Đăng / sửa tác phẩm — wizard 3 bước theo Figma "Upload Artwork".
 *   /studio/artworks/new        tạo mới
 *   /studio/artworks/:id/edit   sửa
 */
export function ArtworkEditorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [artwork, setArtwork] = useState<Artwork | null>(null);
  const [form, setForm] = useState<ArtworkForm>(emptyForm);
  const [images, setImages] = useState<ImageItem[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState<null | 'draft' | 'publish'>(null);
  const [serverError, setServerError] = useState<{ message: string; details: string[] } | null>(
    null,
  );
  const [dirty, setDirty] = useState(false);
  const topRef = useRef<HTMLDivElement>(null);
  const savedImageKeys = useRef('');

  useEffect(() => {
    let alive = true;
    Promise.all([
      artworksApi.tags(),
      artworksApi.folders(),
      id ? artworksApi.getMine(id) : Promise.resolve(null),
    ])
      .then(([t, f, a]) => {
        if (!alive) return;
        setTags(t);
        setFolders(f);
        if (a) {
          setArtwork(a);
          setForm(formFromArtwork(a));
          const imgs = imagesFromArtwork(a);
          setImages(imgs);
          savedImageKeys.current = imgs.map((i) => i.publicId).join('|');
          setStep(1);
        }
      })
      .catch((e: unknown) => {
        if (alive) setLoadError(e instanceof ApiError ? e.message : 'Không tải được dữ liệu');
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [id]);

  // Cảnh báo khi rời trang mà chưa lưu
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  const set = useCallback(<K extends keyof ArtworkForm>(key: K, value: ArtworkForm[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => (e[key] ? { ...e, [key]: undefined } : e));
    setDirty(true);
  }, []);

  const updateImages = useCallback((update: (prev: ImageItem[]) => ImageItem[]) => {
    setImages(update);
    setErrors((e) => (e.images ? { ...e, images: undefined } : e));
    setDirty(true);
  }, []);

  function validate(s: number): FormErrors {
    if (s === 0) return validateImages(images);
    if (s === 1) return validateDetails(form);
    return validateTags(form, tags);
  }

  function showErrors(s: number, e: FormErrors) {
    setErrors(e);
    setStep(s);
    requestAnimationFrame(() => {
      const el = document.querySelector<HTMLElement>('[aria-invalid="true"], .field__error');
      el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) el.focus();
    });
  }

  function goTo(target: number) {
    // Đi tới: phải qua kiểm tra các bước trước; lùi lại: luôn được
    for (let s = step; s < target; s++) {
      const e = validate(s);
      if (Object.keys(e).length) return showErrors(s, e);
    }
    setErrors({});
    setStep(target);
    topRef.current?.scrollIntoView({ behavior: 'smooth' });
  }

  async function save(publish: boolean) {
    setServerError(null);
    // Lưu nháp chỉ cần tên + ảnh đã tải xong; đăng thì cần đủ 3 bước
    const checks: [number, FormErrors][] = publish
      ? [0, 1, 2].map((s) => [s, validate(s)])
      : [
          [0, images.length ? validateImages(images) : {}],
          [1, validateDetails(form)],
        ];
    for (const [s, e] of checks) {
      if (Object.keys(e).length) return showErrors(s, e);
    }

    setSaving(publish ? 'publish' : 'draft');
    const input = toArtworkInput(form);
    const imageInputs = images.map(toImageInput);
    let saved: Artwork | null = artwork;
    try {
      if (!saved) {
        saved = await artworksApi.create({ ...input, images: imageInputs });
        setArtwork(saved);
        // Từ đây là sửa tác phẩm đã có (bấm lưu lần nữa sẽ không tạo bản trùng)
        window.history.replaceState(null, '', `/studio/artworks/${saved.id}/edit`);
      } else {
        saved = await artworksApi.update(saved.id, input);
        const keys = images.map((i) => i.publicId).join('|');
        if (keys !== savedImageKeys.current || images.some((i) => i.status === 'uploaded')) {
          saved = await artworksApi.replaceImages(saved.id, imageInputs);
        }
        setArtwork(saved);
      }
      // Ảnh vừa tải giờ đã thuộc tác phẩm
      const imgs = imagesFromArtwork(saved);
      setImages(imgs);
      savedImageKeys.current = imgs.map((i) => i.publicId).join('|');

      if (publish && !isPublic(saved)) saved = await artworksApi.publish(saved.id);
      setDirty(false);
      navigate('/studio/artworks', {
        state: {
          flash:
            publish || isPublic(saved)
              ? `Đã đăng “${saved.title}”`
              : `Đã lưu nháp “${saved.title}”`,
        },
      });
    } catch (e) {
      if (e instanceof ApiError) {
        setServerError({
          message: saved && publish ? `Đã lưu nháp nhưng chưa đăng được: ${e.message}` : e.message,
          details: e.details.length > 1 ? e.details : [],
        });
      } else {
        setServerError({ message: 'Không lưu được, vui lòng thử lại.', details: [] });
      }
      topRef.current?.scrollIntoView({ behavior: 'smooth' });
    } finally {
      setSaving(null);
    }
  }

  function cancel() {
    if (dirty && !window.confirm('Bỏ các thay đổi chưa lưu?')) return;
    navigate('/studio/artworks');
  }

  if (loading) {
    return (
      <div className="page-center" role="status">
        <span className="spinner" aria-hidden="true" />
        <span className="sr-only">Đang tải…</span>
      </div>
    );
  }
  if (loadError) {
    return (
      <div className="wizard">
        <p className="alert alert--error" role="alert">
          {loadError}
        </p>
        <Link to="/studio/artworks" className="btn btn--outline">
          Về kho tác phẩm
        </Link>
      </div>
    );
  }

  const live = isPublic(artwork);
  const uploading = images.some((i) => i.status === 'uploading');
  const held = artwork ? artwork.quantityTotal - artwork.quantityAvailable : 0;

  return (
    <div className="wizard" ref={topRef}>
      <header className="wizard__head">
        <div>
          <p className="wizard__eyebrow">{artwork ? 'Sửa tác phẩm' : 'Đăng tác phẩm'}</p>
          <h1 className="wizard__title">{artwork ? artwork.title : 'Tác phẩm mới'}</h1>
        </div>
        {artwork && (
          <span className="status-pill" data-status={artwork.status}>
            {STATUS_LABEL[artwork.status]}
          </span>
        )}
      </header>

      <ol className="stepper" aria-label="Các bước">
        {STEPS.map((label, i) => (
          <li key={label} data-state={i < step ? 'done' : i === step ? 'current' : 'todo'}>
            <button
              type="button"
              onClick={() => goTo(i)}
              aria-current={i === step ? 'step' : undefined}
            >
              <span className="stepper__bar" />
              <span className="stepper__label">{label}</span>
            </button>
          </li>
        ))}
      </ol>

      {serverError && (
        <div className="alert alert--error" role="alert">
          {serverError.message}
          {serverError.details.length > 0 && (
            <ul>
              {serverError.details.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {step === 0 && <ImagesStep images={images} onChange={updateImages} error={errors.images} />}
      {step === 1 && (
        <DetailsStep form={form} errors={errors} folders={folders} heldQuantity={held} set={set} />
      )}
      {step === 2 && (
        <TagsStep
          form={form}
          errors={errors}
          tags={tags}
          images={images}
          onTagsChange={(ids) => set('tagIds', ids)}
          onTagCreated={(t) =>
            setTags((prev) => (prev.some((x) => x.id === t.id) ? prev : [...prev, t]))
          }
        />
      )}

      <footer className="wizard__footer">
        <button
          type="button"
          className="btn btn--outline"
          onClick={step === 0 ? cancel : () => goTo(step - 1)}
        >
          {step === 0 ? 'Hủy' : 'Quay lại'}
        </button>
        <div className="wizard__footer-actions">
          {!live ? (
            <button
              type="button"
              className="btn btn--light"
              disabled={saving !== null || uploading}
              onClick={() => void save(false)}
            >
              {saving === 'draft' ? 'Đang lưu…' : 'Lưu nháp'}
            </button>
          ) : (
            step < STEPS.length - 1 && (
              <button
                type="button"
                className="btn btn--light"
                disabled={saving !== null || uploading}
                onClick={() => void save(true)}
              >
                {saving ? 'Đang lưu…' : 'Lưu thay đổi'}
              </button>
            )
          )}
          {step < STEPS.length - 1 ? (
            <button
              type="button"
              className="btn btn--primary"
              disabled={uploading}
              onClick={() => goTo(step + 1)}
            >
              {uploading ? 'Đang tải ảnh…' : 'Tiếp tục'}
            </button>
          ) : (
            <button
              type="button"
              className="btn btn--primary"
              disabled={saving !== null || uploading}
              onClick={() => void save(true)}
            >
              {saving === 'publish' ? 'Đang lưu…' : live ? 'Lưu thay đổi' : 'Đăng tác phẩm'}
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}
