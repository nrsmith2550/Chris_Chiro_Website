/* Shared by index.html (booking) and admin.html (front desk). Each page defines render(). */
/* ===== Settings =====
   The live site loads these from the server (lib/schedule.js is the one to edit).
   The values here are only used in preview mode, when the API can't be reached. */
let HOURS = {
  0: [],
  1: [["08:30","12:00"],["14:00","18:00"]],
  2: [["08:30","12:00"],["14:00","18:00"]],
  3: [["08:30","12:00"]],
  4: [["08:30","12:00"],["14:00","18:00"]],
  5: [["08:30","12:00"],["14:00","17:00"]],
  6: [["09:00","12:00"]]
};
let DAYS_AHEAD = 21;
let MIN_LEAD_MIN = 60;
let SERVICES = {
  ret: {name:"Adjustment", who:"Returning patient", dur:15, desc:"Quick visit for established patients."},
  new: {name:"New patient visit", who:"New patient", dur:30, desc:"Consultation, exam and first adjustment."}
};
const OFFICE_TZ = "America/New_York";

/* ===== Helpers ===== */
const $ = s => document.querySelector(s);
const DOW = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const DOW_LONG = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const MON = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const pad = n => String(n).padStart(2,"0");
const toMin = hm => { const [h,m] = hm.split(":").map(Number); return h*60+m; };
const toHM = m => pad(Math.floor(m/60))+":"+pad(m%60);
const ymd = d => d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate());
const parseYmd = s => { const [y,m,d] = s.split("-").map(Number); return new Date(y,m-1,d); };
const fmt12 = hm => { let [h,m] = hm.split(":").map(Number); const ap = h>=12?"PM":"AM"; h = h%12||12; return h+":"+pad(m)+" "+ap; };
const fmtDate = s => { const d = parseYmd(s); return DOW_LONG[d.getDay()]+", "+MON[d.getMonth()]+" "+d.getDate(); };
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
// Today's date and the current minute in the office's time zone, whatever the viewer's clock says
function officeNow(){
  try {
    const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA",{timeZone:OFFICE_TZ,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(new Date()).map(x=>[x.type,x.value]));
    return {date:`${p.year}-${p.month}-${p.day}`, min:Number(p.hour)*60+Number(p.minute)};
  } catch { const d = new Date(); return {date: ymd(d), min: d.getHours()*60+d.getMinutes()}; }
}
const addDays = (s, n) => { const d = parseYmd(s); d.setDate(d.getDate()+n); return ymd(d); };
const uid = () => Math.random().toString(36).slice(2,10)+Date.now().toString(36).slice(-4);

/* ===== State ===== */
const S = {
  tab: "book", step: 1, svc: null, date: null, time: null,
  form: {name:"", phone:"", email:"", notes:""},
  busy: {},            // source -> [{id?,date,start,dur}] taken times
  mine: [],            // this browser's upcoming visits
  allAppts: {},        // front desk only: {db: [...appointments]}
  mode: "loading",     // loading | live | preview
  isAdmin: false, saving: false, error: "", lastBooked: null
};

/* ===== Availability ===== */
function takenSet(excludeId){
  const set = new Set();
  Object.entries(S.busy).forEach(([src, list]) => (src === "server" && S.isAdmin ? [] : list||[]).forEach(b => {
    if (b.id === excludeId) return;
    for (let t = toMin(b.start); t < toMin(b.start)+b.dur; t += 15) set.add(b.date+" "+toHM(t));
  }));
  return set;
}
function slotsFor(dateStr, dur, excludeId, lead = MIN_LEAD_MIN){
  const d = parseYmd(dateStr), sessions = HOURS[d.getDay()] || [];
  const taken = takenSet(excludeId);
  const now = officeNow(), isToday = now.date === dateStr;
  if (dateStr < now.date) return sessions.map(([o,c]) => ({label: fmt12(o)+" – "+fmt12(c), slots: []}));
  const nowMin = now.min + lead;
  return sessions.map(([o,c]) => {
    const out = [];
    for (let t = toMin(o); t + dur <= toMin(c); t += 15) {
      if (isToday && t < nowMin) continue;
      let free = true;
      for (let k = t; k < t+dur; k += 15) if (taken.has(dateStr+" "+toHM(k))) { free = false; break; }
      if (free) out.push(toHM(t));
    }
    return {label: fmt12(o)+" – "+fmt12(c), slots: out};
  });
}
function bookableDays(){
  const out = [], today = officeNow().date;
  for (let i = 0; i < DAYS_AHEAD; i++) out.push(addDays(today, i));
  return out;
}
function countFree(dateStr, dur){ return slotsFor(dateStr, dur).reduce((n,s) => n + s.slots.length, 0); }
function firstOpen(dur){
  for (const day of bookableDays()){ const s = slotsFor(day, dur).flatMap(x => x.slots); if (s.length) return {day, time:s[0]}; }
  return null;
}

/* ===== Server ===== */
async function api(path, payload){
  const opts = payload === undefined ? {credentials:"same-origin"} :
    {method:"POST", credentials:"same-origin", headers:{"Content-Type":"application/json"}, body:JSON.stringify(payload)};
  let r;
  try { r = await fetch(path, opts); }
  catch { throw Object.assign(new Error("We couldn't reach the server. Check your connection and try again."), {offline:true}); }
  let data = {};
  try { data = await r.json(); } catch {}
  if (!r.ok) throw Object.assign(new Error(data.error || "Something went wrong. Please try again."), {status:r.status});
  return data;
}
function applyConfig(c){
  if (c.hours) HOURS = c.hours;
  if (c.daysAhead) DAYS_AHEAD = c.daysAhead;
  if (c.minLeadMin != null) MIN_LEAD_MIN = c.minLeadMin;
  if (c.services) SERVICES = c.services;
}
async function loadAvailability(){
  const c = await api("/api/availability");
  applyConfig(c);
  S.busy = {...S.busy, server: c.busy || []};
  return c;
}
/* Visits booked from this browser: ids + private tokens, kept so the patient can see and cancel them */
const VISITS_KEY = "ce_visits";
let memVisits = [];
function savedVisits(){ try { return JSON.parse(localStorage.getItem(VISITS_KEY) || "[]"); } catch { return memVisits; } }
function storeVisits(list){ memVisits = list; try { localStorage.setItem(VISITS_KEY, JSON.stringify(list)); } catch {} }
async function loadMine(){
  const keys = savedVisits();
  if (!keys.length) { S.mine = []; return; }
  const {appointments} = await api("/api/manage", {action:"lookup", items: keys});
  S.mine = appointments.map(a => ({...a, token: keys.find(k => k.id === a.id)?.token}));
  storeVisits(keys.filter(k => appointments.some(a => a.id === k.id)));
}

function allRows(){
  const rows = [];
  Object.entries(S.allAppts).forEach(([owner, items]) => (items||[]).forEach(a => rows.push({...a, owner})));
  return rows.sort((a,b) => (a.date+a.start).localeCompare(b.date+b.start));
}
function showFlash(msg){
  let el = $("#flash");
  if (!el) { el = document.createElement("div"); el.id = "flash"; el.className = "flash"; el.setAttribute("role","status"); document.body.appendChild(el); }
  el.textContent = msg; el.hidden = false;
  clearTimeout(A.flashT); A.flashT = setTimeout(() => { el.hidden = true; }, 3000);
}
function startPreview(){
  if (S.mode !== "loading") return;
  S.mode = "preview";
  // clearly-labelled example appointments so the preview looks real
  const people = [["Example: Dana Ruiz","(555) 010-2231","dana@example.com","ret","Lower back, follow-up"],["Example: Marcus Lee","(555) 010-4418","","new","Neck pain after a car accident last month"],["Example: Priya Shah","(555) 010-7720","priya@example.com","ret",""],["Example: Tom Becker","(555) 010-3305","","ret","Stiff mid-back"],["Example: Alicia Moore","(555) 010-9142","alicia@example.com","new","Sciatica down the left leg"],["Example: Sam Ortiz","(555) 010-6650","","ret",""]];
  const days = bookableDays().filter(d => (HOURS[parseYmd(d).getDay()]||[]).length).slice(0,4);
  const times = ["08:30","09:00","09:45","10:30","11:15","14:00","15:30"];
  const all = {}; let k = 0;
  days.forEach((d,i) => times.slice(i%3, i%3+4).forEach((t,j) => {
    const [name,phone,email,svc,notes] = people[k++ % people.length];
    (all["example-"+k] ||= []).push({id:uid(), service:svc, dur:SERVICES[svc].dur, date:d, start:t, name, phone, email, notes, created:new Date().toISOString()});
  }));
  S.allAppts = all;
  S.busy = Object.fromEntries(Object.entries(all).map(([o,items]) => [o, items.map(a => ({id:a.id,date:a.date,start:a.start,dur:a.dur}))]));
  render();
}
// Live data when the API answers; preview mode (example data, nothing saved) when it doesn't
async function connect(){
  try {
    await loadAvailability();
    S.mode = "live"; S.loadError = "";
    if (typeof onLive === "function") await onLive();
  } catch (e) {
    if (e.offline || e.status === 404 || e.status === 405) { startPreview(); return; }
    S.mode = "live"; S.loadError = e.message;   // server reached but failed (e.g. database not configured yet)
  }
  render();
  // keep taken times fresh while the page is open
  setInterval(async () => { if (S.mode !== "live") return; try { await loadAvailability(); render(); } catch {} }, 60000);
}
