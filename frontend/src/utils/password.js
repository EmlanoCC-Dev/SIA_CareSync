export const PASSWORD_REQUIREMENTS = 'Use at least 8 characters, including an uppercase letter, a number, and a special character (at most 72 bytes).';

export function isValidPassword(password) {
  return typeof password === 'string' && password.length >= 8 && new TextEncoder().encode(password).length <= 72 &&
    /[A-Z]/.test(password) && /[0-9]/.test(password) && /[\p{P}\p{S}]/u.test(password);
}
