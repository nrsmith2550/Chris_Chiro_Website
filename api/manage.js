// POST /api/manage — patients manage their own visits with the token they got when booking
//   {action:"lookup", items:[{id, token}]} → {appointments:[...]}
//   {action:"cancel", id, token}           → {ok:true}
import { sql, APPT_COLS } from "../lib/db.js";
import { send, fail, body } from "../lib/http.js";
const UUID = /^[0-9a-f-]{36}$/i;

export default async function handler(req, res) {
  if (req.method !== "POST") return send(res, 405, { error: "Use POST." });
  try {
    const b = body(req);
    if (b.action === "lookup") {
      const items = (Array.isArray(b.items) ? b.items : []).filter(i => UUID.test(i?.id) && typeof i?.token === "string").slice(0, 50);
      if (!items.length) return send(res, 200, { appointments: [] });
      const rows = await sql().query(
        `SELECT ${APPT_COLS} FROM appointments
         WHERE status = 'booked' AND (id, manage_token) IN (SELECT * FROM unnest($1::uuid[], $2::text[]))
         ORDER BY day, start_time`,
        [items.map(i => i.id), items.map(i => i.token)]);
      return send(res, 200, { appointments: rows });
    }
    if (b.action === "cancel") {
      if (!UUID.test(b.id || "") || typeof b.token !== "string") return send(res, 400, { error: "That visit couldn't be found." });
      const [r] = await sql().transaction(tx => [
        tx`UPDATE appointments SET status='cancelled', cancelled_by='patient', updated_at=now()
           WHERE id=${b.id} AND manage_token=${b.token} AND status='booked' RETURNING id`,
        tx`DELETE FROM blocks WHERE appt_id IN (SELECT id FROM appointments WHERE id=${b.id} AND manage_token=${b.token})`
      ]);
      if (!r.length) return send(res, 404, { error: "That visit couldn't be found. It may already be cancelled." });
      return send(res, 200, { ok: true });
    }
    send(res, 400, { error: "Unknown action." });
  } catch (e) { fail(res, e); }
}
