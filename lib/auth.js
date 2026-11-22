import crypto from "node:crypto";
const COOKIE = "ce_admin";
const DAYS = 14;
function key() {
  const p = process.env.ADMIN_PASSWORD;
  if (!p || p.length < 8) throw Object.assign(new Error("The front desk password isn't set up yet (ADMIN_PASSWORD)."), { status: 503 });
  return crypto.createHash("sha256").update("eddins-admin:" + p).digest();
}
const sign = exp => crypto.createHmac("sha256", key()).update("admin." + exp).digest("base64url");
const same = (a, b) => { const x = Buffer.from(a), y = Buffer.from(b); return x.length === y.length && crypto.timingSafeEqual(x, y); };

export function checkPassword(given) {
  const want = process.env.ADMIN_PASSWORD || "";
  key(); // throws if unset
  const h = s => crypto.createHash("sha256").update(String(s)).digest();
  return crypto.timingSafeEqual(h(given), h(want));
}
export function setSession(res) {
  const exp = Date.now() + DAYS * 864e5;
  res.setHeader("Set-Cookie", `${COOKIE}=${exp}.${sign(exp)}; Path=/api; HttpOnly; Secure; SameSite=Strict; Max-Age=${DAYS * 86400}`);
}
export function clearSession(res) {
  res.setHeader("Set-Cookie", `${COOKIE}=; Path=/api; HttpOnly; Secure; SameSite=Strict; Max-Age=0`);
}
export function isAdmin(req) {
  const raw = (req.headers.cookie || "").split(/;\s*/).find(c => c.startsWith(COOKIE + "="));
  if (!raw) return false;
  const [exp, sig] = raw.slice(COOKIE.length + 1).split(".");
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  try { return same(sig, sign(exp)); } catch { return false; }
}
