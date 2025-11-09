// static/js/calendar.js
(function(){
  const DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday"]; // Mon-Fri to match mock
  const START_HOUR = 8; // 8 AM
  const END_HOUR = 20;  // 8 PM end boundary (last slot starts 7:30 PM)

  let state = {
    room: null,
    weekStart: null, // Date object for Monday
    bookings: [],
    selection: null, // { dateISO, startIdx, endIdx }
  };

  function toISODate(d){ return d.toISOString().split('T')[0]; }
  function parseISODate(iso){ const [y,m,da]=iso.split('-').map(Number); return new Date(y,m-1,da); }
  function minutesToLabel(min){
    // min is minutes from 00:00
    let h = Math.floor(min/60); let m = min%60;
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = ((h + 11) % 12) + 1; // 0->12
    const mm = m.toString().padStart(2,'0');
    return `${h}:${mm} ${ampm}`;
  }
  function idxToMinutes(idx){ return (START_HOUR*60) + (idx*30); }
  function labelForIdx(idx){ return minutesToLabel(idxToMinutes(idx)); }

  function computeWeekStart(date){
    // Get Monday for given date
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const day = d.getDay(); // 0 Sun .. 6 Sat
    const diffToMon = (day === 0 ? -6 : 1 - day); // move to Monday
    d.setDate(d.getDate() + diffToMon);
    d.setHours(0,0,0,0);
    return d;
  }

  function buildTimeIndexes(){
    // 8:00 -> 19:30 inclusive = 24 half-hours
    return Array.from({length: 24}, (_,i)=>i);
  }

  function dom(sel, root=document){ return root.querySelector(sel); }

  function createEl(tag, cls, text){ const el=document.createElement(tag); if(cls) el.className=cls; if(text!=null) el.textContent=text; return el; }

  function renderGrid(){
    const grid = dom('#calendarGrid');
    if(!grid) return;
    grid.innerHTML = '';

    // Header row: empty top-left
    const headerTime = createEl('div','header-time');
    grid.appendChild(headerTime);

    // Day headers Mon-Fri
    for(let i=0;i<DAYS.length;i++){
      const d = new Date(state.weekStart); d.setDate(d.getDate()+i);
      const head = createEl('div','day-header');
      const dateStr = d.toLocaleDateString(undefined,{month:'2-digit',day:'2-digit',year:'2-digit'});
      head.innerHTML = `${DAYS[i]} <span class="day-sub">${dateStr}</span>`;
      grid.appendChild(head);
    }

    // Rows
    const timeIdxs = buildTimeIndexes();
    timeIdxs.forEach(idx => {
      // time label column
      const label = createEl('div','time-label', labelForIdx(idx));
      grid.appendChild(label);
      // 5 day cells
      for(let di=0; di<DAYS.length; di++){
        const d = new Date(state.weekStart); d.setDate(d.getDate()+di);
        const dateISO = toISODate(d);
        const cell = createEl('div','cell');
        cell.dataset.date = dateISO;
        cell.dataset.idx = idx;
        if(di>0) cell.classList.add('day-divider');
        cell.addEventListener('click', onCellClick);
        grid.appendChild(cell);
      }
    });


    applyBookingsToGrid();
    applySelectionToGrid();
    // Room label hint
    const labelEl = dom('#calendarRoomLabel');
    if(labelEl) labelEl.textContent = state.room ? `Showing availability for ${state.room}` : 'Select a room';
  }

  function clearGridClasses(){
    dom('#calendarGrid').querySelectorAll('.cell').forEach(c=>{
      c.classList.remove('booked','selected','in-range');
      c.title = '';
    });
  }

  function applyBookingsToGrid(){
    if(!state.bookings || !state.bookings.length) return;
    const grid = dom('#calendarGrid');
    const startMin = START_HOUR*60;

    // Map cells for easy marking
    const cellMap = {};
    grid.querySelectorAll('.cell').forEach(c => { cellMap[`${c.dataset.date}-${c.dataset.idx}`]=c; });

    // Helper: compute day index for a date within current week
    const dayIndexForISO = (iso) => {
      const d = parseISODate(iso);
      const diff = Math.floor((d - state.weekStart)/(1000*60*60*24));
      return diff; // 0..6
    };

    // Clear old event blocks
    grid.querySelectorAll('.event').forEach(e => e.remove());

    state.bookings
      .filter(b => b.roomId === state.room)
      .filter(b => b.date)
      .forEach(b => {
        const di = dayIndexForISO(b.date);
        if(di < 0 || di > 6) return; // only this week
        const [s,e] = (b.timeRange||'').split(' - ').map(s => s.trim());
        if(!s || !e) return;
        const sMin = toMinutes(s);
        const eMin = toMinutes(e);
        const sIdx = Math.max(0, Math.floor((sMin - startMin)/30));
        const eIdx = Math.min(24, Math.ceil((eMin - startMin)/30));

        // Mark underlying cells as booked for interaction/hover
        for(let i=sIdx;i<eIdx;i++){
          const cell = cellMap[`${b.date}-${i}`];
          if(cell){ cell.classList.add('booked'); }
        }

        // Render a single event block spanning rows
        const colStart = 2 + di; // time column = 1, days start at 2
        const rowStart = 2 + sIdx; // header row = 1
        const rowEnd = 2 + eIdx;
        const event = createEl('div','event');
        event.style.gridColumn = `${colStart} / ${colStart+1}`;
        event.style.gridRow = `${rowStart} / ${rowEnd}`;
        event.innerHTML = `${b.purpose || 'Booked'}<span class=\"time\">${b.timeRange}</span>`;
        grid.appendChild(event);
      });
  }

  function toMinutes(label){
    // "8:30 AM" -> minutes from 00:00
    const [hm,ampm] = label.split(' ');
    let [h,m] = hm.split(':').map(Number);
    if(ampm === 'PM' && h !== 12) h += 12;
    if(ampm === 'AM' && h === 12) h = 0;
    return h*60 + m;
  }

  function onCellClick(e){
    const cell = e.currentTarget;
    if(cell.classList.contains('booked')) return;
    const dateISO = cell.dataset.date;
    const idx = Number(cell.dataset.idx);

    // If extending selection, stop before a booked cell
    const clampEnd = (start, end) => {
      const grid = dom('#calendarGrid');
      for(let i=start; i<end; i++){
        const c = grid.querySelector(`.cell[data-date="${dateISO}"][data-idx="${i}"]`);
        if(c && c.classList.contains('booked')) return i; // stop here
      }
      return end;
    };

    if(!state.selection){
      state.selection = { dateISO, startIdx: idx, endIdx: idx+1 };
    } else if(state.selection.dateISO === dateISO) {
      if(idx < state.selection.startIdx){
        state.selection = { dateISO, startIdx: idx, endIdx: idx+1 };
      } else {
        const desired = Math.max(idx+1, state.selection.startIdx+1);
        state.selection.endIdx = clampEnd(state.selection.startIdx+1, desired);
      }
    } else {
      state.selection = { dateISO, startIdx: idx, endIdx: idx+1 };
    }
    applySelectionToGrid();
    syncSelectionToForm();
  }

  function applySelectionToGrid(){
    clearGridClasses();
    applyBookingsToGrid();
    if(!state.selection) return;
    const {dateISO,startIdx,endIdx} = state.selection;
    const grid = dom('#calendarGrid');
    for(let i=startIdx;i<endIdx;i++){
      const c = grid.querySelector(`.cell[data-date="${dateISO}"][data-idx="${i}"]`);
      if(c && !c.classList.contains('booked')){
        c.classList.add('in-range');
        if(i===startIdx) c.classList.add('selected');
      }
    }
  }

  function syncSelectionToForm(){
    if(!state.selection) return;
    const {dateISO,startIdx,endIdx} = state.selection;
    const root = getRoot();
    const dateInput = root.querySelector('#date_right');
    const startBtn = root.querySelector('#start_time_right');
    const endBtn = root.querySelector('#end_time_right');
    if(dateInput) dateInput.value = dateISO;
    if(startBtn) startBtn.textContent = labelForIdx(startIdx);
    if(endBtn) endBtn.textContent = labelForIdx(endIdx);
  }

  async function fetchBookings(){
    try{
      const res = await fetch('/api/bookings');
      const data = await res.json();
      state.bookings = data.bookings || [];
    }catch(err){
      console.warn('Failed to load bookings', err);
      state.bookings = [];
    }
  }

  async function update(){
    await fetchBookings();
    renderGrid();
  }

  function changeWeek(deltaDays){
    state.weekStart.setDate(state.weekStart.getDate()+deltaDays);
    const picker = dom('#weekPicker');
    if(picker) picker.value = toISODate(state.weekStart);
    state.selection = null;
    update();
  }

  function bindControls(){
    const prev = dom('#prevWeek');
    const next = dom('#nextWeek');
    const picker = dom('#weekPicker');
    if(prev) prev.addEventListener('click', ()=>changeWeek(-7));
    if(next) next.addEventListener('click', ()=>changeWeek(7));
    if(picker){
      picker.addEventListener('change', ()=>{
        const d = parseISODate(picker.value);
        state.weekStart = computeWeekStart(d);
        picker.value = toISODate(state.weekStart);
        state.selection = null;
        update();
      });
    }
  }

  // Root scoping helper so we don't clash with Map tab elements
  function getRoot(){
    return document.querySelector('#nav-calendar') || document.querySelector('.calendar-page') || document;
  }

  // Exposed helpers used by template
  window.calendar_setRoom = function(roomName){
    state.room = roomName;
    const labelEl = dom('#calendarRoomLabel');
    if(labelEl) labelEl.textContent = state.room ? `Showing availability for ${state.room}` : '';
    state.selection = null;
    update();
  };

  // Calendar-scoped setters so we don't override Map behavior
  window.calendar_updateStartTime = function(label){
    const el = getRoot().querySelector('#start_time_right');
    if(el) el.textContent = label;
  };
  window.calendar_updateEndTime = function(label){
    const el = getRoot().querySelector('#end_time_right');
    if(el) el.textContent = label;
  };

  function initMinDate(){
    const today = new Date();
    const iso = toISODate(today);
    const dateRight = getRoot().querySelector('#date_right');
    if(dateRight){ dateRight.setAttribute('min', iso); if(!dateRight.value) dateRight.value = iso; }
  }

  async function init(){
    // Initial room from label
    const roomLabel = getRoot().querySelector('#selectedRoom');
    state.room = roomLabel ? roomLabel.textContent.trim() : null;

    // Set current week to Monday
    const now = new Date();
    state.weekStart = computeWeekStart(now);

    // Initialize controls
    bindControls();
    initMinDate();

    const picker = dom('#weekPicker');
    if(picker) picker.value = toISODate(state.weekStart);

    await update();
  }

  // Expose for dynamic loader
  window.initCalendar = init;

  // Auto-init if this HTML was loaded directly
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', ()=>{
      if(document.getElementById('calendarGrid')) init();
    });
  } else {
    if(document.getElementById('calendarGrid')) init();
  }
})();
