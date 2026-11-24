import { useId, useState } from 'react';
import { checkPassword } from '../lib/password';

interface Props {
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: 'current-password' | 'new-password';
  showStrength?: boolean;
  labelAside?: React.ReactNode;
  error?: string;
}

export function PasswordField({
  label,
  value,
  onChange,
  autoComplete,
  showStrength,
  labelAside,
  error,
}: Props) {
  const id = useId();
  const hintId = `${id}-hint`;
  const [visible, setVisible] = useState(false);
  const check = checkPassword(value);
  const barColor =
    check.score === 3
      ? 'var(--c-green)'
      : check.score === 2
        ? 'var(--c-primary)'
        : 'var(--c-amber)';

  return (
    <div className="field">
      <div className="field__row">
        <label htmlFor={id} className="field__label">
          {label}
        </label>
        {labelAside}
      </div>
      <div className="input-group">
        <input
          id={id}
          className="input"
          type={visible ? 'text' : 'password'}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-describedby={showStrength || error ? hintId : undefined}
          aria-invalid={error ? true : undefined}
          required
        />
        <button
          type="button"
          className="input-group__action"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
        >
          {visible ? 'Ẩn' : 'Hiện'}
        </button>
      </div>
      {showStrength && (
        <>
          <div className="strength" aria-hidden="true">
            {[1, 2, 3].map((i) => (
              <span
                key={i}
                style={{ background: value.length > 0 && check.score >= i ? barColor : undefined }}
              />
            ))}
          </div>
          <p
            id={hintId}
            className="field__hint"
            style={value.length > 0 && !check.valid ? { color: '#B45309' } : undefined}
          >
            {check.hint}
          </p>
        </>
      )}
      {!showStrength && error && (
        <p id={hintId} className="field__error">
          {error}
        </p>
      )}
    </div>
  );
}
