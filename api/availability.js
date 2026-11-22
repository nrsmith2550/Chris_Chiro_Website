// GET /api/availability → office schedule + taken times (no patient details)
import { sql } from "../lib/db.js";
import { send, fail } from "../lib/http.js";
import { HOURS, DAYS_AHEAD, MIN_LEAD_MIN, SERVICES, TZ, officeNow, addDays } from "../lib/schedule.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return send(res, 405, { error: "Use GET." });
  try {
    const now = officeNow();
    const rows = await sql()`
      SELECT to_char(b.day,'YYYY-MM-DD') AS date, to_char(min(b.slot),'HH24:MI') AS start, count(*)::int * 15 AS dur
      FROM blocks b
      WHERE b.day BETWEEN ${now.date}::date AND ${addDays(now.date, DAYS_AHEAD)}::date
      GROUP BY b.appt_id, b.day`;
    send(res, 200, { tz: TZ, today: now.date, nowMin: now.min, hours: HOURS, daysAhead: DAYS_AHEAD, minLeadMin: MIN_LEAD_MIN, services: SERVICES, busy: rows });
  } catch (e) { fail(res, e); }
}
