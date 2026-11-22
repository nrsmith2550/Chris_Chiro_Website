export function send(res, status, body) {
  res.setHeader("Cache-Control", "no-store");
  res.status(status).json(body);
}
export function fail(res, e) {
  if (e?.status) return send(res, e.status, { error: e.message });
  console.error(e);
  send(res, 500, { error: "Something went wrong on our end. Please try again." });
}
export function body(req) {
  if (req.body && typeof req.body === "object") return req.body;
  try { return JSON.parse(req.body || "{}"); } catch { return {}; }
}
const clean = (v, max) => String(v ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max);
// Validate patient fields; returns {value} or {error}
export function patient(b) {
  const name = clean(b.name, 120), phone = clean(b.phone, 40), email = clean(b.email, 200), notes = String(b.notes ?? "").trim().slice(0, 1000);
  if (!name) return { error: "Add your name so we know who's coming." };
  if (phone.replace(/\D/g, "").length < 10) return { error: "Add a phone number with area code." };
  if (email && !/^\S+@\S+\.\S+$/.test(email)) return { error: "That email doesn't look right. Fix it or leave it blank." };
  return { value: { name, phone, email, notes } };
}
