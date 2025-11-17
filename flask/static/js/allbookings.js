// static/js/allbookings.js
// Multi-room weekly calendar grid for admin/faculty All Bookings view

(function(){
  const DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday"]; // Mon-Fri
  const START_HOUR = 8; // 8 AM
  const END_HOUR = 20;  // 8 PM end boundary (last slot ends 8:00 PM)
  const SLOT_COUNT = 24; // 24 half-hour slots from 8:00–7:30

  let state = {
    weekStart: null, // Date object for Monday of visible week
    bookings: [],    // all bookings from /api/bookings
  };

  // Lookup for booked cells -> bookings (used for click handling)
  let cellBookingLookup = {};

  function toISODate(d){ return d.toISOString().split('T')[0]; }
  function parseISODate(iso){ const [y,m,da]=iso.split('-').map(Number); return new Date(y,m-1,da); }

  function minutesToLabel(min){
    let h = Math.floor(min/60);
    const m = min%60;
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = ((h + 11) % 12) + 1; // 0->12
    const mm = m.toString().padStart(2,'0');
    return `${h}:${mm} ${ampm}`;
  }
  function idxToMinutes(idx){ return (START_HOUR*60) + (idx*30); }
  function labelForIdx(idx){ return minutesToLabel(idxToMinutes(idx)); }

  function computeWeekStart(date){
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const day = d.getDay(); // 0 Sun .. 6 Sat
    const diffToMon = (day === 0 ? -6 : 1 - day); // move to Monday
    d.setDate(d.getDate() + diffToMon);
    d.setHours(0,0,0,0);
    return d;
  }

  function buildTimeIndexes(){
    // We want labels from 8:00 AM through 8:00 PM.
    // There are 24 bookable half-hour slots (8:00–7:30), plus a final 8:00 PM label row.
    return Array.from({length: SLOT_COUNT + 1}, (_,i)=>i); // 0..24
  }

  function dom(sel, root){ return (root || document).querySelector(sel); }
  function createEl(tag, cls, text){ const el=document.createElement(tag); if(cls) el.className=cls; if(text!=null) el.textContent=text; return el; }

  function getRoot(){
    return document.getElementById('nav-allbookings')
        || document.getElementById('allbookings-tab-content')
        || document;
  }

  async function fetchBookings(){
    try{
      const res = await fetch('/api/bookings');
      const data = await res.json();
      state.bookings = data.bookings || [];
    }catch(err){
      console.warn('[allbookings] Failed to load bookings', err);
      state.bookings = [];
    }
  }

  function renderGrid(){
    const root = getRoot();
    const grid = root.querySelector('#allCalendarGrid');
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
        grid.appendChild(cell);
      }
    });

    applyBookingsToGrid();
    updateSummary();
  }

  function clearGridBookingClasses(){
    const root = getRoot();
    const grid = root.querySelector('#allCalendarGrid');
    if(!grid) return;
    grid.querySelectorAll('.cell').forEach(c=>{
      c.classList.remove('booked','overlap-2','overlap-3','overlap-4');
      c.title = '';
      const labels = c.querySelectorAll('.booked-label, .booked-label-list');
      labels.forEach(l => l.remove());
    });
    cellBookingLookup = {};
  }

  function toMinutes(label){
    // "8:30 AM" -> minutes from 00:00
    const [hm,ampm] = label.split(' ');
    let [h,m] = hm.split(':').map(Number);
    if(ampm === 'PM' && h !== 12) h += 12;
    if(ampm === 'AM' && h === 12) h = 0;
    return h*60 + m;
  }

  function applyBookingsToGrid(){
    const root = getRoot();
    const grid = root.querySelector('#allCalendarGrid');
    if(!grid || !state.weekStart) return;

    clearGridBookingClasses();

    if(!state.bookings || !state.bookings.length) return;

    const startMin = START_HOUR*60;

    // Map cells for easy marking
    const cellMap = {};
    grid.querySelectorAll('.cell').forEach(c => { cellMap[`${c.dataset.date}-${c.dataset.idx}`]=c; });

    // helper to compute day index
    const dayIndexForISO = (iso) => {
      const d = parseISODate(iso);
      const diff = Math.floor((d - state.weekStart)/(1000*60*60*24));
      return diff; // 0..6
    };

    const lookup = {};

    // Walk all bookings and mark cells
    state.bookings.forEach(b => {
      const dateISO = b.date;
      if(!dateISO) return;
      const di = dayIndexForISO(dateISO);
      if(di < 0 || di >= DAYS.length) return; // only visible days

      const range = (b.timeRange||'').trim();
      if(!range || !range.includes(' - ')) return;
      const [s,e] = range.split(' - ').map(s => s.trim());
      if(!s || !e) return;

      const sMin = toMinutes(s);
      const eMin = toMinutes(e);
      const sIdx = Math.max(0, Math.floor((sMin - startMin)/30));
      const eIdx = Math.min(SLOT_COUNT, Math.ceil((eMin - startMin)/30));

      // Remember span indexes so we can only label the first slot per booking
      b._sIdx = sIdx;
      b._eIdx = eIdx;

      for(let i=sIdx;i<eIdx;i++){
        const key = `${dateISO}-${i}`;
        const cell = cellMap[key];
        if(!cell) continue;
        cell.classList.add('booked');
        if(!lookup[key]) lookup[key] = [];
        lookup[key].push(b);
      }
    });

    // Build labels and tooltips per cell.
    // Show one line per room for bookings that start in this slot.
    const MAX_LINES = 3;

    Object.keys(lookup).forEach(key => {
      const cell = cellMap[key];
      if(!cell) return;
      const bookings = lookup[key];

      // Darker background for heavier overlaps
      const count = bookings.length;
      cell.classList.remove('overlap-2','overlap-3','overlap-4');
      if(count >= 2){
        const level = Math.min(count, 4); // 2,3,4+
        cell.classList.add(`overlap-${level}`);
      }

      // Extract time index from key (YYYY-MM-DD-idx)
      const parts = key.split('-');
      const idx = Number(parts[parts.length - 1]);

      // Bookings whose first slot is this cell
      const starters = bookings.filter(b => typeof b._sIdx === 'number' && b._sIdx === idx);
      if(starters.length){
        // Sort by room so multi-room slots are organized
        const startersSorted = [...starters].sort((a,b) => {
          const ar = (a.roomName || a.roomId || '').toString();
          const br = (b.roomName || b.roomId || '').toString();
          return ar.localeCompare(br, undefined, {numeric:true, sensitivity:'base'});
        });

        const wrapper = createEl('div','booked-label-list');

        if(startersSorted.length === 1){
          // Single booking starting in this slot: show room + purpose
          const b = startersSorted[0];
          const room = b.roomId || b.roomName || 'Room';
          const purpose = b.purpose || 'Booked';
          const line = createEl('div','booked-label');
          line.textContent = `${room}: ${purpose}`;
          wrapper.appendChild(line);
        } else {
          // Multiple bookings starting here: show a concise message
          const count = startersSorted.length;
          const line = createEl('div','booked-label');
          line.textContent = `${count} bookings – click to choose`;
          wrapper.appendChild(line);
        }

        cell.appendChild(wrapper);
      }

      // Tooltip always lists all bookings for this cell
      const tooltipLines = bookings.map(b => {
        const r = b.roomId || b.roomName || 'Room';
        const p = b.purpose || 'Booked';
        const rng = b.timeRange || '';
        return `${r} – ${p}${rng ? ' ('+rng+')' : ''}`;
      });
      cell.title = tooltipLines.join('\n');
    });

    cellBookingLookup = lookup;
  }

  function updateSummary(){
    const root = getRoot();
    const labelEl = root.querySelector('#allCalendarSummary');
    if(!labelEl || !state.weekStart) return;

    const weekStart = new Date(state.weekStart);
    const weekEnd = new Date(state.weekStart);
    weekEnd.setDate(weekEnd.getDate() + (DAYS.length-1));

    const startStr = weekStart.toLocaleDateString(undefined,{month:'short',day:'numeric'});
    const endStr = weekEnd.toLocaleDateString(undefined,{month:'short',day:'numeric'});

    // Count bookings in this week
    const bookingsThisWeek = (state.bookings || []).filter(b => {
      if(!b.date) return false;
      const d = parseISODate(b.date);
      return d >= weekStart && d <= weekEnd;
    });

    labelEl.textContent = `${bookingsThisWeek.length} bookings from ${startStr}–${endStr}`;
  }

  async function update(){
    await fetchBookings();
    renderGrid();
  }

  // Clear the side panel to a neutral state
  function clearBookingPanel(){
    const root = getRoot();
    const idInput      = root.querySelector('#allBookingId');
    const dateInput    = root.querySelector('#allBookingDate');
    const roomSelect   = root.querySelector('#allBookingRoomId');
    const startSel     = root.querySelector('#allBookingStartTime');
    const endSel       = root.querySelector('#allBookingEndTime');
    const repeatSel    = root.querySelector('#allBookingRepeat');
    const emailInput   = root.querySelector('#allBookingEmail');
    const purposeInput = root.querySelector('#allBookingPurpose');
    const hint         = root.querySelector('#allBookingHint');

    if(idInput)      idInput.value = '';
    if(dateInput)    dateInput.value = '';
    if(roomSelect)   roomSelect.value = '';
    if(startSel)     startSel.value = '';
    if(endSel)       endSel.value = '';
    if(repeatSel)    repeatSel.value = 'Never';
    if(emailInput)   emailInput.value = '';
    if(purposeInput) purposeInput.value = '';
    if(hint)         hint.textContent = 'Select a booking in the calendar to view or edit details.';
  }

  // Modal-based chooser for multi-booking cells
  function openMultiBookingModal(bookings){
    // Ensure modal is a direct child of <body> so it appears above the backdrop
    let modalEl = document.getElementById('allBookingsChooserModal');
    if(!modalEl) return;
    if(modalEl.parentElement !== document.body){
      document.body.appendChild(modalEl);
    }

    const list = modalEl.querySelector('#allBookingsChooserList');
    if(!list) return;

    list.innerHTML = '';

    bookings.forEach(b => {
      const room = b.roomId || b.roomName || 'Room';
      const purpose = b.purpose || 'Booked';
      const rng = b.timeRange || '';
      const labelText = `${room}: ${purpose}${rng ? ' ('+rng+')' : ''}`;

      const item = createEl('button','list-group-item list-group-item-action');
      item.type = 'button';
      item.textContent = labelText;
      item.addEventListener('click', () => {
        openBookingPanel(b);
        if(window.bootstrap && bootstrap.Modal){
          const modalInstance = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
          modalInstance.hide();
        } else {
          // Basic hide fallback if Bootstrap JS is unavailable
          modalEl.classList.remove('show');
          modalEl.style.display = 'none';
          modalEl.setAttribute('aria-hidden','true');
        }
      });
      list.appendChild(item);
    });

    // Show the modal using Bootstrap if available
    if(window.bootstrap && bootstrap.Modal){
      const modalInstance = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
      modalInstance.show();
    } else {
      // Fallback: open the first booking directly if we can't show a proper modal
      if(bookings.length === 1){
        openBookingPanel(bookings[0]);
      }
    }
  }

  // Click handler for cells (opens booking or chooser)
  function bindCellClickHandler(){
    const root = getRoot();
    const grid = root.querySelector('#allCalendarGrid');
    if(!grid) return;
    if(grid.dataset.allBookingsClickBound === 'true') return;
    grid.dataset.allBookingsClickBound = 'true';

    grid.addEventListener('click', (e) => {
      const cell = e.target.closest('.cell');
      if(!cell) return;

      const key = `${cell.dataset.date}-${cell.dataset.idx}`;
      const bookings = cellBookingLookup[key];

      // Empty cell or no bookings: clear panel
      if(!cell.classList.contains('booked') || !bookings || !bookings.length){
        clearBookingPanel();
        return;
      }

      // Single booking: open directly in side panel
      if(bookings.length === 1){
        openBookingPanel(bookings[0]);
        return;
      }

      // Multiple bookings: open modal chooser
      openMultiBookingModal(bookings);
    });
  }

  // ==============================
  //   Edit / Delete side panel helpers
  // ==============================
  let roomsCache = null;

  async function ensureRoomsLoaded(){
    if(roomsCache) return roomsCache;
    try{
      const res = await fetch('/api/rooms');
      const data = await res.json();
      roomsCache = data.rooms || [];
    }catch(err){
      console.warn('[allbookings] Failed to load rooms for modal', err);
      roomsCache = [];
    }
    return roomsCache;
  }

  function buildTimeSlots(){
    const slots = [];
    for(let h = START_HOUR; h <= END_HOUR; h++){
      for(let m = 0; m < 60; m += 30){
        // Skip 8:30 PM so the latest selectable time is exactly 8:00 PM
        if (h === END_HOUR && m === 30) continue;
        let hour = h > 12 ? h - 12 : h;
        const ampm = h < 12 ? 'AM' : 'PM';
        const mm = m === 0 ? '00' : '30';
        slots.push(`${hour}:${mm} ${ampm}`);
      }
    }
    return slots;
  }

  function populateTimeSelects(startEl, endEl, range){
    if(!startEl || !endEl) return;
    const slots = buildTimeSlots();
    startEl.innerHTML = '';
    endEl.innerHTML = '';
    slots.forEach(s => {
      const o1 = document.createElement('option');
      o1.value = s; o1.textContent = s; startEl.appendChild(o1);
      const o2 = document.createElement('option');
      o2.value = s; o2.textContent = s; endEl.appendChild(o2.cloneNode(true));
    });

    let startVal = slots[0], endVal = slots[1];
    if(range && range.includes(' - ')){
      const [s,e] = range.split(' - ');
      if(slots.includes(s.trim())) startVal = s.trim();
      if(slots.includes(e.trim())) endVal = e.trim();
    }
    startEl.value = startVal;
    endEl.value = endVal;
  }

  async function populateRoomSelect(selectEl, currentRoomId){
    if(!selectEl) return;
    const rooms = await ensureRoomsLoaded();
    selectEl.innerHTML = '';
    rooms.forEach(r => {
      const opt = document.createElement('option');
      opt.value = r.id;
      opt.textContent = r.name || r.id;
      selectEl.appendChild(opt);
    });
    if(currentRoomId){
      selectEl.value = currentRoomId;
    }
  }

  function openBookingPanel(booking){
    const root = getRoot();

    const idInput = root.querySelector('#allBookingId');
    const dateInput = root.querySelector('#allBookingDate');
    const roomSelect = root.querySelector('#allBookingRoomId');
    const startSel = root.querySelector('#allBookingStartTime');
    const endSel = root.querySelector('#allBookingEndTime');
    const repeatSel = root.querySelector('#allBookingRepeat');
    const emailInput = root.querySelector('#allBookingEmail');
    const purposeInput = root.querySelector('#allBookingPurpose');

    if(idInput) idInput.value = booking.id || '';
    if(dateInput && booking.date) dateInput.value = booking.date;
    if(repeatSel) repeatSel.value = booking.repeat || 'Never';
    if(emailInput) emailInput.value = booking.email || booking.userEmail || '';
    if(purposeInput) purposeInput.value = booking.purpose || '';

    populateTimeSelects(startSel, endSel, booking.timeRange || '');
    populateRoomSelect(roomSelect, booking.roomId || '');

    const hint = root.querySelector('#allBookingHint');
    if(hint) hint.textContent = 'Editing booking ' + (booking.id || '');
  }

  function wirePanelActions(){
    const root = getRoot();
    const saveBtn = root.querySelector('#allSaveBookingBtn');
    const deleteBtn = root.querySelector('#allDeleteBookingBtn');

    if(saveBtn){
      saveBtn.addEventListener('click', async () => {
        const idInput = root.querySelector('#allBookingId');
        const dateInput = root.querySelector('#allBookingDate');
        const roomSelect = root.querySelector('#allBookingRoomId');
        const startSel = root.querySelector('#allBookingStartTime');
        const endSel = root.querySelector('#allBookingEndTime');
        const repeatSel = root.querySelector('#allBookingRepeat');
        const emailInput = root.querySelector('#allBookingEmail');
        const purposeInput = root.querySelector('#allBookingPurpose');

        const bookingId = idInput ? idInput.value : '';
        if(!bookingId){
          alert('Missing booking id.');
          return;
        }

        const timeRange = `${startSel.value} - ${endSel.value}`;

        const payload = {
          date: dateInput ? dateInput.value : '',
          timeRange,
          repeat: repeatSel ? repeatSel.value : 'Never',
          email: emailInput ? emailInput.value.trim() : '',
          purpose: purposeInput ? purposeInput.value.trim() : '',
          roomId: roomSelect ? roomSelect.value : ''
        };

        try{
          const res = await fetch(`/update_booking/${bookingId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          const data = await res.json();
          if(!res.ok || !data.success){
            alert('Failed to save booking: ' + (data.error || res.statusText));
            return;
          }
          // Refresh grid from Firestore
          await update();
        }catch(err){
          console.error('[allbookings] Save error', err);
          alert('Failed to save booking.');
        }
      });
    }

    if(deleteBtn){
      deleteBtn.addEventListener('click', async () => {
        const idInput = root.querySelector('#allBookingId');
        const bookingId = idInput ? idInput.value : '';
        if(!bookingId){
          alert('Missing booking id.');
          return;
        }
        if(!confirm('Are you sure you want to delete this booking?')) return;
        try{
          const res = await fetch(`/delete_booking/${bookingId}`, { method: 'DELETE' });
          const data = await res.json();
          if(!res.ok || !data.success){
            alert('Failed to delete booking: ' + (data.error || res.statusText));
            return;
          }
          await update();
        }catch(err){
          console.error('[allbookings] Delete error', err);
          alert('Failed to delete booking.');
        }
      });
    }
  }

  function changeWeek(deltaDays){
    state.weekStart.setDate(state.weekStart.getDate()+deltaDays);
    const root = getRoot();
    const picker = root.querySelector('#allWeekPicker');
    if(picker) picker.value = toISODate(state.weekStart);
    renderGrid();
  }

  function jumpToTodayWeek(){
    const now = new Date();
    state.weekStart = computeWeekStart(now);
    const root = getRoot();
    const picker = root.querySelector('#allWeekPicker');
    if(picker) picker.value = toISODate(state.weekStart);
    renderGrid();
  }

  function bindControls(){
    const root = getRoot();
    const prev = root.querySelector('#allPrevWeek');
    const next = root.querySelector('#allNextWeek');
    const todayBtn = root.querySelector('#allTodayWeek');
    const picker = root.querySelector('#allWeekPicker');
    if(prev) prev.addEventListener('click', ()=>changeWeek(-7));
    if(next) next.addEventListener('click', ()=>changeWeek(7));
    if(todayBtn) todayBtn.addEventListener('click', jumpToTodayWeek);
    if(picker){
      picker.addEventListener('change', ()=>{
        if(!picker.value) return;
        const d = parseISODate(picker.value);
        state.weekStart = computeWeekStart(d);
        picker.value = toISODate(state.weekStart);
        renderGrid();
      });
    }
  }

  async function initAllBookings(){
    const now = new Date();
    state.weekStart = computeWeekStart(now);

    const root = getRoot();
    const picker = root.querySelector('#allWeekPicker');
    if(picker) picker.value = toISODate(state.weekStart);

    bindControls();
    bindCellClickHandler();
    wirePanelActions();
    await update();
  }

  // Expose initializer for dynamic loader
  window.initAllBookings = initAllBookings;

})();
