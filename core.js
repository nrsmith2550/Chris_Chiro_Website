/* Shared by index.html (booking) and admin.html (front desk). Each page defines render(). */
/* ===== Settings: edit these to match the office ===== */
const HOURS = {          // 0 = Sunday … 6 = Saturday; each day is a list of [open, close] sessions
  0: [],
  1: [["08:30","12:00"],["14:00","18:00"]],
  2: [["08:30","12:00"],["14:00","18:00"]],
  3: [["08:30","12:00"]],
  4: [["08:30","12:00"],["14:00","18:00"]],
  5: [["08:30","12:00"],["14:00","17:00"]],
  6: [["09:00","12:00"]]
};
const DAYS_AHEAD = 21;     // how far out people can book
const MIN_LEAD_MIN = 60;   // no bookings less than this many minutes from now
const SERVICES = {
  ret: {name:"Adjustment", who:"Returning patient", dur:15, desc:"Quick visit for established patients."},
  new: {name:"New patient visit", who:"New patient", dur:30, desc:"Consultation, exam and first adjustment."}
};

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
const uid = () => Math.random().toString(36).slice(2,10)+Date.now().toString(36).slice(-4);
const docsOf = snap => { const list = snap?.docs ?? (Array.isArray(snap) ? snap : []); return list.map(d => ({id: d.id, data: typeof d.data === "function" ? d.data() : (d.data ?? d)})); };
const dataOf = snap => snap == null ? null : (typeof snap.data === "function" ? snap.data() : (snap.data !== undefined && snap.exists !== undefined ? snap.data : snap));

/* ===== State ===== */
const S = {
  tab: "book", step: 1, svc: null, date: null, time: null,
  form: {name:"", phone:"", email:"", notes:""},
  busy: {},            // userId -> [{id,date,start,dur}]
  mine: [],            // my full appointments
  allAppts: {},        // owner only: userId -> items
  mode: "loading",     // loading | live | preview
  me: null, isAdmin: false, saving: false, error: "", lastBooked: null
};
let db = null, user = null;

/* ===== Availability ===== */
function takenSet(excludeId){
  const set = new Set();
  Object.values(S.busy).forEach(list => (list||[]).forEach(b => {
    if (b.id === excludeId) return;
    for (let t = toMin(b.start); t < toMin(b.start)+b.dur; t += 15) set.add(b.date+" "+toHM(t));
  }));
  return set;
}
function slotsFor(dateStr, dur, excludeId, lead = MIN_LEAD_MIN){
  const d = parseYmd(dateStr), sessions = HOURS[d.getDay()] || [];
  const taken = takenSet(excludeId);
  const now = new Date(), isToday = ymd(now) === dateStr;
  const nowMin = now.getHours()*60 + now.getMinutes() + lead;
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
  const out = [], base = new Date(); base.setHours(0,0,0,0);
  for (let i = 0; i < DAYS_AHEAD; i++){ const d = new Date(base); d.setDate(base.getDate()+i); out.push(ymd(d)); }
  return out;
}
function countFree(dateStr, dur){ return slotsFor(dateStr, dur).reduce((n,s) => n + s.slots.length, 0); }
function firstOpen(dur){
  for (const day of bookableDays()){ const s = slotsFor(day, dur).flatMap(x => x.slots); if (s.length) return {day, time:s[0]}; }
  return null;
}

/* ===== Shared data ===== */
async function writeMine(){
  const mineBusy = S.mine.map(a => ({id:a.id, date:a.date, start:a.start, dur:a.dur}));
  await db.doc("appts/"+S.me).set({items: S.mine});
  await db.doc("busy/"+S.me).set({items: mineBusy});
}
async function adminWrite(owner, items){
  const prev = S.allAppts[owner];
  S.allAppts = {...S.allAppts, [owner]: items};
  S.busy = {...S.busy, [owner]: items.map(a => ({id:a.id,date:a.date,start:a.start,dur:a.dur}))};
  if (owner === S.me) S.mine = items;
  if (S.mode !== "preview") {
    try {
      await db.doc("appts/"+owner).set({items});
      await db.doc("busy/"+owner).set({items: S.busy[owner]});
    } catch (e) {
      S.allAppts = {...S.allAppts, [owner]: prev};
      S.busy = {...S.busy, [owner]: (prev||[]).map(a => ({id:a.id,date:a.date,start:a.start,dur:a.dur}))};
      if (owner === S.me) S.mine = prev || [];
      render(); return false;
    }
  }
  render(); return true;
}
function allRows(){
  const rows = [];
  Object.entries(S.allAppts).forEach(([owner, items]) => (items||[]).forEach(a => rows.push({...a, owner})));
  return rows.sort((a,b) => (a.date+a.start).localeCompare(b.date+b.start));
}
function addDays(s, n){ const d = parseYmd(s); d.setDate(d.getDate()+n); return ymd(d); }
function canAdmin(){ return S.isAdmin || S.mode === "preview"; }
function showFlash(msg){
  let el = $("#flash");
  if (!el) { el = document.createElement("div"); el.id = "flash"; el.className = "flash"; el.setAttribute("role","status"); document.body.appendChild(el); }
  el.textContent = msg; el.hidden = false;
  clearTimeout(A.flashT); A.flashT = setTimeout(() => { el.hidden = true; }, 3000);
}
function startPreview(){
  if (S.mode !== "loading") return;
  S.mode = "preview"; S.me = "preview-user";
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
async function connect(){
  const fallback = setTimeout(startPreview, 10000);
  try {
    if (!window.claude?.use) { clearTimeout(fallback); return startPreview(); }
    [db, user] = await Promise.all([claude.use("db"), claude.use("user")]);
    if (!db || !user) { clearTimeout(fallback); return startPreview(); }
    S.me = await user.id();
    S.isAdmin = ((await user.isOwner?.()) ?? false) || ((await user.canEdit?.()) ?? false);
    let gotBusy = false;
    db.collection("busy").onSnapshot(snap => {
      gotBusy = true; clearTimeout(fallback);
      const next = {};
      docsOf(snap).forEach(d => { next[d.id] = d.data?.items || []; });
      S.busy = next;
      if (S.mode === "loading") S.mode = "live";
      render();
    }, () => { clearTimeout(fallback); startPreview(); });
    db.doc("appts/"+S.me).onSnapshot(snap => {
      const data = dataOf(snap);
      if (!S.saving) S.mine = data?.items || [];
      render();
    }, () => {});
    if (S.isAdmin) {
      db.collection("appts").onSnapshot(snap => {
        const next = {};
        docsOf(snap).forEach(d => { next[d.id] = d.data?.items || []; });
        S.allAppts = next; render();
      }, () => { S.isAdmin = false; render(); });
    }
  } catch (e) { clearTimeout(fallback); startPreview(); }
}

