// static/js/allbookings.js
// Multi-room weekly calendar grid for admin/faculty All Bookings view

(function(){
  const DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday"]; // Mon-Fri
  const START_HOUR = 8; // 8 AM
  const END_HOUR = 19;  // 7 PM end boundary (last slot starts 6:30 PM)

  // Role + login state (resolved from /auth/session, with template values as a fallback).
  let userRole = 'student';
  let isAdmin = false;
  let isFaculty = false;
  let isStudent = true;
  let isLoggedIn = false;

  async function resolveRoleFromSession(){
    // If we have already resolved a non-default role, skip extra work.
    if (userRole !== 'student' || isLoggedIn) return userRole;

    try {
      const res = await fetch('/auth/session', { credentials: 'include' });
      const data = await res.json().catch(() => null);
      if (res.ok && data && data.session) {
        const sessionRoleRaw = data.session.role || 'student';
        const normalized = String(sessionRoleRaw).trim().toLowerCase();
        userRole = normalized || 'student';
        isAdmin = userRole === 'admin';
        isFaculty = userRole === 'faculty';
        isStudent = userRole === 'student';
        isLoggedIn = true;
        return userRole;
      }
    } catch (err) {
      console.warn('[allbookings] Failed to resolve role from /auth/session', err);
    }

    // Fallback: use any template-injected values if present.
    if (typeof window.currentUserRole === 'string') {
      const normalized = window.currentUserRole.trim().toLowerCase();
      userRole = normalized || 'student';
      isAdmin = userRole === 'admin';
      isFaculty = userRole === 'faculty';
      isStudent = userRole === 'student';
    }
    if (typeof window.isLoggedIn === 'boolean') {
      isLoggedIn = window.isLoggedIn;
    } else if (typeof window.isLoggedIn === 'string') {
      isLoggedIn = window.isLoggedIn.toLowerCase() === 'true';
    }
    return userRole;
  }

  let state = {
    weekStart: null, // Date object for Monday of visible week
    bookings: [],    // all bookings from /api/bookings
  };

  // Lookup for booked cells -> bookings (used for click handling)
  let cellBookingLookup = {};
  
  // Closure date ranges cache
  let closureRanges = [];
  
  // Function to load closure date ranges
  async function loadClosureDates() {
    try {
      const resp = await fetch("/api/closures");
      if (!resp.ok) {
        console.warn("Failed to load closures for all bookings");
        return;
      }
      const data = await resp.json();
      const closures = data.closures || [];
      closureRanges = [];
      closures.forEach(closure => {
        // Support both new format (startDate/endDate) and old format (date) for backwards compatibility
        if (closure.startDate && closure.endDate) {
          closureRanges.push({
            start: closure.startDate,
            end: closure.endDate
          });
        } else if (closure.date) {
          // Backwards compatibility: treat single date as a range of one day
          closureRanges.push({
            start: closure.date,
            end: closure.date
          });
        }
      });
    } catch (err) {
      console.error("Error loading closures for all bookings:", err);
    }
  }
  
  // Function to check if a date is a weekend
  function isWeekend(dateISO) {
    if (!dateISO) return false;
    const date = new Date(dateISO + 'T00:00:00');
    const dayOfWeek = date.getDay();
    return dayOfWeek === 0 || dayOfWeek === 6; // Sunday = 0, Saturday = 6
  }
  
  // Function to check if a date falls within any closure range
  function isClosureDate(dateISO) {
    if (!dateISO) return false;
    return closureRanges.some(range => {
      return dateISO >= range.start && dateISO <= range.end;
    });
  }
  
  // Function to check if a date is invalid (weekend or closure)
  function isInvalidDate(dateISO) {
    return isWeekend(dateISO) || isClosureDate(dateISO);
  }

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
    // Build half-hour indexes dynamically from START_HOUR to END_HOUR
    const slots = (END_HOUR - START_HOUR) * 2; // e.g., 8->19 gives 22 slots (last start 18:30)
    return Array.from({length: slots}, (_,i)=>i);
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
        
        // Mark invalid dates (weekends or closures) as closed
        if(isInvalidDate(dateISO)){
          cell.classList.add('closed');
          cell.style.cursor = 'not-allowed';
        }
        
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

  function rangesOverlapMinutes(s1, e1, s2, e2){
    // Mirror backend logic: overlap when start1 < end2 AND start2 < end1
    return s1 < e2 && s2 < e1;
  }

  function hasOverlapForEdit(bookingId, roomId, date, startLabel, endLabel){
    if(!roomId || !date || !startLabel || !endLabel) return null;
    const newStartMin = toMinutes(startLabel);
    const newEndMin = toMinutes(endLabel);
    if(newEndMin <= newStartMin) return { conflictRange: null, type: 'invalid_range' };

    const bookings = state.bookings || [];
    for(const b of bookings){
      if(!b || !b.date || !b.timeRange) continue;
      if(b.id === bookingId) continue; // skip the booking being edited
      if((b.roomId || '') !== roomId) continue;
      if(b.date !== date) continue;

      const rng = (b.timeRange || '').trim();
      if(!rng || !rng.includes(' - ')) continue;
      const [s,e] = rng.split(' - ').map(x => x.trim());
      if(!s || !e) continue;

      const existStart = toMinutes(s);
      const existEnd = toMinutes(e);
      if(rangesOverlapMinutes(newStartMin, newEndMin, existStart, existEnd)){
        return { conflictRange: rng, type: 'overlap' };
      }
    }
    return null;
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
    const eIdx = Math.min((END_HOUR - START_HOUR) * 2, Math.ceil((eMin - startMin)/30));

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

        if (startersSorted.length === 1) {
          const b = startersSorted[0];
          const room = b.roomId || b.roomName || 'Room';

          if (isStudent) {
            // Students/unauthenticated: show only the room identifier, no purpose or names.
            const line = createEl('div','booked-label');
            line.textContent = room;
            wrapper.appendChild(line);
          } else {
            // Faculty/admin: single booking starting in this slot: show room + purpose.
            const purpose = b.purpose || 'Booked';
            const line = createEl('div','booked-label');
            line.textContent = `${room}: ${purpose}`;
            wrapper.appendChild(line);
          }
        } else {
          // Two or more bookings starting here: concise multi-booking label.
          const line = createEl('div','booked-label');
          line.style.whiteSpace = "pre-line";
          line.textContent = "Multiple room bookings\nClick for details";
          wrapper.appendChild(line);
        }

        cell.appendChild(wrapper);
      }

      if (isStudent) {
        // Students/unauthenticated: only room is shown in the cell, no identifying details in tooltip.
        // Keep tooltip minimal to avoid leaking purpose or user identity.
        const first = bookings[0];
        const room = first && (first.roomId || first.roomName);
        cell.title = room ? String(room) : '';
      } else {
        // Tooltip lists all bookings for this cell for faculty/admin.
        const tooltipLines = bookings.map(b => {
          const r = b.roomId || b.roomName || 'Room';
          const p = b.purpose || 'Booked';
          const rng = b.timeRange || '';
          return `${r} – ${p}${rng ? ' ('+rng+')' : ''}`;
        });
        cell.title = tooltipLines.join('\n');
      }
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

  // Configure the role-specific instructions card on the left side.
  // You can edit the messages for each role here.
  function configureAllBookingsInfoPanel(infoPanel){
    if (!infoPanel) return;

    const titleEl = infoPanel.querySelector('#allBookingsInfoTitle');
    const bodyEl  = infoPanel.querySelector('#allBookingsInfoBody');
    const listEl  = infoPanel.querySelector('#allBookingsInfoList');
    if (!titleEl || !bodyEl || !listEl) return;

    infoPanel.classList.remove('d-none');
    listEl.innerHTML = '';

    const mkItem = (text) => {
      const li = document.createElement('li');
      li.className = 'mb-1';
      li.textContent = text;
      return li;
    };

    if (isStudent) {
      // STUDENT / UNAUTHENTICATED VIEW
      titleEl.textContent = 'All Bookings';
      if (isLoggedIn) {
        bodyEl.textContent =
          'This page shows all room reservations for the current week. Use the arrows above the calendar to switch between weeks and browse reservations for the current, past, or upcoming weeks.';
      } else {
        bodyEl.textContent =
          'This page shows all room reservations for the current week. Use the arrows above the calendar to switch between weeks and browse reservations for the current, past, or upcoming weeks.';
      }

      if (isLoggedIn) {
        listEl.appendChild(mkItem('Use the Map or Calendar tabs to find an available time and create a booking. Some bookings will require admin approval'));
        listEl.appendChild(mkItem('Use the My Bookings tab to review, modify, or delete your own reservations'));
      } else {
        listEl.appendChild(mkItem('If you want to create a booking, you must have a registered account and sign in with the registered uoregon.edu email'));
        listEl.appendChild(mkItem('After successfully logging in, use the Map or Calendar tabs to create bookings and My Bookings to manage them'));
      }

    } else if (isFaculty) {
      // FACULTY VIEW
      titleEl.textContent = 'All Bookings (Faculty View)';
      bodyEl.textContent =
          'This page shows all room reservations for the current week. Use the arrows above the calendar to switch between weeks and browse reservations for the current, past, or upcoming weeks.';
      listEl.appendChild(mkItem('Click a gray cell with a label to view details for that booking which populates the Booking Details card below'));
      listEl.appendChild(mkItem('To change or cancel your own reservations, use the My Bookings tab'));
    } else if (isAdmin) {
      // ADMIN VIEW
      titleEl.textContent = 'All Bookings (Admin View)';
      bodyEl.textContent =
          'This page shows all room reservations for the current week. Use the arrows above the calendar to switch between weeks and browse reservations for the current, past, or upcoming weeks.';
      listEl.appendChild(mkItem('Click a gray cell with a label to view details for that booking which populates the Booking Details card below'));    
      listEl.appendChild(mkItem('To edit or remove a booking, update the information in the Booking Details panel, then click Save or Delete')); 
    } else {
      // Fallback for unexpected roles
      titleEl.textContent = 'All Bookings Overview';
      bodyEl.textContent = 'This tab shows all room reservations for the week.';
      listEl.appendChild(mkItem('Browse bookings in the calendar on the right.'));
    }
  }

  async function update(){
    await loadClosureDates(); // Load closures before rendering
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
    const repeatDropdown = root.querySelector('#repeatDropdown');
    const repeatNotesIcon = root.querySelector('#repeatNotesIcon');
    const emailInput   = root.querySelector('#allBookingEmail');
    const nameInput   = root.querySelector('#allBookingName');
    const purposeInput = root.querySelector('#allBookingPurpose');
    const hint         = root.querySelector('#allBookingHint');

    if(idInput)      idInput.value = '';
    if(dateInput)    dateInput.value = '';
    if(roomSelect)   roomSelect.value = '';
    if(startSel)     startSel.value = '';
    if(endSel)       endSel.value = '';
    if(repeatDropdown) {
      repeatDropdown.textContent = 'Never';
      repeatDropdown.dataset.repeatType = 'Never';
    }
    if (repeatNotesIcon) repeatNotesIcon.classList.add('d-none');
    if(emailInput)   emailInput.value = '';
    if(nameInput)    nameInput.value = '';
    if(purposeInput) purposeInput.value = '';
    if(hint) {
      if (isAdmin) {
        hint.textContent = 'Select a booking in the calendar to view or edit details.';
      } else if (isFaculty) {
        hint.textContent = 'Faculty can view any reservation here. To change your own, use the My Bookings tab.';
      } else {
        hint.textContent = '';
      }
    }
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

    // Adjust modal copy based on role
    const titleEl = modalEl.querySelector('#allBookingsChooserLabel');
    const blurbEl = modalEl.querySelector('.modal-body p');
    if (isStudent) {
      if (titleEl) titleEl.textContent = 'Rooms booked in this time slot';
      if (blurbEl) blurbEl.textContent = 'These rooms are booked during this time. You cannot view or edit reservation details.';
    } else {
      if (titleEl) titleEl.textContent = 'Multiple bookings in this time slot';
      if (blurbEl) blurbEl.textContent = 'Select a booking below to view or edit its details.';
    }

    bookings.forEach(b => {
      const room = b.roomId || b.roomName || 'Room';
      const purpose = b.purpose || 'Booked';
      const rng = b.timeRange || '';

      // Students/unauth: show only room (plus optional time), no purpose or names.
      const labelText = isStudent
        ? `${room}${rng ? ' ('+rng+')' : ''}`
        : `${room}: ${purpose}${rng ? ' ('+rng+')' : ''}`;

      const item = createEl('button','list-group-item list-group-item-action');
      item.type = 'button';
      item.textContent = labelText;

      // Only faculty/admin can drill into an individual booking record.
      if (!isStudent) {
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
      }

      list.appendChild(item);
    });

    // Show the modal using Bootstrap if available
    if(window.bootstrap && bootstrap.Modal){
      const modalInstance = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
      modalInstance.show();
    } else if (!isStudent) {
      // Fallback for non-students: open the first booking directly if we can't show a proper modal
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

      // Empty cell or no bookings: clear panel (for non-students this also clears the detail pane)
      if(!cell.classList.contains('booked') || !bookings || !bookings.length){
        clearBookingPanel();
        return;
      }

      // Student / unauthenticated view: show rooms for this slot only, no editing.
      if (isStudent) {
        openMultiBookingModal(bookings);
        return;
      }

      // Faculty/Admin: existing behavior
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
    const repeatDropdown = root.querySelector('#repeatDropdown');
    const repeatNotesIcon = root.querySelector('#repeatNotesIcon');
    const emailInput = root.querySelector('#allBookingEmail');
    const nameInput = root.querySelector('#allBookingName');
    const purposeInput = root.querySelector('#allBookingPurpose');

    if(idInput) idInput.value = booking.id || '';
    if(dateInput) {
      // Set minimum date to today (prevents selecting past dates)
      const today = new Date().toISOString().split('T')[0];
      dateInput.setAttribute('min', today);
      if(booking.date) {
        dateInput.value = booking.date;
      }
      // Initialize date prevention (weekends and closures)
      // This will also validate and correct the current value if needed
      if (typeof window.initWeekendPrevention === 'function') {
        const container = root;
        // Use setTimeout to ensure the value is set before validation
        setTimeout(async () => {
          await window.initWeekendPrevention(container);
        }, 0);
      }
    }
    if(repeatDropdown) {
      const repeatVal = booking.repeat || 'Never';
      repeatDropdown.textContent = repeatVal;
      let type = 'Never';
      if (repeatVal.startsWith('Daily')) type = 'Daily';
      else if (repeatVal.startsWith('Weekly')) type = 'Weekly';
      else if (repeatVal.startsWith('Monthly')) type = 'Monthly';
      else if (repeatVal && repeatVal !== 'Never') type = 'Custom';
      repeatDropdown.dataset.repeatType = type;
      if (type !== 'Never' && repeatNotesIcon) {
        repeatNotesIcon.classList.remove('d-none');
      } else if (repeatNotesIcon) {
        repeatNotesIcon.classList.add('d-none');
      }
    }
    if(emailInput) emailInput.value = booking.email || booking.userEmail || '';
    if(nameInput) nameInput.value = booking.name || booking.userId || '';
    if(purposeInput) purposeInput.value = booking.purpose || '';

    populateTimeSelects(startSel, endSel, booking.timeRange || '');
    populateRoomSelect(roomSelect, booking.roomId || '');

    const hint = root.querySelector('#allBookingHint');
    if (hint) {
      if (isAdmin) {
        hint.textContent = 'Editing booking ' + (booking.id || '');
      } else {
        hint.textContent = '';
      }
    }
  }

  function wirePanelActions(){
    const root = getRoot();
    const saveBtn = root.querySelector('#allSaveBookingBtn');
    const deleteBtn = root.querySelector('#allDeleteBookingBtn');

    // Only admins can modify bookings from the All Bookings view.
    if (!isAdmin) {
      if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.classList.add('disabled');
      }
      if (deleteBtn) {
        deleteBtn.disabled = true;
        deleteBtn.classList.add('disabled');
      }
      return;
    }

    if(saveBtn){
      saveBtn.addEventListener('click', async () => {
        const idInput = root.querySelector('#allBookingId');
        const dateInput = root.querySelector('#allBookingDate');
        const roomSelect = root.querySelector('#allBookingRoomId');
        const startSel = root.querySelector('#allBookingStartTime');
        const endSel = root.querySelector('#allBookingEndTime');
        const repeatDropdown = root.querySelector('#repeatDropdown');
        const emailInput = root.querySelector('#allBookingEmail');
        const nameInput = root.querySelector('#allBookingName');
        const purposeInput = root.querySelector('#allBookingPurpose');

        const bookingId = idInput ? idInput.value : '';
        if(!bookingId){
          alert('Missing booking id.');
          return;
        }

        const roomId = roomSelect ? roomSelect.value : '';
        const dateVal = dateInput ? dateInput.value : '';

        // Client-side validation: ensure end > start and no overlaps on All Bookings edits
        const overlapInfo = hasOverlapForEdit(
          bookingId,
          roomId,
          dateVal,
          startSel ? startSel.value : '',
          endSel ? endSel.value : ''
        );
        if (overlapInfo) {
          let msg = '';
          if (overlapInfo.type === 'invalid_range') {
            msg = 'End time must be after start time. Please adjust the start and end times so the booking has a positive duration.';
          } else if (overlapInfo.type === 'overlap') {
            const conflict = overlapInfo.conflictRange || 'that time';
            msg = `This change would overlap with an existing booking for ${conflict} on ${dateVal} in this room. Please choose a different time range or room.`;
          }
          if (window.showBookingErrorModal) {
            window.showBookingErrorModal(msg);
          } else {
            alert(msg);
          }
          return;
        }

        const timeRange = `${startSel.value} - ${endSel.value}`;

        const repeatText = repeatDropdown
          ? (repeatDropdown.textContent || 'Never').trim()
          : 'Never';

        const payload = {
          date: dateVal,
          timeRange,
          repeat: repeatText,
          name: nameInput ? nameInput.value.trim() : '',
          email: emailInput ? emailInput.value.trim() : '',
          purpose: purposeInput ? purposeInput.value.trim() : '',
          roomId
        };

        try{
          const res = await fetch(`/update_booking/${bookingId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          const data = await res.json();
          if(!res.ok || !data.success){
            const baseMsg = data && data.error ? data.error : res.statusText;
            const msg = `We couldnt save this booking. ${baseMsg || ''}`.trim();
            if (window.showBookingErrorModal) {
              window.showBookingErrorModal(msg);
            } else {
              alert(msg);
            }
            return;
          }
          // Success notification for admin users
          alert('Booking details were saved successfully.');
          // Refresh grid from Firestore
          await update();
        }catch(err){
          console.error('[allbookings] Save error', err);
          const msg = 'Failed to save booking due to a network or server error. Please try again.';
          if (window.showBookingErrorModal) {
            window.showBookingErrorModal(msg);
          } else {
            alert(msg);
          }
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
    // Ensure we know the current user's role before drawing role-specific UI.
    await resolveRoleFromSession();

    const now = new Date();
    state.weekStart = computeWeekStart(now);

    const root = getRoot();
    const picker = root.querySelector('#allWeekPicker');
    if(picker) picker.value = toISODate(state.weekStart);

    // Role-based UI adjustments for the side panel / info widget.
    const panel = root.querySelector('#allBookingPanel');
    const infoPanel = root.querySelector('#allBookingsInfoPanel');

    if (isStudent) {
      // Students/unauthenticated: hide the edit panel and show only the info card.
      if (panel) panel.classList.add('d-none');
      if (infoPanel) configureAllBookingsInfoPanel(infoPanel);
    } else {
      // Faculty/Admin: show both the info card (instructions) and the details panel.
      if (infoPanel) configureAllBookingsInfoPanel(infoPanel);
      if (panel) {
        panel.classList.remove('d-none');

        const titleEl = panel.querySelector('#allBookingPanelTitle');
        const facultyNote = panel.querySelector('#allBookingFacultyNote');
        const actionsRow = panel.querySelector('#allBookingActionsRow');

        if (isAdmin) {
          if (titleEl) titleEl.textContent = 'Booking Details';
          if (facultyNote) facultyNote.classList.add('d-none');
          if (actionsRow) actionsRow.classList.remove('d-none');
        } else if (isFaculty) {
          // Faculty: clearly indicate read-only and hide action buttons.
          if (titleEl) titleEl.textContent = 'Booking Details (Faculty View)';
          if (facultyNote) facultyNote.classList.remove('d-none');
          if (actionsRow) actionsRow.classList.add('d-none');

          const inputs = panel.querySelectorAll('#allBookingForm input, #allBookingForm select');
          inputs.forEach(el => {
            if (el.tagName === 'SELECT') {
              el.setAttribute('disabled', 'disabled');
            } else if (el.type !== 'hidden') {
              el.setAttribute('readonly', 'readonly');
            }
          });
        }
      }
    }

    bindControls();
    bindCellClickHandler();
    wirePanelActions();
    await update();
  }

  // Expose initializer for dynamic loader
  window.initAllBookings = initAllBookings;

})();
