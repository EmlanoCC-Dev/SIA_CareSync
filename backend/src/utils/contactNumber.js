function validateContactNumber(value) {
  if (value === undefined || value === '') return '';
  if (typeof value !== 'string' || !/^\+?[0-9 ()-]+$/.test(value.trim()) ||
      value.replace(/\D/g, '').length < 7 || value.replace(/\D/g, '').length > 15) {
    throw Object.assign(new Error('Provide a contact number with 7 to 15 digits, optionally starting with +.'), { statusCode: 400 });
  }
  return value.trim();
}

module.exports = { validateContactNumber };
