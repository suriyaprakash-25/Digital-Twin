// Mirrors the backend signup/reset password policy (400 WEAK_PASSWORD):
// at least 8 characters, with at least one letter and one digit.

export const PASSWORD_POLICY_HINT = 'At least 8 characters, including a letter and a number';

/** Returns an error message, or '' when the password satisfies the policy. */
export function validatePassword(password) {
  const value = String(password || '');
  if (value.length < 8) return 'Password must be at least 8 characters long.';
  if (!/[A-Za-z]/.test(value)) return 'Password must include at least one letter.';
  if (!/\d/.test(value)) return 'Password must include at least one number.';
  return '';
}

// The reset-password endpoint is stricter than signup (mirrors RESET_PASSWORD_PATTERN in
// backend/src/routes/auth.js): upper + lower case, digit and one of @$!%*?&, 8-128 chars.
const RESET_PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,128}$/;

export function validateResetPassword(password) {
  return RESET_PASSWORD_PATTERN.test(String(password || ''))
    ? ''
    : 'Password must be at least 8 characters long, include one uppercase letter, one lowercase letter, one number, and one special character (@$!%*?&).';
}
