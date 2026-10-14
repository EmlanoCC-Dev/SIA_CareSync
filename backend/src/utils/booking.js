const ACTIVE_APPOINTMENT_STATUSES = ['Pending', 'Needs correction', 'Confirmed', 'Checked In', 'In Progress'];

function oneMonthAhead(day) {
  const date = new Date(`${day}T00:00:00Z`);
  const originalDay = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + 2);
  date.setUTCDate(0);
  date.setUTCDate(Math.min(originalDay, date.getUTCDate()));
  return date.toISOString().slice(0, 10);
}

module.exports = { ACTIVE_APPOINTMENT_STATUSES, oneMonthAhead };
