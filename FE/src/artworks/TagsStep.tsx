import { useState } from 'react';
import { ApiError } from '../lib/api';
import { artworksApi } from './artworks-api';
import { Section } from './fields';
import {
  LISTING_OPTIONS,
  TAG_GROUPS,
  type ArtworkForm,
  type FormErrors,
  type ImageItem,
} from './form';
import type { Tag } from './types';
import { formatVnd } from './units';

interface Props {
  form: ArtworkForm;
  errors: FormErrors;
  tags: Tag[];
  images: ImageItem[];
  onTagsChange: (ids: string[]) => void;
  onTagCreated: (tag: Tag) => void;
}

/** Bước 3: tag (chất liệu, phong cách, chủ đề) + xem trước thẻ tác phẩm. */
export function TagsStep({ form, errors, tags, images, onTagsChange, onTagCreated }: Props) {
  const [newTag, setNewTag] = useState('');
  const [creating, setCreating] = useState(false);
  const [tagError, setTagError] = useState<string | null>(null);

  const toggle = (id: string) =>
    onTagsChange(
      form.tagIds.includes(id) ? form.tagIds.filter((x) => x !== id) : [...form.tagIds, id],
    );

  async function addTag() {
    const name = newTag.trim().replace(/\s+/g, ' ');
    if (name.length < 2) {
      setTagError('Tên tag cần ít nhất 2 ký tự');
      return;
    }
    setCreating(true);
    setTagError(null);
    try {
      const tag = await artworksApi.createTag(name, 'other');
      onTagCreated(tag);
      if (!form.tagIds.includes(tag.id)) onTagsChange([...form.tagIds, tag.id]);
      setNewTag('');
    } catch (e) {
      setTagError(e instanceof ApiError ? e.message : 'Không tạo được tag');
    } finally {
      setCreating(false);
    }
  }

  const cover = images[0];
  const listing = LISTING_OPTIONS.find((o) => o.id === form.listingType)!;
  const priceLabel =
    form.listingType === 'for_sale' && form.price
      ? `${form.price} ₫`
      : form.listingType === 'for_sale'
        ? 'Chưa có giá'
        : listing.label;

  return (
    <div className="wizard__split">
      <div className="wizard__stack">
        <Section
          title="Tag tác phẩm"
          desc="Tag giúp người xem tìm thấy tác phẩm của bạn khi khám phá và tìm kiếm."
        >
          {errors.tagIds && (
            <p className="field__error" role="alert">
              {errors.tagIds}
            </p>
          )}
          {TAG_GROUPS.map((g) => {
            const list = tags.filter((t) => t.category === g.id);
            if (g.id !== 'other' && list.length === 0) return null;
            return (
              <fieldset key={g.id} className="tag-group">
                <legend>
                  {g.label}
                  {g.id === 'medium' && <span className="req"> *</span>}
                </legend>
                {list.length > 0 && (
                  <div className="chips">
                    {list.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        className="chip"
                        aria-pressed={form.tagIds.includes(t.id)}
                        onClick={() => toggle(t.id)}
                      >
                        {t.name}
                      </button>
                    ))}
                  </div>
                )}
                {g.hint && !(g.id === 'medium' && errors.tagIds) && (
                  <p className="field__hint">{g.hint}</p>
                )}
                {g.id === 'other' && (
                  <div className="tag-add">
                    <input
                      className="input"
                      aria-label="Tên tag mới"
                      placeholder="Thêm tag riêng, VD: Phố cổ Hà Nội"
                      maxLength={64}
                      value={newTag}
                      onChange={(e) => setNewTag(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          void addTag();
                        }
                      }}
                    />
                    <button
                      type="button"
                      className="btn btn--outline"
                      disabled={creating || !newTag.trim()}
                      onClick={() => void addTag()}
                    >
                      {creating ? 'Đang thêm…' : 'Thêm'}
                    </button>
                  </div>
                )}
                {g.id === 'other' && tagError && <p className="field__error">{tagError}</p>}
              </fieldset>
            );
          })}
          <p className="field__hint">Đã chọn {form.tagIds.length}/20 tag.</p>
        </Section>
      </div>

      <aside className="preview" aria-label="Xem trước">
        <p className="preview__label">Xem trước</p>
        <article className="art-card">
          <div className="art-card__img">
            {cover ? (
              <img
                src={cover.previewUrl}
                alt=""
                onLoad={(e) => e.currentTarget.setAttribute('data-loaded', '')}
              />
            ) : (
              <span>Chưa có ảnh</span>
            )}
          </div>
          <div className="art-card__body">
            <h3>{form.title.trim() || 'Tên tác phẩm'}</h3>
            <p className="art-card__meta">
              {[form.year, form.medium].filter(Boolean).join(' · ') || 'Năm · Chất liệu'}
            </p>
            <p className="art-card__price">{priceLabel}</p>
          </div>
        </article>
        <p className="field__hint">
          {images.length} ảnh · {formatVnd(form.tagIds.length)} tag
        </p>
      </aside>
    </div>
  );
}
