function getRoot() {
    return document.querySelector(".calendar-page") 
        || document;
}

// static/js/calendar.js
(function(){
  const DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday"]; // Mon-Fri to match mock
  const START_HOUR = 8; // 8 AM
  const END_HOUR = 19;  // 7 PM end boundary (last slot starts 6:30 PM)

  let state = {
    room: null,
    weekStart: null, // Date object for Monday
    bookings: [],
    selection: null, // { dateISO, startIdx, endIdx }
  };

  // Room dropdown variables
  let roomDataMap = new Map(); // map: room name/id -> full room data from DB

  // Helper function to extract digits from room name
  function extractDigits(str) {
    if (!str) return null;
    const m = String(str).match(/(\d{2,4})/); // match 2-4 digit room numbers
    return m ? m[1] : null;
  }

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
  
  // Check if a cell (date + time index) is in the past
  function isCellInPast(dateISO, idx){
    const now = new Date();
    const cellDate = parseISODate(dateISO);
    const cellMinutes = idxToMinutes(idx);
    
    // Set the cell's date and time
    const cellDateTime = new Date(cellDate);
    cellDateTime.setHours(Math.floor(cellMinutes / 60), cellMinutes % 60, 0, 0);
    
    // Compare with current time
    return cellDateTime < now;
  }

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
    // Build half-hour indexes from START_HOUR up to (but not including) END_HOUR as end time.
    // Example: START_HOUR=8, END_HOUR=19 -> (19-8)*2 = 22 slots, last start = 18:30
    const slots = (END_HOUR - START_HOUR) * 2;
    return Array.from({length: slots}, (_,i)=>i);
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
        
        // Mark past cells as disabled
        if(isCellInPast(dateISO, idx)){
          cell.classList.add('past');
          cell.style.cursor = 'not-allowed';
        } else {
          cell.addEventListener('click', onCellClick);
        }
        
        grid.appendChild(cell);
      }
    });


    applyBookingsToGrid();
    applySelectionToGrid();
    // Room label hint
    const labelEl = dom('#calendarRoomLabel');
    if(labelEl) labelEl.textContent = state.room ? `Showing availability for ${state.room}` : 'Select a room';
    scheduleSyncHeights();
  }

  function clearGridClasses(){
    dom('#calendarGrid').querySelectorAll('.cell').forEach(c=>{
      c.classList.remove('booked','selected','in-range');
      c.title = '';
      // Note: 'past' class is not removed here as it's based on current time
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

    // Clear old artifacts
    grid.querySelectorAll('.event').forEach(e => e.remove());
    grid.querySelectorAll('.booked-label').forEach(e => e.remove());

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
  const eIdx = Math.min((END_HOUR - START_HOUR) * 2, Math.ceil((eMin - startMin)/30));

        // Mark underlying cells as booked for interaction/hover
        for(let i=sIdx;i<eIdx;i++){
          const cell = cellMap[`${b.date}-${i}`];
          if(cell){ cell.classList.add('booked'); }
        }

        // Show purpose in the first booked cell only (no spanning block)
        const firstCell = cellMap[`${b.date}-${sIdx}`];
        if(firstCell){
          const label = createEl('div','booked-label');
          label.textContent = b.purpose || 'Booked';
          firstCell.appendChild(label);
        }
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
    if(cell.classList.contains('past')) return; // Prevent clicking on past times
    const dateISO = cell.dataset.date;
    const idx = Number(cell.dataset.idx);

    // If extending selection, stop before a booked cell or past time
    const clampEnd = (start, end) => {
      const grid = dom('#calendarGrid');
      for(let i=start; i<end; i++){
        const c = grid.querySelector(`.cell[data-date="${dateISO}"][data-idx="${i}"]`);
        if(c && (c.classList.contains('booked') || c.classList.contains('past'))) return i; // stop here
      }
      return end;
    };

    if(!state.selection){
      // Only allow selection if the start time is not in the past
      if(!isCellInPast(dateISO, idx)){
        state.selection = { dateISO, startIdx: idx, endIdx: idx+1 };
      }
    } else if(state.selection.dateISO === dateISO) {
      if(idx < state.selection.startIdx){
        // Only allow moving start earlier if it's not in the past
        if(!isCellInPast(dateISO, idx)){
          state.selection = { dateISO, startIdx: idx, endIdx: idx+1 };
        }
      } else {
        const desired = Math.max(idx+1, state.selection.startIdx+1);
        state.selection.endIdx = clampEnd(state.selection.startIdx+1, desired);
      }
    } else {
      // Only allow selection if the start time is not in the past
      if(!isCellInPast(dateISO, idx)){
        state.selection = { dateISO, startIdx: idx, endIdx: idx+1 };
      }
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
      if(c && !c.classList.contains('booked') && !c.classList.contains('past')){
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
    scheduleSyncHeights();
  }

  function changeWeek(deltaDays){
    state.weekStart.setDate(state.weekStart.getDate()+deltaDays);
    const picker = dom('#weekPicker');
    if(picker) picker.value = toISODate(state.weekStart);
    state.selection = null;
    update();
  }

  function jumpToTodayWeek(){
    const now = new Date();
    state.weekStart = computeWeekStart(now);
    const picker = dom('#weekPicker');
    if(picker) picker.value = toISODate(state.weekStart);
    state.selection = null;
    update();
  }

  function bindControls(){
    const prev = dom('#prevWeek');
    const next = dom('#nextWeek');
    const todayBtn = dom('#todayWeek');
    const picker = dom('#weekPicker');
    if(prev) prev.addEventListener('click', ()=>changeWeek(-7));
    if(next) next.addEventListener('click', ()=>changeWeek(7));
    if(todayBtn) todayBtn.addEventListener('click', jumpToTodayWeek);
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

  // Helper function to update room description
  function setRoomDescription(roomName) {
    const root = getRoot();
    const roomNameEl = root.querySelector('#roomDescriptionRoom');
    const roomTextEl = root.querySelector('#roomDescriptionText');
    if (!roomTextEl) return; // Only require roomTextEl
    
    if (roomNameEl) {
      roomNameEl.textContent = roomName || 'Select Room';
    }
    
    // Try to find room data by name or by extracted digits
    let roomData = null;
    const digits = extractDigits(roomName);
    
    // First try to find by exact room name
    if (roomDataMap.has(roomName)) {
      roomData = roomDataMap.get(roomName);
    } else if (digits) {
      // Try to find by matching digits in room names
      for (const [key, data] of roomDataMap.entries()) {
        const keyDigits = extractDigits(key);
        if (keyDigits === digits) {
          roomData = data;
          break;
        }
      }
    }
    
    // Get room_description from room data
    if (roomData) {
      const description = roomData.room_description;
      if (description) {
        // Handle array of descriptions
        if (Array.isArray(description)) {
          if (description.length === 0) {
            roomTextEl.textContent = 'No description available.';
          } else {
            // Multiple descriptions: display as bullet list or comma-separated
            roomTextEl.innerHTML = description.map(desc => `• ${String(desc)}`).join('<br>');
          }
        } else {
          roomTextEl.textContent = String(description);
        }
      } else {
        roomTextEl.textContent = 'No description available.';
      }
    } else {
      roomTextEl.textContent = 'Description coming soon.';
    }

    // Update photo display
    // Always reveal the card
    showRoomPhotoCard();

    // Load a photo if digits exist
    if (digits) {
        setRoomPhotoByDigits(digits);
    } else {
        // No digits = still show card but no image
        const img = getRoot().querySelector('#roomPhoto');
        if (img) img.style.display = 'none';
    }
  }

  // ==============================
  //   Room photo display helpers
  // ==============================
function setRoomPhotoByDigits(digits) {
    const img = getRoot().querySelector('#roomPhoto');
    if (!img || !digits) return;

    const url = `/static/room_images/${digits}.JPG`;

    // Always show the card immediately
    showRoomPhotoCard();

    // Set image
    img.onload = () => {
        img.onerror = null;
        img.style.display = 'block';
    };
    img.onerror = () => {
        img.style.display = 'none'; // hides broken image
    };

    img.src = url;
}


  function showRoomPhotoCard() {
      const root = getRoot();
      const card = root.querySelector('#roomDescCard');
      if (card) {
        card.style.display = 'block';
      } else {
        // Fallback: try document if root didn't find it
        const fallbackCard = document.querySelector('#roomDescCard');
        if (fallbackCard) {
          fallbackCard.style.display = 'block';
        }
      }
  }

  // Exposed helpers used by template
  window.calendar_setRoom = function(roomName){
    state.room = roomName;
    const labelEl = dom('#calendarRoomLabel');
    if(labelEl) labelEl.textContent = state.room ? `Showing availability for ${state.room}` : '';

    // Update room description widget
    setRoomDescription(roomName);

    state.selection = null;
    update();
  };

  // Calendar-scoped setters so we don't override Map behavior
  // Enforce: end >= start + 30 minutes; also clamp to available range (8:00–20:00)
  const CAL_START_MIN = START_HOUR * 60;     // 8:00 AM (matches START_HOUR)
  const CAL_END_MIN = END_HOUR * 60;        // 7:00 PM (19:00) - last valid end for calendar
  const CAL_STEP = 30;                       // minutes

  function clampToBounds(min){
    if(min < CAL_START_MIN) return CAL_START_MIN;
    if(min > CAL_END_MIN) return CAL_END_MIN;
    return min;
  }

  window.calendar_updateStartTime = function(label){
    const root = getRoot();
    const startEl = root.querySelector('#start_time_right');
    if(!startEl) return;
    
    // Set start to requested label
    startEl.textContent = label;

    let startMin = toMinutes(label);
    if(startMin == null) return;

    // If start is too late to allow 30 min, back it up to last valid (18:30 / 6:30 PM)
    const minEnd = startMin + CAL_STEP;
    if(minEnd > CAL_END_MIN){
      startMin = CAL_END_MIN - CAL_STEP; // 18:30
      const adjustedLabel = minutesToLabel(startMin);
      startEl.textContent = adjustedLabel;
      startMin = toMinutes(adjustedLabel);
    }

    // Ensure end >= start + 30 (always enforce minimum)
    // Use setTimeout to ensure DOM has updated
    setTimeout(() => {
      const endEl = root.querySelector('#end_time_right');
      if(endEl){
        const desiredEndMin = startMin + CAL_STEP;
        const desiredEnd = clampToBounds(desiredEndMin);
        const currentEndLabel = endEl.textContent.trim() || '';
        const currentEndMin = toMinutes(currentEndLabel);
        
        // Always update end time to be at least 30 minutes after start
        if(currentEndMin == null || currentEndMin < desiredEndMin){
          endEl.textContent = minutesToLabel(desiredEnd);
        }
      }
    }, 10);
  };

  window.calendar_updateEndTime = function(label){
    const root = getRoot();
    const endEl = root.querySelector('#end_time_right');
    if(!endEl) return;
    
    let endMin = toMinutes(label);
    if(endMin == null) return;

    // Read current start; if missing, assume earliest
    const startEl = root.querySelector('#start_time_right');
    const currentStartLabel = startEl ? startEl.textContent.trim() : minutesToLabel(CAL_START_MIN);
    let startMin = toMinutes(currentStartLabel);
    if(startMin == null) startMin = CAL_START_MIN;

    // If start too late to allow 30 mins, back it up
    if(startMin + CAL_STEP > CAL_END_MIN){
      startMin = CAL_END_MIN - CAL_STEP; // 18:30
      if(startEl) startEl.textContent = minutesToLabel(startMin);
    }

    // Enforce end >= start + 30 and within bounds
    const minEnd = startMin + CAL_STEP;
    if(endMin < minEnd) endMin = minEnd;
    if(endMin > CAL_END_MIN) endMin = CAL_END_MIN;

    endEl.textContent = minutesToLabel(endMin);
  };

  // Set form to full-day (8:00 AM – 7:00 PM) and, if possible, select the full column in the week grid.
  // If there are existing bookings for the selected room/date that overlap this range, show an error instead.
  window.calendar_setFullDay = async function(){
    const root = getRoot();

    // Make sure we have the latest bookings before checking for conflicts
    if (!Array.isArray(state.bookings) || state.bookings.length === 0) {
      try {
        await fetchBookings();
      } catch (e) {
        console.warn('[calendar_setFullDay] Failed to refresh bookings before full-day check:', e);
      }
    }
    const startEl = root.querySelector('#start_time_right');
    const endEl = root.querySelector('#end_time_right');
    const dateInput = root.querySelector('#date_right');
    if(!startEl || !endEl || !dateInput || !dateInput.value) return;

    const dateISO = dateInput.value;
    const roomName = state.room;

    // Only run conflict check when a room is selected and we have bookings loaded
    if(roomName && Array.isArray(state.bookings) && state.bookings.length){
      const roomDigits = extractDigits(roomName);
      const fullStart = CAL_START_MIN;
      const fullEnd = CAL_END_MIN;

      const hasConflict = state.bookings.some(b => {
        if(!b || !b.date || b.date !== dateISO) return false;
        const bookingRoomId = (b.roomId || b.room || '').toString();
        if(!bookingRoomId) return false;

        // Match by exact id/name or by digits inside the name
        let roomMatches = false;
        if(roomDigits){
          const bookingDigits = extractDigits(bookingRoomId);
          roomMatches = (bookingDigits === roomDigits) || (bookingRoomId === roomName);
        } else {
          roomMatches = (bookingRoomId === roomName);
        }
        if(!roomMatches) return false;

        const range = (b.timeRange || '').toString();
        const parts = range.split(' - ');
        if(parts.length !== 2) return false;
        const sLabel = parts[0].trim();
        const eLabel = parts[1].trim();
        if(!sLabel || !eLabel) return false;

        const sMin = toMinutes(sLabel);
        const eMin = toMinutes(eLabel);
        if(sMin == null || eMin == null) return false;

        // Overlap check: [fullStart, fullEnd) vs [sMin, eMin)
        return fullStart < eMin && sMin < fullEnd;
      });

      if(hasConflict){
        const msg = 'Cannot book entire day for this room: there are existing bookings on that date that would conflict. Please choose a smaller time range. If you want more details on the booking conflict, look at the All Bookings tab.';
        if (typeof window.showBookingErrorModal === 'function') {
          window.showBookingErrorModal(msg);
        } else {
          alert(msg);
        }
        return;
      }
    }

    const startLabel = minutesToLabel(CAL_START_MIN);
    const endLabel = minutesToLabel(CAL_END_MIN);
    startEl.textContent = startLabel;
    endEl.textContent = endLabel;

    // Try to mirror this as a selection in the grid for the chosen date, if it’s in the current week
    if(state.weekStart){
      const d = parseISODate(dateISO);
      if(!isNaN(d)){
        const diffDays = Math.floor((d - state.weekStart) / (1000*60*60*24));
        if(diffDays >= 0 && diffDays < DAYS.length){
          const slots = (END_HOUR - START_HOUR) * 2; // same as buildTimeIndexes
          state.selection = {
            dateISO,
            startIdx: 0,
            endIdx: slots
          };
          applySelectionToGrid();
        }
      }
    }
  };

  function initMinDate(){
    const today = new Date();
    const iso = toISODate(today);
    const dateRight = getRoot().querySelector('#date_right');
    if(dateRight){ dateRight.setAttribute('min', iso); if(!dateRight.value) dateRight.value = iso; }
  }

  // Make the room description widget fill the remaining height of the left column
  function syncHeights(){
    const root = getRoot();
    const calCard = root.querySelector('#weekCalendarCard');
    const bookingCard = root.querySelector('.booking-widget');
    const descCard = root.querySelector('#roomDescCard');
    if(!calCard || !bookingCard || !descCard) return;
    const calH = calCard.getBoundingClientRect().height;
    const bookH = bookingCard.getBoundingClientRect().height;
    const mt = parseFloat(getComputedStyle(descCard).marginTop || '0') || 0;
    const target = Math.max(0, calH - bookH - mt);
  }
  function scheduleSyncHeights(){
    if(typeof requestAnimationFrame === 'function') requestAnimationFrame(syncHeights);
    else setTimeout(syncHeights, 0);
  }

  async function loadRoomsAndPopulateDropdown() {
    // Load from API (DB)
    let displayRooms = [];
    try {
      const resp = await fetch('/api/rooms');
      const data = await resp.json();
      const rooms = (data.rooms || []);
      rooms.forEach(r => {
        const display = (r.name || r.id || '').toString().trim();
        if (!display) return;
        
        // Store full room data in map
        roomDataMap.set(display, r);
        // Also store by ID if different from name
        if (r.id && r.id !== display) {
          roomDataMap.set(r.id, r);
        }
        
        displayRooms.push(display);
      });
    } catch (e) {
      console.warn('Failed to load rooms from /api/rooms; no rooms will be interactive.', e);
    }

    // Populate dropdown from DB names
    const bookableRooms = Array.from(new Set(displayRooms)).sort();
    const root = getRoot();
    const menu = root.querySelector('#roomDropdownMenu');
    if (menu) {
      menu.innerHTML = '';
      bookableRooms.forEach(roomName => {
        const li = document.createElement('li');
        const a = document.createElement('a');
        a.className = 'dropdown-item';
        a.href = '#';
        a.textContent = roomName;
        a.addEventListener('click', (e) => {
          e.preventDefault();
          const labelEl = root.querySelector('#selectedRoom');
          if (labelEl) labelEl.textContent = roomName;
          
          // Update calendar with selected room
          window.calendar_setRoom(roomName);
        });
        li.appendChild(a);
        menu.appendChild(li);
      });
    }
  }

  async function init(){
    // Load rooms and populate dropdown
    await loadRoomsAndPopulateDropdown();

    // Initial room from label
    const roomLabel = getRoot().querySelector('#selectedRoom');
    state.room = roomLabel && roomLabel.textContent.trim() !== 'Select Room' 
      ? roomLabel.textContent.trim() 
      : null;

    // Seed description widget
    const root = getRoot();
    const roomNameEl = root.querySelector('#roomDescriptionRoom');
    const roomTextEl = root.querySelector('#roomDescriptionText');
    if(roomNameEl) roomNameEl.textContent = state.room || 'Select Room';
    if(roomTextEl) roomTextEl.textContent = 'Description coming soon.';

    // Set current week to Monday
    const now = new Date();
    state.weekStart = computeWeekStart(now);

    // Initialize controls
    bindControls();
    initMinDate();

    const picker = dom('#weekPicker');
    if(picker) picker.value = toISODate(state.weekStart);

    await update();
    scheduleSyncHeights();
    window.addEventListener('resize', scheduleSyncHeights);
    
    // Initialize time filter to disable past times
    if (typeof window.initTimeFilter === 'function') {
      const root = getRoot();
      if (root) {
        setTimeout(() => window.initTimeFilter(root), 200);
      }
    }

    // After calendar UI is ready, try autofilling the booking email if the user is logged in.
    // Use a timeout so this still works even though bookings.js (which defines
    // window.autofillBookingEmailIfEmpty) loads after calendar.js.
    setTimeout(() => {
      if (typeof window.autofillBookingEmailIfEmpty === 'function') {
        window.autofillBookingEmailIfEmpty();
      }
    }, 250);
  }

  // Expose a safe refresh helper for booking flows (Map / Calendar tabs)
  window.refreshCalendarBookings = async function() {
    // Only refresh if the calendar grid is present and initialized
    if (!document.getElementById('calendarGrid') || !state.weekStart) {
      return;
    }
    await update();
  };

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
