export const NAME_REQUIREMENTS = 'Names must use letters, spaces, hyphens, apostrophes, or periods, up to 100 characters. Numbers are not allowed.';

export function isValidName(value) {
  return typeof value === 'string' && value.length <= 100 && /\p{L}/u.test(value) &&
    /^[\p{L}\p{M} .'\u2019-]+$/u.test(value.trim());
}
