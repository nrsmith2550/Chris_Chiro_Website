// POST /api/book {service, date, start, name, phone, email, notes} → {appointment, token}
import crypto from "node:crypto";
import { sql, isConflict, APPT_COLS } from "../lib/db.js";
import { send, fail, body, patient } from "../lib/http.js";
import { SERVICES, checkTime, blocksFor } from "../lib/schedule.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return send(res, 405, { error: "Use POST." });
  try {
    const b = body(req);
    if (b.company) return send(res, 400, { error: "Booking failed." }); // honeypot for bots
    const svc = SERVICES[b.service];
    if (!svc) return send(res, 400, { error: "Choose a visit type." });
    const timeErr = checkTime(b.date, b.start, svc.dur);
    if (timeErr) return send(res, 400, { error: timeErr });
    const p = patient(b);
    if (p.error) return send(res, 400, { error: p.error });
    const token = crypto.randomBytes(24).toString("base64url");
    const { name, phone, email, notes } = p.value;
    const rows = await sql().query(`
      WITH a AS (
        INSERT INTO appointments (service, dur, day, start_time, name, phone, email, notes, manage_token)
        VALUES ($1, $2, $3::date, $4::time, $5, $6, $7, $8, $9) RETURNING id
      ), blk AS (
        INSERT INTO blocks (appt_id, day, slot) SELECT a.id, $3::date, s::time FROM a, unnest($10::text[]) s RETURNING appt_id
      )
      SELECT id FROM a`,
      [b.service, svc.dur, b.date, b.start, name, phone, email, notes, token, blocksFor(b.start, svc.dur)]);
    const [appt] = await sql().query(`SELECT ${APPT_COLS} FROM appointments WHERE id = $1`, [rows[0].id]);
    send(res, 201, { appointment: appt, token });
  } catch (e) {
    if (isConflict(e)) return send(res, 409, { error: "Someone just took that time. Pick another one." });
    fail(res, e);
  }
}
