import { DecimalInput, Field, RadioGroup, Section } from './fields';
import { flattenTree, indentLabel } from './folder-tree';
import {
  hasShipping,
  LIMITS,
  LISTING_OPTIONS,
  SHIPPING_OPTIONS,
  type ArtworkForm,
  type FormErrors,
} from './form';
import type { DimensionUnit, Folder, WeightUnit } from './types';
import { formatVnd, parseVnd } from './units';

interface Props {
  form: ArtworkForm;
  errors: FormErrors;
  folders: Folder[];
  /** Số bản đã bán / đang giữ chỗ — không được giảm số lượng dưới mức này */
  heldQuantity: number;
  set: <K extends keyof ArtworkForm>(key: K, value: ArtworkForm[K]) => void;
}

const DIM_UNITS: { id: DimensionUnit; label: string }[] = [
  { id: 'cm', label: 'cm' },
  { id: 'in', label: 'in' },
];
const WEIGHT_UNITS: { id: WeightUnit; label: string }[] = [
  { id: 'kg', label: 'kg' },
  { id: 'lb', label: 'lbs' },
];

/** Ô nhập tiền VND: tự thêm dấu chấm phân cách hàng nghìn khi gõ. */
function VndInput({
  value,
  onChange,
  ...rest
}: { value: string; onChange: (v: string) => void } & Record<string, unknown>) {
  return (
    <div className="prefix-input prefix-input--suffix">
      <input
        {...rest}
        inputMode="numeric"
        autoComplete="off"
        placeholder="0"
        value={value}
        onChange={(e) => onChange(formatVnd(parseVnd(e.target.value)))}
      />
      <span className="prefix-input__prefix">₫</span>
    </div>
  );
}

function DimensionInputs({
  unit,
  values,
  errors,
  onChange,
  labelPrefix = '',
}: {
  unit: string;
  values: [string, string, string];
  errors: [string?, string?, string?];
  onChange: (i: 0 | 1 | 2, v: string) => void;
  labelPrefix?: string;
}) {
  const names = ['Cao', 'Rộng', 'Sâu'];
  return (
    <div className="dims">
      {values.map((v, i) => (
        <div key={names[i]} className="dims__cell">
          {i > 0 && (
            <span className="dims__x" aria-hidden="true">
              ×
            </span>
          )}
          <Field label={`${names[i]} (${unit})`} error={errors[i]}>
            {(p) => (
              <DecimalInput
                {...p}
                aria-label={`${labelPrefix}${names[i]} (${unit})`}
                placeholder="0"
                value={v}
                onChange={(e) => onChange(i as 0 | 1 | 2, e.target.value)}
              />
            )}
          </Field>
        </div>
      ))}
    </div>
  );
}

/** Bước 2: thông tin tác phẩm + niêm yết + vận chuyển (theo Figma "Upload Edit Full"). */
export function DetailsStep({ form: f, errors: e, folders, heldQuantity, set }: Props) {
  const listing = LISTING_OPTIONS.find((o) => o.id === f.listingType)!;
  return (
    <div className="wizard__stack">
      <Section title="Thông tin tác phẩm">
        <Field
          label="Tên tác phẩm"
          required
          error={e.title}
          count={{ value: f.title, max: LIMITS.title }}
        >
          {(p) => (
            <input
              {...p}
              className="input"
              placeholder="VD: Hoàng hôn Hồ Tây"
              value={f.title}
              onChange={(ev) => set('title', ev.target.value)}
            />
          )}
        </Field>
        <Field
          label="Mô tả"
          error={e.description}
          count={{ value: f.description, max: LIMITS.description }}
        >
          {(p) => (
            <textarea
              {...p}
              className="input"
              placeholder="Cảm hứng, kỹ thuật, câu chuyện phía sau tác phẩm…"
              value={f.description}
              onChange={(ev) => set('description', ev.target.value)}
            />
          )}
        </Field>
        <div className="grid-2">
          <Field label="Năm sáng tác" error={e.year}>
            {(p) => (
              <input
                {...p}
                className="input"
                inputMode="numeric"
                maxLength={4}
                placeholder={String(new Date().getFullYear())}
                value={f.year}
                onChange={(ev) => set('year', ev.target.value.replace(/\D/g, ''))}
              />
            )}
          </Field>
          <Field label="Ấn bản" error={e.edition} count={{ value: f.edition, max: LIMITS.edition }}>
            {(p) => (
              <input
                {...p}
                className="input"
                placeholder="VD: 12/100, Ấn bản giới hạn"
                value={f.edition}
                onChange={(ev) => set('edition', ev.target.value)}
              />
            )}
          </Field>
        </div>

        <div className="field">
          <div className="field__row">
            <span className="field__label">Kích thước</span>
            <RadioGroup
              name="dimensionUnit"
              label="Đơn vị kích thước"
              value={f.dimensionUnit}
              options={DIM_UNITS}
              onChange={(v) => set('dimensionUnit', v)}
            />
          </div>
          <DimensionInputs
            unit={f.dimensionUnit}
            values={[f.height, f.width, f.depth]}
            errors={[e.height, e.width, e.depth]}
            onChange={(i, v) => set((['height', 'width', 'depth'] as const)[i], v)}
          />
        </div>

        <div className="field">
          <div className="field__row">
            <span className="field__label">Khối lượng</span>
            <RadioGroup
              name="weightUnit"
              label="Đơn vị khối lượng"
              value={f.weightUnit}
              options={WEIGHT_UNITS}
              onChange={(v) => set('weightUnit', v)}
            />
          </div>
          <DecimalInput
            aria-label={`Khối lượng (${f.weightUnit === 'lb' ? 'lbs' : 'kg'})`}
            aria-invalid={e.weight ? true : undefined}
            placeholder={f.weightUnit === 'lb' ? '0 lbs' : '0 kg'}
            value={f.weight}
            onChange={(ev) => set('weight', ev.target.value)}
          />
          {e.weight && <span className="field__error">{e.weight}</span>}
        </div>

        <label className="checkbox checkbox--block">
          <input
            type="checkbox"
            checked={f.isFramed}
            onChange={(ev) => set('isFramed', ev.target.checked)}
          />
          <span>
            <strong>Tác phẩm có khung trang trí</strong>
            <small>Đánh dấu nếu tác phẩm được bán kèm khung.</small>
          </span>
        </label>

        <Field label="Chất liệu" error={e.medium} count={{ value: f.medium, max: LIMITS.medium }}>
          {(p) => (
            <input
              {...p}
              className="input"
              placeholder="VD: Sơn dầu trên toan"
              value={f.medium}
              onChange={(ev) => set('medium', ev.target.value)}
            />
          )}
        </Field>

        {folders.length > 0 && (
          <Field label="Thư mục" hint="Sắp xếp tác phẩm trong kho của bạn">
            {(p) => (
              <select
                {...p}
                className="input"
                value={f.folderId}
                onChange={(ev) => set('folderId', ev.target.value)}
              >
                <option value="">Chưa xếp thư mục</option>
                {flattenTree(folders).map(({ folder: fo, depth }) => (
                  <option key={fo.id} value={fo.id}>
                    {indentLabel(fo.name, depth)}
                  </option>
                ))}
              </select>
            )}
          </Field>
        )}
      </Section>

      <Section
        title="Hình thức niêm yết"
        desc="Chọn để bán, cho phép hỏi giá, đánh dấu đã bán hoặc chỉ trưng bày."
      >
        <div className="listing-grid" role="radiogroup" aria-label="Hình thức niêm yết">
          {LISTING_OPTIONS.map((o) => (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={f.listingType === o.id}
              className="listing-option"
              onClick={() => set('listingType', o.id)}
            >
              {o.label}
            </button>
          ))}
        </div>
        <p className="field__hint">{listing.hint}</p>

        {f.listingType === 'for_sale' && (
          <>
            <div className="grid-2">
              <Field label="Giá bán" required error={e.price} hint="Giá đã gồm thuế, tính bằng VND">
                {(p) => <VndInput {...p} value={f.price} onChange={(v) => set('price', v)} />}
              </Field>
              <Field
                label="Số lượng"
                required
                error={e.quantity}
                hint={
                  heldQuantity > 0
                    ? `Đã bán / giữ chỗ ${heldQuantity} — tối thiểu ${heldQuantity}`
                    : 'Bản gốc thường là 1; tranh in có thể nhiều bản'
                }
              >
                {(p) => (
                  <input
                    {...p}
                    className="input"
                    inputMode="numeric"
                    value={f.quantity}
                    onChange={(ev) => set('quantity', ev.target.value.replace(/\D/g, ''))}
                  />
                )}
              </Field>
            </div>
            <label className="checkbox checkbox--block">
              <input
                type="checkbox"
                checked={f.allowOffers}
                onChange={(ev) => set('allowOffers', ev.target.checked)}
              />
              <span>
                <strong>Cho phép trả giá</strong>
                <small>
                  Người mua có thể đề xuất giá — bạn chấp nhận, trả giá lại hoặc từ chối.
                </small>
              </span>
            </label>
          </>
        )}

        {f.listingType === 'inquire' && (
          <Field
            label="Giá tham khảo"
            error={e.price}
            hint="Không bắt buộc — chỉ bạn thấy, để ghi nhớ khi trao đổi"
          >
            {(p) => <VndInput {...p} value={f.price} onChange={(v) => set('price', v)} />}
          </Field>
        )}

        {f.listingType === 'sold' && (
          <>
            <Field
              label="Nhà sưu tầm"
              error={e.collectorName}
              hint="Tên người đã mua tác phẩm — chỉ bạn thấy"
            >
              {(p) => (
                <input
                  {...p}
                  className="input"
                  placeholder="Tên nhà sưu tầm"
                  value={f.collectorName}
                  onChange={(ev) => set('collectorName', ev.target.value)}
                />
              )}
            </Field>
            <label className="checkbox checkbox--block">
              <input
                type="checkbox"
                checked={f.showSale}
                onChange={(ev) => set('showSale', ev.target.checked)}
              />
              <span>
                <strong>Hiện thông tin bán trên hồ sơ</strong>
                <small>Giá và ngày bán xuất hiện trong mục thành tích bán của bạn.</small>
              </span>
            </label>
            {f.showSale && (
              <div className="grid-2">
                <Field label="Giá đã bán" required error={e.soldPrice}>
                  {(p) => (
                    <VndInput {...p} value={f.soldPrice} onChange={(v) => set('soldPrice', v)} />
                  )}
                </Field>
                <Field label="Ngày bán" required error={e.soldAt}>
                  {(p) => (
                    <input
                      {...p}
                      type="date"
                      className="input"
                      max={new Date().toISOString().slice(0, 10)}
                      value={f.soldAt}
                      onChange={(ev) => set('soldAt', ev.target.value)}
                    />
                  )}
                </Field>
              </div>
            )}
          </>
        )}
      </Section>

      {hasShipping(f.listingType) && (
        <Section
          title="Thông tin vận chuyển"
          desc="Cho người mua biết tác phẩm sẽ được đóng gói và giao như thế nào."
        >
          <RadioGroup
            name="shippingMethod"
            label="Cách đóng gói"
            value={f.shippingMethod}
            options={SHIPPING_OPTIONS}
            onChange={(v) => set('shippingMethod', v)}
          />
          <div className="field">
            <span className="field__label">Kích thước kiện hàng (ước tính)</span>
            <DimensionInputs
              unit={f.dimensionUnit}
              labelPrefix="Kiện hàng — "
              values={[f.pkgHeight, f.pkgWidth, f.pkgDepth]}
              errors={[e.pkgHeight, e.pkgWidth, e.pkgDepth]}
              onChange={(i, v) => set((['pkgHeight', 'pkgWidth', 'pkgDepth'] as const)[i], v)}
            />
          </div>
          <Field
            label={`Khối lượng kiện hàng (${f.weightUnit === 'lb' ? 'lbs' : 'kg'})`}
            error={e.pkgWeight}
          >
            {(p) => (
              <DecimalInput
                {...p}
                placeholder="0"
                value={f.pkgWeight}
                onChange={(ev) => set('pkgWeight', ev.target.value)}
              />
            )}
          </Field>
        </Section>
      )}
    </div>
  );
}
