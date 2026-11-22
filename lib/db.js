import { neon } from "@neondatabase/serverless";
let _sql;
export function sql() {
  if (!process.env.DATABASE_URL) throw Object.assign(new Error("DATABASE_URL is not set"), { status: 503 });
  return (_sql ||= neon(process.env.DATABASE_URL));
}
export const isConflict = e => e?.code === "23505";
// Columns the site needs, with date/time as plain strings
export const APPT_COLS = `id, service, dur, to_char(day,'YYYY-MM-DD') AS date, to_char(start_time,'HH24:MI') AS start,
  name, phone, email, notes, status, created_at AS created, updated_at AS updated`;
