/* Front desk portal. Needs core.js first. */
const A = { filter: "upcoming", q: "", built: false, editing: null, flashT: null };
function buildAdmin(){
  $("#adminBody").innerHTML = `
    <div id="adminBanner"></div>
    <div class="admin-head">
      <div><h1>Appointments</h1><p id="adminToday"></p></div>
    </div>
    <div class="tiles" id="adminTiles"></div>
    <div class="toolbar">
      <div class="seg" role="group" aria-label="Show">
        <button type="button" data-f="today">Today</button>
        <button type="button" data-f="week">Next 7 days</button>
        <button type="button" data-f="upcoming">All upcoming</button>
        <button type="button" data-f="past">Past</button>
      </div>
      <input class="search" id="adminSearch" type="search" placeholder="Search name, phone or email" aria-label="Search appointments">
    </div>
    <div id="adminList"></div>`;
  $("#adminBody").querySelectorAll("[data-f]").forEach(b => b.onclick = () => { A.filter = b.dataset.f; renderAdmin(); });
  $("#adminSearch").addEventListener("input", e => { A.q = e.target.value; renderAdmin(); });
  A.built = true;
}
function renderAdmin(){
  if (S.mode === "live" && !S.isAdmin) {
    A.built = false;
    $("#adminBody").innerHTML = `<div class="gate"><h1>Office only</h1><p>This page is for Dr. Eddins and his staff. If you're a patient, you can book or change a visit on the booking site.</p><a class="btn primary" href="index.html">Go to booking</a></div>`;
    return;
  }
  if (S.mode === "loading") {
    A.built = false;
    $("#adminBody").innerHTML = `<div class="gate"><p>Loading appointments…</p></div>`;
    return;
  }
  if (!A.built) buildAdmin();
  $("#adminBanner").innerHTML = S.mode === "preview" ? `<div class="banner" style="margin-bottom:18px">Preview with example appointments. Changes here aren't saved. Open the published page while signed in as the owner to see real bookings.</div>` : "";
  $("#adminBody").querySelectorAll("[data-f]").forEach(b => b.setAttribute("aria-pressed", b.dataset.f === A.filter));

  const today = ymd(new Date()), wk = addDays(today, 7);
  const rows = allRows();
  const up = rows.filter(r => r.date >= today);
  const todays = rows.filter(r => r.date === today);
  const week = up.filter(r => r.date < wk);
  const nowHM = toHM(new Date().getHours()*60 + new Date().getMinutes());
  const next = up.find(r => r.date > today || r.start >= nowHM);
  $("#adminToday").textContent = fmtDate(today);
  $("#adminTiles").innerHTML = `
    <div class="tile"><small>Today</small><b>${todays.length}</b><span>${todays.reduce((m,r)=>m+r.dur,0)} min booked</span></div>
    <div class="tile"><small>Next 7 days</small><b>${week.length}</b><span>visits</span></div>
    <div class="tile"><small>New patients</small><b>${week.filter(r=>r.service==="new").length}</b><span>in the next 7 days</span></div>
    <div class="tile next"><small>Next up</small><b>${next ? esc(next.name) : "Nobody yet"}</b><span>${next ? (next.date===today?"Today":fmtDate(next.date))+", "+fmt12(next.start) : "No upcoming visits"}</span></div>`;

  let list = A.filter === "today" ? todays : A.filter === "week" ? week : A.filter === "past" ? rows.filter(r => r.date < today).reverse() : up;
  const q = A.q.trim().toLowerCase();
  if (q) { const qd = q.replace(/\D/g,""); list = list.filter(r => r.name.toLowerCase().includes(q) || (r.email||"").toLowerCase().includes(q) || (qd && r.phone.replace(/\D/g,"").includes(qd))); }

  if (!list.length) {
    $("#adminList").innerHTML = `<div class="empty">${q ? "No appointments match “"+esc(A.q)+"”." : A.filter==="today" ? "No visits booked for today." : A.filter==="past" ? "No past visits yet." : "No upcoming visits booked yet. New bookings show up here as they come in."}</div>`;
    return;
  }
  const byDay = {};
  list.forEach(r => (byDay[r.date] ||= []).push(r));
  $("#adminList").innerHTML = Object.entries(byDay).map(([d, items]) => `
    <div class="desk-day"><h3>${d===today?"Today · ":""}${fmtDate(d)} <span style="color:var(--mute);font-size:18px">· ${items.length} visit${items.length>1?"s":""}</span></h3>
      <div class="desk-list">${items.map(a => `
        <div class="desk-row ${d<today?"past":""}">
          <div class="t">${fmt12(a.start).replace(/ (AM|PM)/,"")}<small>${fmt12(a.start).slice(-2)} · ${a.dur} min</small></div>
          <div class="d"><b>${esc(a.name)}</b><span class="pill ${a.service==="new"?"new":"ret"}">${a.service==="new"?"New patient":"Returning"}</span>
            <div>${esc(a.phone)}${a.email?" · "+esc(a.email):""}</div>
            ${a.notes?`<div>“${esc(a.notes)}”</div>`:""}</div>
          ${d<today ? "" : `<div class="acts">
            <button type="button" class="edit-btn" data-edit="${esc(a.owner)}|${esc(a.id)}">Edit</button>
            <button type="button" class="danger" data-owner="${esc(a.owner)}" data-id="${esc(a.id)}">Cancel</button></div>`}
        </div>`).join("")}</div></div>`).join("");
  $("#adminList").querySelectorAll("[data-edit]").forEach(b => b.onclick = () => { const [o,i] = b.dataset.edit.split("|"); openEdit(o, i); });
  $("#adminList").querySelectorAll("[data-id]").forEach(b => {
    let armed = false;
    b.onclick = async () => {
      if (!armed) { armed = true; b.textContent = "Tap to confirm"; setTimeout(() => { armed = false; if (b.isConnected) b.textContent = "Cancel"; }, 4000); return; }
      const a = (S.allAppts[b.dataset.owner]||[]).find(x => x.id === b.dataset.id);
      const ok = await adminWrite(b.dataset.owner, (S.allAppts[b.dataset.owner]||[]).filter(x => x.id !== b.dataset.id));
      showFlash(ok ? "Cancelled " + (a ? a.name + "'s visit" : "the visit") : "That cancellation didn't go through. Try again.");
    };
  });
}
function openEdit(owner, id){
  const a = (S.allAppts[owner]||[]).find(x => x.id === id);
  if (!a) return;
  A.editing = {owner, id, draft: {...a}, err: ""};
  renderEdit();
}
function closeEdit(){ A.editing = null; $("#modalRoot").innerHTML = ""; }
function renderEdit(){
  const E = A.editing; if (!E) return;
  const d = E.draft, today = ymd(new Date());
  const dur = SERVICES[d.service].dur;
  const open = (HOURS[parseYmd(d.date).getDay()]||[]).length;
  const times = slotsFor(d.date, dur, E.id, 0).flatMap(s => s.slots);
  if (!times.includes(d.start)) d.start = times[0] || "";
  $("#modalRoot").innerHTML = `
    <div class="overlay" id="ov">
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="edTitle">
        <h2 id="edTitle">Edit visit</h2>
        <div class="sub">Booked ${E.draft.created ? new Date(E.draft.created).toLocaleDateString() : ""} · Changes show up right away on the booking site.</div>
        <div class="field"><label>Visit type</label>
          <div class="seg wide" role="group" aria-label="Visit type">
            <button type="button" data-s="ret" aria-pressed="${d.service==="ret"}">Adjustment · 15 min</button>
            <button type="button" data-s="new" aria-pressed="${d.service==="new"}">New patient · 30 min</button>
          </div></div>
        <div class="row2">
          <div class="field"><label for="edDate">Date</label><input id="edDate" type="date" min="${today}" value="${d.date}"></div>
          <div class="field"><label for="edTime">Time</label>
            <select id="edTime" ${times.length?"":"disabled"}>${times.length ? times.map(t => `<option value="${t}" ${t===d.start?"selected":""}>${fmt12(t)}</option>`).join("") : `<option>${open ? "No open times" : "Office closed"}</option>`}</select></div>
        </div>
        <div class="field"><label for="edName">Patient name</label><input id="edName" value="${esc(d.name)}"></div>
        <div class="row2">
          <div class="field"><label for="edPhone">Phone</label><input id="edPhone" type="tel" value="${esc(d.phone)}"></div>
          <div class="field"><label for="edEmail">Email</label><input id="edEmail" type="email" value="${esc(d.email)}"></div>
        </div>
        <div class="field"><label for="edNotes">Notes</label><textarea id="edNotes">${esc(d.notes)}</textarea></div>
        <div class="err" role="alert">${esc(E.err)}</div>
        <div class="footer-bar">
          <button class="btn ghost" type="button" id="edClose">Discard changes</button>
          <button class="btn accent" type="button" id="edSave" ${times.length?"":"disabled"}>Save changes</button>
        </div>
      </div>
    </div>`;
  const sync = () => { d.name = $("#edName").value; d.phone = $("#edPhone").value; d.email = $("#edEmail").value; d.notes = $("#edNotes").value; if (!$("#edTime").disabled) d.start = $("#edTime").value; };
  $("#modalRoot").querySelectorAll("[data-s]").forEach(b => b.onclick = () => { sync(); d.service = b.dataset.s; d.dur = SERVICES[d.service].dur; E.err = ""; renderEdit(); });
  $("#edDate").onchange = e => { sync(); if (e.target.value) d.date = e.target.value; E.err = ""; renderEdit(); };
  $("#edClose").onclick = closeEdit;
  $("#ov").onclick = e => { if (e.target.id === "ov") closeEdit(); };
  $("#ov").onkeydown = e => { if (e.key === "Escape") closeEdit(); };
  $("#edSave").onclick = async () => {
    sync();
    if (!d.name.trim()) { E.err = "Add the patient's name."; return renderEdit(); }
    if (d.phone.replace(/\D/g,"").length < 10) { E.err = "Add a phone number with area code."; return renderEdit(); }
    if (!slotsFor(d.date, SERVICES[d.service].dur, E.id, 0).some(s => s.slots.includes(d.start))) { E.err = "That time was just taken. Pick another."; return renderEdit(); }
    const updated = {...d, dur: SERVICES[d.service].dur, name: d.name.trim(), phone: d.phone.trim(), email: d.email.trim(), notes: d.notes.trim(), edited: new Date().toISOString()};
    $("#edSave").disabled = true; $("#edSave").textContent = "Saving…";
    const ok = await adminWrite(E.owner, (S.allAppts[E.owner]||[]).map(x => x.id === E.id ? updated : x));
    if (!ok) { E.err = "Couldn't save. Check your connection and try again."; return renderEdit(); }
    closeEdit();
    showFlash("Saved " + updated.name + " · " + fmtDate(updated.date) + ", " + fmt12(updated.start));
  };
  $("#edName").focus();
}
function render(){ renderAdmin(); }
render();
connect();
