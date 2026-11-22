// Office schedule. This is the single source of truth: the site loads it from /api/availability.
export const TZ = "America/New_York";
export const HOURS = {          // 0 = Sunday … 6 = Saturday; [open, close] sessions in office local time
  0: [],
  1: [["08:30","12:00"],["14:00","18:00"]],
  2: [["08:30","12:00"],["14:00","18:00"]],
  3: [["08:30","12:00"]],
  4: [["08:30","12:00"],["14:00","18:00"]],
  5: [["08:30","12:00"],["14:00","17:00"]],
  6: [["09:00","12:00"]]
};
export const DAYS_AHEAD = 21;     // how far out patients can book
export const MIN_LEAD_MIN = 60;   // minimum notice for an online booking
export const SERVICES = {
  ret: { name: "Adjustment", who: "Returning patient", dur: 15, desc: "Quick visit for established patients." },
  new: { name: "New patient visit", who: "New patient", dur: 30, desc: "Consultation, exam and first adjustment." }
};

const pad = n => String(n).padStart(2, "0");
export const toMin = hm => { const [h, m] = hm.split(":").map(Number); return h * 60 + m; };
export const toHM = m => pad(Math.floor(m / 60)) + ":" + pad(m % 60);

// Current date and minute-of-day in the office's time zone
export function officeNow() {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23"
  }).formatToParts(new Date()).map(x => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, min: Number(p.hour) * 60 + Number(p.minute) };
}
export function addDays(ymd, n) {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
}
export function dow(ymd) { const [y, m, d] = ymd.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); }

// 15-minute blocks a visit occupies
export function blocksFor(start, dur) {
  const out = [];
  for (let t = toMin(start); t < toMin(start) + dur; t += 15) out.push(toHM(t));
  return out;
}

// Is this start time inside office hours on a 15-minute boundary? opts.lead / opts.limitAhead apply to online bookings.
export function checkTime(date, start, dur, { lead = MIN_LEAD_MIN, limitAhead = true } = {}) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(start)) return "Pick a valid date and time.";
  const now = officeNow();
  if (date < now.date) return "That date has already passed.";
  if (limitAhead && date > addDays(now.date, DAYS_AHEAD - 1)) return `Visits can be booked up to ${DAYS_AHEAD} days ahead.`;
  const t = toMin(start);
  if (t % 15) return "Times start on the quarter hour.";
  if (date === now.date && t < now.min + lead) return "That time is too soon. Pick a later one.";
  const ok = (HOURS[dow(date)] || []).some(([o, c]) => t >= toMin(o) && t + dur <= toMin(c));
  return ok ? null : "That time is outside office hours.";
}
