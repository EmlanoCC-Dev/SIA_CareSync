export const dateKey = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

export function oneMonthAhead(day) {
  const date = new Date(`${day}T00:00:00Z`);
  const originalDay = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + 2);
  date.setUTCDate(0);
  date.setUTCDate(Math.min(originalDay, date.getUTCDate()));
  return date.toISOString().slice(0, 10);
}
