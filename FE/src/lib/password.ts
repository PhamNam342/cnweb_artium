/** Đồng bộ với rule backend: 8–72 ký tự, có ít nhất một chữ cái và một chữ số. */
export interface PasswordCheck {
  valid: boolean;
  /** 0..3 — số vạch sáng trên thanh độ mạnh */
  score: 0 | 1 | 2 | 3;
  hint: string;
}

export function checkPassword(pw: string): PasswordCheck {
  const hasLetter = /[A-Za-z]/.test(pw);
  const hasDigit = /\d/.test(pw);
  const valid = pw.length >= 8 && pw.length <= 72 && hasLetter && hasDigit;
  let score = 0;
  if (pw.length >= 8) score++;
  if (hasLetter && hasDigit) score++;
  if (pw.length >= 12 && /[^A-Za-z0-9]/.test(pw)) score++;

  let hint = 'Tối thiểu 8 ký tự, gồm chữ cái và chữ số.';
  if (pw.length > 72) hint = 'Mật khẩu tối đa 72 ký tự.';
  else if (pw.length > 0 && !valid) hint = 'Chưa đủ: cần ít nhất 8 ký tự, có cả chữ và số.';
  else if (valid && score < 3)
    hint = 'Hợp lệ. Thêm ký tự đặc biệt và dài hơn 12 ký tự để mạnh hơn.';
  else if (valid) hint = 'Mật khẩu mạnh.';
  return { valid, score: score as PasswordCheck['score'], hint };
}
