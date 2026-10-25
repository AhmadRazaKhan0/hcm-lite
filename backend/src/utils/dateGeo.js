/**
 * Calculate the distance in metres between two GPS coordinates
 * using the Haversine formula.
 */
export function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000; // Earth's radius in metres
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Return the date portion only (midnight UTC) for a given Date or ISO string.
 * Used to look up attendance records by day.
 */
export function dayOnly(dateInput) {
  const d = new Date(dateInput);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/**
 * Count working days between two dates (inclusive), excluding Sat/Sun.
 * Holidays are not excluded here (would need a holiday list).
 */
export function workingDaysBetween(start, end) {
  const s = new Date(start);
  const e = new Date(end);
  let count = 0;
  const cur = new Date(s);
  while (cur <= e) {
    const day = cur.getUTCDay(); // 0=Sun, 6=Sat
    if (day !== 0 && day !== 6) count++;
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return count;
}

/**
 * Get the number of working days in a given month/year (Mon-Fri only).
 */
export function workingDaysInMonth(year, month) {
  // month is 1-indexed
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate(); // last day
  let count = 0;
  for (let d = 1; d <= days; d++) {
    const day = new Date(Date.UTC(year, month - 1, d)).getUTCDay();
    if (day !== 0 && day !== 6) count++;
  }
  return count;
}

/**
 * Parse "HH:MM" time string and return { hours, minutes }
 */
export function parseTime(timeStr) {
  const [h, m] = (timeStr || '09:00').split(':').map(Number);
  return { hours: h || 0, minutes: m || 0 };
}
