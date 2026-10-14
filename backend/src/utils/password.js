const PASSWORD_REQUIREMENTS = 'Use at least 8 characters, including an uppercase letter, a number, and a special character (at most 72 bytes).';

function isValidPassword(password) {
  return typeof password === 'string' && password.length >= 8 && Buffer.byteLength(password) <= 72 &&
    /[A-Z]/.test(password) && /[0-9]/.test(password) && /[\p{P}\p{S}]/u.test(password);
}

module.exports = { isValidPassword, PASSWORD_REQUIREMENTS };
