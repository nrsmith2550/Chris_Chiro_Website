/* Booking page. Needs core.js first. */
/* ===== Rendering ===== */
function modeBanner(){
  if (S.mode === "preview") return `<div class="banner">Preview mode: bookings made here aren't saved. Open the published page while signed in to book for real.</div>`;
  if (S.mode === "loading") return `<div class="banner info">Checking which times are taken…</div>`;
  return "";
}

function stepsBar(){ return `<div class="steps" aria-hidden="true">${[1,2,3].map(i=>`<span class="${S.step>=i?"on":""}"></span>`).join("")}</div>`; }
function svcButton(key){
  const v = SERVICES[key];
  return `<button type="button" class="svc" data-svc="${key}" aria-pressed="${S.svc===key}">
    <div class="dur"><div><b>${v.dur}</b><small>min</small></div></div>
    <div><h4>${v.name}</h4><p>${v.who}. ${v.desc}</p></div></button>`;
}
function renderBook(){
  const app = $("#app");
  if (S.step === 4 && S.lastBooked) {
    const b = S.lastBooked, v = SERVICES[b.service];
    app.innerHTML = `
      <div class="ticket" role="status">
        <div class="check"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0f1012" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L20 7"/></svg></div>
        <h3>You're booked</h3>
        <div>See you soon, ${esc(b.name.split(" ")[0])}.</div>
        <dl>
          <dt>Visit</dt><dd>${v.name} · ${v.dur} min</dd>
          <dt>Date</dt><dd>${fmtDate(b.date)}</dd>
          <dt>Time</dt><dd>${fmt12(b.start)}</dd>
          <dt>With</dt><dd>Dr. Chris Eddins</dd>
        </dl>
        <div class="tear">${b.service==="new" ? "First visit: please arrive 10 minutes early with a photo ID and insurance card." : "Need to change it? Cancel from My visits and pick a new time."}</div>
      </div>
      ${S.mode==="preview" ? `<div class="banner">Preview mode: this booking wasn't saved.</div>` : ""}
      <div class="spacer"></div>
      <div class="footer-bar">
        <button class="btn ghost" type="button" id="goMine">My visits</button>
        <button class="btn primary" type="button" id="again">Book another</button>
      </div>`;
    $("#goMine").onclick = () => setTab("mine");
    $("#again").onclick = () => { reset(); render(); };
    return;
  }

  if (S.step === 1) {
    app.innerHTML = `${stepsBar()}${modeBanner()}
      <div class="label">Choose your visit</div>
      ${svcButton("ret")}${svcButton("new")}
      <div class="spacer"></div>
      <div class="note">Not sure which? If you've never seen Dr. Eddins before, choose New patient visit.</div>`;
    app.querySelectorAll("[data-svc]").forEach(b => b.onclick = () => pickService(b.dataset.svc));
    return;
  }

  const v = SERVICES[S.svc];
  if (S.step === 2) {
    const days = bookableDays();
    if (!S.date || !(HOURS[parseYmd(S.date).getDay()]||[]).length) {
      S.date = days.find(d => countFree(d, v.dur) > 0) || days[0];
    }
    const sessions = slotsFor(S.date, v.dur);
    const any = sessions.some(s => s.slots.length);
    app.innerHTML = `${stepsBar()}${modeBanner()}
      <div class="summary"><div><b>${v.name}</b><small>${v.dur} minutes</small></div><button class="linkbtn" type="button" id="chgSvc">Change</button></div>
      <div class="label">Pick a day</div>
      <div class="days" id="days">${days.map(dStr => {
        const d = parseYmd(dStr), open = (HOURS[d.getDay()]||[]).length, n = open ? countFree(dStr, v.dur) : 0;
        return `<button type="button" class="day" data-day="${dStr}" aria-pressed="${dStr===S.date}" ${n?"":"disabled"} aria-label="${fmtDate(dStr)}, ${n} open times">
          <small>${DOW[d.getDay()]}</small><b>${d.getDate()}</b><em>${!open?"Closed":n?n+" open":"Full"}</em></button>`;
      }).join("")}</div>
      <div class="label">${fmtDate(S.date)}</div>
      ${any ? sessions.filter(s=>s.slots.length).map(s => `
        <div class="session">${s.label}</div>
        <div class="slots">${s.slots.map(t => `<button type="button" class="slot" data-time="${t}" aria-pressed="${t===S.time}">${fmt12(t).replace(" AM","a").replace(" PM","p")}</button>`).join("")}</div>`).join("")
        : `<div class="empty">No open times this day. Try another.</div>`}
      <div class="spacer"></div>
      <div class="footer-bar">
        <button class="btn ghost" type="button" id="back">Back</button>
        <button class="btn accent" type="button" id="next" ${S.time?"":"disabled"}>${S.time ? "Continue · "+fmt12(S.time) : "Pick a time"}</button>
      </div>`;
    $("#chgSvc").onclick = () => { S.step = 1; render(); };
    $("#back").onclick = () => { S.step = 1; render(); };
    $("#next").onclick = () => { S.step = 3; render(); };
    app.querySelectorAll("[data-day]").forEach(b => b.onclick = () => { S.date = b.dataset.day; S.time = null; render(); });
    app.querySelectorAll("[data-time]").forEach(b => b.onclick = () => { S.time = b.dataset.time; render(); });
    const sel = app.querySelector('.day[aria-pressed="true"]'); if (sel) sel.scrollIntoView({block:"nearest", inline:"center"});
    return;
  }

  if (S.step === 3) {
    const f = S.form;
    app.innerHTML = `${stepsBar()}${modeBanner()}
      <div class="summary"><div><b>${fmtDate(S.date)} · ${fmt12(S.time)}</b><small>${v.name}, ${v.dur} min</small></div><button class="linkbtn" type="button" id="chgTime">Change</button></div>
      <div class="label">Your details</div>
      <form id="f" novalidate style="display:flex;flex-direction:column;gap:12px">
        <div class="field"><label for="fName">Full name</label><input id="fName" autocomplete="name" value="${esc(f.name)}" required></div>
        <div class="row2">
          <div class="field"><label for="fPhone">Phone</label><input id="fPhone" type="tel" autocomplete="tel" inputmode="tel" value="${esc(f.phone)}" required></div>
          <div class="field"><label for="fEmail">Email <span style="color:var(--mute);font-weight:500">(optional)</span></label><input id="fEmail" type="email" autocomplete="email" value="${esc(f.email)}"></div>
        </div>
        <div class="field"><label for="fNotes">${S.svc==="new" ? "What brings you in?" : "Anything Dr. Eddins should know?"} <span style="color:var(--mute);font-weight:500">(optional)</span></label><textarea id="fNotes" placeholder="${S.svc==="new" ? "e.g. lower back pain for two weeks after lifting" : "e.g. neck is stiff again"}">${esc(f.notes)}</textarea></div>
        <div class="err" id="err" role="alert">${esc(S.error)}</div>
        <div class="footer-bar">
          <button class="btn ghost" type="button" id="back">Back</button>
          <button class="btn accent" type="submit" id="confirm" ${S.saving||S.mode==="loading"?"disabled":""}>${S.saving ? "Booking…" : S.mode==="loading" ? "Checking times…" : "Confirm booking"}</button>
        </div>
      </form>`;
    const sync = () => { f.name = $("#fName").value; f.phone = $("#fPhone").value; f.email = $("#fEmail").value; f.notes = $("#fNotes").value; };
    ["#fName","#fPhone","#fEmail","#fNotes"].forEach(id => $(id).addEventListener("input", sync));
    $("#chgTime").onclick = () => { sync(); S.step = 2; S.error=""; render(); };
    $("#back").onclick = () => { sync(); S.step = 2; S.error=""; render(); };
    $("#f").addEventListener("submit", e => { e.preventDefault(); sync(); confirmBooking(); });
  }
}
function renderMine(){
  const app = $("#app");
  const today = ymd(new Date());
  const upcoming = S.mine.filter(a => a.date >= today).sort((a,b) => (a.date+a.start).localeCompare(b.date+b.start));
  app.innerHTML = `${modeBanner()}
    <div class="label">Upcoming visits</div>
    ${upcoming.length ? upcoming.map(a => `
      <div class="appt">
        <div><span class="pill ${a.service==="new"?"new":"ret"}">${SERVICES[a.service].dur} min</span>
          <b style="margin-top:6px">${fmtDate(a.date)}</b><small>${fmt12(a.start)} · ${SERVICES[a.service].name}</small></div>
        <button type="button" class="danger" data-cancel="${a.id}">Cancel</button>
      </div>`).join("") : `<div class="empty">No upcoming visits yet.</div>`}
    <div class="err" id="err" role="alert">${esc(S.error)}</div>
    <div class="spacer"></div>
    <button class="btn primary" type="button" id="bookNew">Book a visit</button>`;
  $("#bookNew").onclick = () => { reset(); setTab("book"); };
  app.querySelectorAll("[data-cancel]").forEach(b => {
    let armed = false;
    b.onclick = () => {
      if (!armed) { armed = true; b.textContent = "Tap to confirm"; setTimeout(() => { armed = false; if (b.isConnected) b.textContent = "Cancel"; }, 4000); return; }
      cancelBooking(S.me, b.dataset.cancel);
    };
  });
}
async function confirmBooking(){
  const f = S.form, v = SERVICES[S.svc];
  if (!f.name.trim()) { S.error = "Add your name so we know who's coming."; return render(); }
  if (f.phone.replace(/\D/g,"").length < 10) { S.error = "Add a phone number with area code, in case we need to reach you."; return render(); }
  if (f.email && !/^\S+@\S+\.\S+$/.test(f.email)) { S.error = "That email doesn't look right. Fix it or leave it blank."; return render(); }
  if (!slotsFor(S.date, v.dur).some(s => s.slots.includes(S.time))) {
    S.error = "Someone just took that time. Pick another one."; S.step = 2; S.time = null; return render();
  }
  const appt = {id: uid(), service: S.svc, dur: v.dur, date: S.date, start: S.time,
    name: f.name.trim(), phone: f.phone.trim(), email: f.email.trim(), notes: f.notes.trim(), created: new Date().toISOString()};
  S.error = ""; S.saving = true; render();
  if (S.mode === "preview") {
    S.mine = [...S.mine, appt];
    S.busy[S.me] = S.mine.map(a => ({id:a.id,date:a.date,start:a.start,dur:a.dur}));
    S.allAppts[S.me] = S.mine;
  } else {
    const prev = S.mine;
    S.mine = [...S.mine, appt];
    try { await writeMine(); }
    catch (e) { S.mine = prev; S.saving = false; S.error = "We couldn't save your booking. Check your connection and try again."; return render(); }
  }
  S.saving = false; S.lastBooked = appt; S.step = 4; render();
}
async function cancelBooking(ownerId, id){
  S.error = "";
  if (S.mode === "preview") {
    S.mine = S.mine.filter(a => a.id !== id);
    S.busy[S.me] = S.mine.map(a => ({id:a.id,date:a.date,start:a.start,dur:a.dur}));
    S.allAppts[S.me] = S.mine;
    return render();
  }
  try {
    if (ownerId === S.me) { S.mine = S.mine.filter(a => a.id !== id); await writeMine(); }
    else {
      const items = (S.allAppts[ownerId]||[]).filter(a => a.id !== id);
      await db.doc("appts/"+ownerId).set({items});
      await db.doc("busy/"+ownerId).set({items: items.map(a => ({id:a.id,date:a.date,start:a.start,dur:a.dur}))});
    }
  } catch(e) { S.error = "That cancellation didn't go through. Try again."; }
  render();
}
function renderHours(){
  const todayDow = new Date().getDay();
  $("#hoursTable").innerHTML = [1,2,3,4,5,6,0].map(i => `<tr class="${i===todayDow?"today":""}"><td>${DOW_LONG[i]}</td><td>${(HOURS[i]||[]).length ? HOURS[i].map(([o,c]) => fmt12(o)+" – "+fmt12(c)).join(", ") : "Closed"}</td></tr>`).join("");
}
function renderNextOpen(){
  const el = $("#nextOpen");
  if (S.mode === "loading") { el.textContent = "Checking the next open time…"; return; }
  const n = firstOpen(15);
  el.textContent = n ? "Next open: " + (n.day === ymd(new Date()) ? "Today" : fmtDate(n.day)) + ", " + fmt12(n.time) : "Fully booked for the next 3 weeks";
}
function render(){
  $("#tabBook").setAttribute("aria-selected", S.tab==="book");
  $("#tabMine").setAttribute("aria-selected", S.tab==="mine");
  const today = ymd(new Date());
  const n = S.mine.filter(a => a.date >= today).length;
  $("#mineCount").textContent = n ? "("+n+")" : "";
  if (S.tab === "book") renderBook(); else renderMine();
  renderNextOpen();
  document.querySelectorAll(".admin-link").forEach(l => l.hidden = !canAdmin());
}
function setTab(t){ S.tab = t; S.error = ""; render(); }
function reset(){ S.step = 1; S.svc = null; S.date = null; S.time = null; S.error = ""; S.lastBooked = null; S.form.notes = ""; }
function pickService(key){ S.svc = key; S.step = 2; S.time = null; S.tab = "book"; S.error = ""; render(); }

/* ===== Wire up ===== */
document.querySelectorAll("[data-pick]").forEach(b => b.addEventListener("click", () => {
  pickService(b.dataset.pick);
  document.getElementById("book").scrollIntoView({behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth"});
}));
$("#tabBook").onclick = () => setTab("book");
$("#tabMine").onclick = () => setTab("mine");
$("#yr").textContent = new Date().getFullYear();
renderHours();
render();
connect();
