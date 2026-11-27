import type { InputHTMLAttributes, ReactNode } from 'react';
import { useId } from 'react';

interface FieldProps {
  label: ReactNode;
  required?: boolean;
  hint?: ReactNode;
  error?: string;
  /** Hiển thị "12/100 ký tự" */
  count?: { value: string; max: number };
  children: (props: {
    id: string;
    'aria-invalid'?: true;
    'aria-describedby'?: string;
  }) => ReactNode;
}

/** Nhãn + ô nhập + gợi ý / lỗi, gắn aria đúng chuẩn. */
export function Field({ label, required, hint, error, count, children }: FieldProps) {
  const id = useId();
  const descId = `${id}-desc`;
  const hasDesc = Boolean(error || hint || count);
  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        {label}
        {required && <span className="req"> *</span>}
      </label>
      {children({
        id,
        ...(error ? { 'aria-invalid': true as const } : {}),
        ...(hasDesc ? { 'aria-describedby': descId } : {}),
      })}
      {hasDesc && (
        <div id={descId} className="field__row">
          {error ? (
            <span className="field__error">{error}</span>
          ) : (
            <span className="field__hint">{hint}</span>
          )}
          {count && (
            <span className="field__hint" data-over={count.value.length > count.max || undefined}>
              {count.value.length}/{count.max}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/** Ô nhập số thập phân (dùng bàn phím số trên điện thoại). */
export function DecimalInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input className="input" inputMode="decimal" autoComplete="off" {...props} />;
}

interface RadioGroupProps<T extends string> {
  name: string;
  label: string;
  value: T;
  options: { id: T; label: string }[];
  onChange: (v: T) => void;
}

export function RadioGroup<T extends string>({
  name,
  label,
  value,
  options,
  onChange,
}: RadioGroupProps<T>) {
  return (
    <div className="radio-row" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <label key={o.id} className="radio">
          <input
            type="radio"
            name={name}
            value={o.id}
            checked={value === o.id}
            onChange={() => onChange(o.id)}
          />
          {o.label}
        </label>
      ))}
    </div>
  );
}

export function Section({
  title,
  desc,
  children,
}: {
  title: string;
  desc?: string;
  children: ReactNode;
}) {
  return (
    <section className="form-card" aria-label={title}>
      <h2 className="form-card__title">{title}</h2>
      {desc && <p className="form-card__desc">{desc}</p>}
      {children}
    </section>
  );
}
