// Front desk API. Everything except login needs the admin session cookie.
//   GET  /api/admin                          → {admin:bool, appointments?:[...]}  (booked visits from 60 days ago on)
//   POST /api/admin {action:"login", password}
//   POST /api/admin {action:"logout"}
//   POST /api/admin {action:"update", id, service, date, start, name, phone, email, notes}
//   POST /api/admin {action:"cancel", id}
import { sql, isConflict, APPT_COLS } from "../lib/db.js";
import { send, fail, body, patient } from "../lib/http.js";
import { isAdmin, checkPassword, setSession, clearSession } from "../lib/auth.js";
import { SERVICES, checkTime, blocksFor, officeNow, addDays } from "../lib/schedule.js";
const UUID = /^[0-9a-f-]{36}$/i;

async function list() {
  return sql().query(`SELECT ${APPT_COLS} FROM appointments WHERE status='booked' AND day >= $1::date ORDER BY day, start_time`,
    [addDays(officeNow().date, -60)]);
}

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      if (!isAdmin(req)) return send(res, 200, { admin: false });
      return send(res, 200, { admin: true, appointments: await list() });
    }
    if (req.method !== "POST") return send(res, 405, { error: "Use GET or POST." });
    const b = body(req);

    if (b.action === "login") {
      if (!checkPassword(b.password || "")) {
        await new Promise(r => setTimeout(r, 800)); // slow down guessing
        return send(res, 401, { error: "That password isn't right." });
      }
      setSession(res);
      return send(res, 200, { admin: true, appointments: await list() });
    }
    if (b.action === "logout") { clearSession(res); return send(res, 200, { admin: false }); }
    if (!isAdmin(req)) return send(res, 401, { error: "Your session ended. Sign in again." });
    if (!UUID.test(b.id || "")) return send(res, 400, { error: "That visit couldn't be found." });

    if (b.action === "cancel") {
      const [r] = await sql().transaction(tx => [
        tx`UPDATE appointments SET status='cancelled', cancelled_by='office', updated_at=now() WHERE id=${b.id} AND status='booked' RETURNING id`,
        tx`DELETE FROM blocks WHERE appt_id=${b.id}`
      ]);
      if (!r.length) return send(res, 404, { error: "That visit was already cancelled." });
      return send(res, 200, { ok: true, appointments: await list() });
    }

    if (b.action === "update") {
      const svc = SERVICES[b.service];
      if (!svc) return send(res, 400, { error: "Choose a visit type." });
      const timeErr = checkTime(b.date, b.start, svc.dur, { lead: 0, limitAhead: false }); // the office can book any open time
      if (timeErr) return send(res, 400, { error: timeErr });
      const p = patient(b);
      if (p.error) return send(res, 400, { error: p.error.replace("your name so we know who's coming", "the patient's name") });
      const { name, phone, email, notes } = p.value;
      const slots = blocksFor(b.start, svc.dur);
      try {
        const [, upd] = await sql().transaction(tx => [
          tx`DELETE FROM blocks WHERE appt_id=${b.id}`,
          tx`UPDATE appointments SET service=${b.service}, dur=${svc.dur}, day=${b.date}::date, start_time=${b.start}::time,
               name=${name}, phone=${phone}, email=${email}, notes=${notes}, updated_at=now()
             WHERE id=${b.id} AND status='booked' RETURNING id`,
          tx`INSERT INTO blocks (appt_id, day, slot)
             SELECT a.id, a.day, s::time FROM appointments a, unnest(${slots}::text[]) s WHERE a.id=${b.id} AND a.status='booked'`
        ]);
        if (!upd.length) return send(res, 404, { error: "That visit was cancelled, so it can't be edited." });
      } catch (e) {
        if (isConflict(e)) return send(res, 409, { error: "That time is already taken. Pick another." });
        throw e;
      }
      return send(res, 200, { ok: true, appointments: await list() });
    }
    send(res, 400, { error: "Unknown action." });
  } catch (e) { fail(res, e); }
}
