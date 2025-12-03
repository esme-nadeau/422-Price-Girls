// Helper: show a lightweight booking error dialog without blocking the whole page
window.showBookingErrorModal = function(message) {
    const body = document.getElementById('bookingErrorModalBody');
    const modalEl = document.getElementById('bookingErrorModal');

    if (body) {
        body.textContent = message;
    }

    if (modalEl) {
        // Manually show the dialog without using Bootstrap's backdrop logic
        modalEl.classList.add('show');
        modalEl.style.display = 'block';
        modalEl.removeAttribute('aria-hidden');
        modalEl.setAttribute('aria-modal', 'true');
        modalEl.setAttribute('role', 'dialog');

        // Ensure close buttons hide the dialog
        const closeButtons = modalEl.querySelectorAll('[data-bs-dismiss="modal"]');
        closeButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                modalEl.classList.remove('show');
                modalEl.style.display = 'none';
                modalEl.setAttribute('aria-hidden', 'true');
                modalEl.removeAttribute('aria-modal');
            }, { once: true });
        });
    } else {
        // Fallback if the dialog markup is not present on this page
        alert(message);
    }
};

// Fetch current session info (name/email) for booking autofill, if logged in
// NOTE: The name must come ONLY from Firestore (users collection -> sessions.name).
// We intentionally do NOT "fake" or derive a name from the email.
async function fetchSessionInfoForBooking() {
    try {
        const res = await fetch('/auth/session', { credentials: 'include' });
        const data = await res.json().catch(() => null);
        if (res.ok && data && data.session) {
            const email = data.session.email || '';
            const name = data.session.name || '';
            return { email, name };
        }
    } catch (err) {
        console.warn('Session autofill: failed to load session', err);
    }
    return { email: '', name: '' };
}

// Find a booking-related element (Map/Calendar) relative to a given button/tab
function findBookingElement(id, contextButton) {
    let container = null;

    if (contextButton) {
        container = contextButton.closest('.tab-pane');
    }
    if (!container) {
        container = document.querySelector('.tab-pane.show.active') ||
                    document.querySelector('#nav-map.show, #nav-calendar.show');
    }

    if (container) {
        const el = container.querySelector('#' + id);
        if (el) return el;
    }
    return document.getElementById(id);
}

// Autofill the email field with the logged-in session email if it is blank
async function autofillBookingEmailIfEmpty(contextButton) {
    const emailInput = findBookingElement('email', contextButton);
    if (!emailInput) return;
    if (emailInput.value && emailInput.value.trim() !== '') return;

    const session = await fetchSessionInfoForBooking();
    if (session.email) {
        emailInput.value = session.email;
    }
}

// Autofill the name field with the logged-in session name if it is blank
async function autofillBookingNameIfEmpty(contextButton) {
    const nameInput = findBookingElement('name', contextButton);
    if (!nameInput) return;
    if (nameInput.value && nameInput.value.trim() !== '') return;

    const session = await fetchSessionInfoForBooking();
    if (session.name) {
        nameInput.value = session.name;
    }
}

// Expose on window so Map/Calendar code can call it when the widget appears
window.autofillBookingEmailIfEmpty = autofillBookingEmailIfEmpty;
window.autofillBookingNameIfEmpty = autofillBookingNameIfEmpty;

// Function to initialize booking button - can be called after content loads
window.initBookingButton = function(containerId) {
    // Try to find button in specified container or active tab, then fall back to document
    let bookButton = null;
    let container = null;
    
    if (containerId) {
        container = document.getElementById(containerId);
    }
    
    if (!container) {
        // Try to find active tab (Bootstrap uses 'show active' classes)
        container = document.querySelector('.tab-pane.show.active') || 
                    document.querySelector('#nav-map.show, #nav-calendar.show, #nav-bookings.show');
    }
    
    if (container) {
        bookButton = container.querySelector('#bookRoomBtn');
    }
    
    if (!bookButton) {
        bookButton = document.getElementById('bookRoomBtn');
    }
    
    if (!bookButton) {
        console.warn('Book Room button not found');
        return;
    }
    
    // Check if button already has a listener (prevent duplicate initialization)
    if (bookButton.dataset.initialized === 'true') {
        console.log('Book button already initialized, skipping');
        return;
    }
    
    // Remove any existing listeners by cloning the button
    const newButton = bookButton.cloneNode(true);
    bookButton.parentNode.replaceChild(newButton, bookButton);
    newButton.dataset.initialized = 'true';
    
    newButton.addEventListener('click', async function(e) {
            e.preventDefault();

            // Require login before creating any booking (Map & Calendar views)
            async function checkLoggedIn() {
                // First, try the dedicated session endpoint
                try {
                    const res = await fetch('/auth/session', { credentials: 'include' });
                    const data = await res.json().catch(() => null);
                    if (res.ok && data && data.success && data.session) {
                        return true;
                    }
                } catch (err) {
                    console.warn('Login check via /auth/session failed', err);
                }

                // Fallback: use template-injected flag if available
                if (typeof window.isLoggedIn === 'boolean') {
                    return window.isLoggedIn;
                }
                if (typeof window.isLoggedIn === 'string') {
                    return window.isLoggedIn.toLowerCase() === 'true';
                }
                return false;
            }

            const loggedIn = await checkLoggedIn();
            if (!loggedIn) {
                const goLogin = window.confirm(
                    'You need to log in with your uoregon.edu email before making a reservation.\n\nClick OK to go to the login page.'
                );
                if (goLogin) {
                    window.location.href = '/login';
                }
                return;
            }

            // After confirming login, autofill email + name if we have them
            await autofillBookingEmailIfEmpty(newButton);
            if (typeof window.autofillBookingNameIfEmpty === 'function') {
                await window.autofillBookingNameIfEmpty(newButton);
            }
            
            // Get form values - try to find in the container that has the button
            const getElement = (id) => {
                const el = findBookingElement(id, newButton);
                return el || null;
            };
            
            const roomEl = getElement('selectedRoom');
            const dateEl = getElement('date_right');
            const startTimeEl = getElement('start_time_right');
            const endTimeEl = getElement('end_time_right');
            const repeatEl = getElement('repeatDropdown');
            const emailEl = getElement('email');
            const purposeEl = getElement('purpose');
            
            const room = roomEl ? roomEl.textContent.trim() : '';
            const date = dateEl ? dateEl.value : '';
            const startTime = startTimeEl ? startTimeEl.textContent.trim() : '';
            const endTime = endTimeEl ? endTimeEl.textContent.trim() : '';
            const timeRange = `${startTime} - ${endTime}`;
            const repeatType = (repeatEl && repeatEl.dataset && repeatEl.dataset.repeatType)
                ? repeatEl.dataset.repeatType
                : 'Never';
            const repeatLabel = repeatEl
                ? (repeatEl.textContent.trim() || repeatType)
                : repeatType;
            const nameEl = getElement('name');
            const name = nameEl ? nameEl.value.trim() : '';
            const email = emailEl ? emailEl.value.trim() : '';
            const purpose = purposeEl ? purposeEl.value.trim() : '';
            
            // Helper: convert label <-> minutes (use globals if present)
            const _labelToMinutes = (label) => {
                if (typeof window.labelToMinutes === 'function') return window.labelToMinutes(label);
                if (!label) return null;
                const m = String(label).trim().match(/^([0-9]{1,2}):(\d{2})\s*(AM|PM)$/i);
                if (!m) return null;
                let h = parseInt(m[1],10); const mm = parseInt(m[2],10); const am = m[3].toUpperCase();
                if (am === 'PM' && h !== 12) h += 12;
                if (am === 'AM' && h === 12) h = 0;
                return h*60 + mm;
            };
            const _minutesToLabel = (min) => {
                if (typeof window.minutesToLabel === 'function') return window.minutesToLabel(min);
                let h = Math.floor(min/60); const mm = min%60; const ampm = h >= 12 ? 'PM' : 'AM'; h = ((h + 11) % 12) + 1; const m2 = mm.toString().padStart(2,'0'); return `${h}:${m2} ${ampm}`;
            };

            // Find next available slot on the same date for this room.
            // This always uses the server (/api/bookings -> Firestore) as the
            // source of truth and clamps suggestions to the 8:00 AM–7:00 PM day.
            async function findNextAvailable(roomName, dateISO, desiredStartMin, durationMin){
                try{
                    const resp = await fetch('/api/bookings');
                    const data = await resp.json();
                    const all = data.bookings || [];
                    // Helper to compare room names by digits if available
                    const extractDigits = (s) => { if(!s) return null; const m=String(s).match(/(\d{2,4})/); return m?m[1]:null; };
                    const reqDigits = extractDigits(roomName);
                    // Collect intervals for this room on the date
                    const intervals = [];
                    for (const b of all){
                        if (!b || !b.date || !b.timeRange) continue;
                        if (b.date !== dateISO) continue;
                        const bookingRoom = b.roomId || b.room || '';
                        let match = false;
                        if (reqDigits){ const bd = extractDigits(bookingRoom); if (bd === reqDigits) match = true; }
                        if (!match && bookingRoom === roomName) match = true;
                        if (!match) continue;
                        const [s,e] = b.timeRange.split(' - ').map(x=>x && x.trim());
                        const sMin = _labelToMinutes(s); const eMin = _labelToMinutes(e);
                        if (sMin==null || eMin==null) continue;
                        intervals.push([sMin,eMin]);
                    }
                    // Day bounds: 8:00 AM inclusive up to 7:00 PM exclusive.
                    const DAY_START = 8*60;        // 8:00 AM
                    const DAY_END = 19*60;         // 7:00 PM end boundary (exclusive)

                    // Clamp desired start into the valid day window
                    if (desiredStartMin < DAY_START) desiredStartMin = DAY_START;
                    if (desiredStartMin >= DAY_END) return null; // no room left in the day

                    // Merge intervals
                    intervals.sort((a,b)=>a[0]-b[0]);
                    const merged = [];
                    for(const iv of intervals){
                        const seg = [Math.max(DAY_START, iv[0]), Math.min(DAY_END, iv[1])];
                        if (seg[0] >= seg[1]) continue; // fully outside day bounds
                        if(!merged.length) merged.push(seg);
                        else{
                            const last = merged[merged.length-1];
                            if(seg[0] <= last[1]) last[1] = Math.max(last[1], seg[1]);
                            else merged.push(seg);
                        }
                    }
                    // Build free windows within [DAY_START, DAY_END)
                    const free = [];
                    let cur = DAY_START;
                    for(const m of merged){
                        if(m[0] > cur) free.push([cur, m[0]]);
                        cur = Math.max(cur, m[1]);
                    }
                    if(cur < DAY_END) free.push([cur, DAY_END]);

                    // Find earliest window starting at or after desiredStartMin
                    // with enough duration, without exceeding DAY_END.
                    for(const w of free){
                        const startCandidate = Math.max(w[0], desiredStartMin);
                        const endCandidate = startCandidate + durationMin;
                        if(endCandidate <= w[1] && endCandidate <= DAY_END){
                            return {start: startCandidate, end: endCandidate};
                        }
                    }
                    return null;
                }catch(err){
                    console.warn('Failed to fetch bookings for suggestion', err);
                    return null;
                }
            }

            // Validate
            if (room === 'Select Room' || !room) {
                alert('Please select a room');
                return;
            }
            if (!date || !startTime || !endTime || !email || !purpose) {
                alert('Please fill in all required fields');
                return;
            }

            // Pre-check for overlap client-side and offer next-available suggestion
            const startMin = _labelToMinutes(startTime);
            const endMin = _labelToMinutes(endTime);
            const duration = endMin - startMin;
            if (startMin == null || endMin == null || duration <= 0){
                alert('Invalid start/end times');
                return;
            }
            // Use existing global check if available
            let conflict = false;
            if (typeof window.isRoomBooked === 'function'){
                // isRoomBooked expects roomId (may be room name) and strings
                conflict = window.isRoomBooked(room, date, startTime, endTime);
            } else {
                // fallback: fetch bookings and check overlap
                try{
                    const resp = await fetch('/api/bookings');
                    const data = await resp.json();
                    const all = data.bookings || [];
                    const extractDigits = (s) => { if(!s) return null; const m=String(s).match(/(\d{2,4})/); return m?m[1]:null; };
                    const reqDigits = extractDigits(room);
                    for(const b of all){
                        if (!b || !b.date || !b.timeRange) continue;
                        if (b.date !== date) continue;
                        const bookingRoom = b.roomId || b.room || '';
                        let match = false;
                        if (reqDigits){ const bd = extractDigits(bookingRoom); if (bd === reqDigits) match = true; }
                        if (!match && bookingRoom === room) match = true;
                        if (!match) continue;
                        const [s,e] = b.timeRange.split(' - ').map(x=>x && x.trim());
                        const sMin = _labelToMinutes(s); const eMin = _labelToMinutes(e);
                        if (sMin==null || eMin==null) continue;
                        if (startMin < eMin && sMin < endMin){ conflict = true; break; }
                    }
                }catch(err){ console.warn('Overlap check failed', err); }
            }

            if (conflict){
                const suggestion = await findNextAvailable(room, date, endMin, duration);
                if (suggestion){
                    const msg = `Requested time overlaps an existing booking. Next available slot of the same length is ${_minutesToLabel(suggestion.start)} - ${_minutesToLabel(suggestion.end)}.\n\nClick OK to apply this suggested slot to the form.`;
                    if (confirm(msg)){
                        // Apply suggestion to form (both left and right controls if present)
                        const applyLabel = _minutesToLabel(suggestion.start);
                        const applyEndLabel = _minutesToLabel(suggestion.end);
                        // Try calendar-specific updater first
                        if (typeof window.calendar_updateStartTime === 'function') window.calendar_updateStartTime(applyLabel);
                        if (typeof window.calendar_updateEndTime === 'function') window.calendar_updateEndTime(applyEndLabel);
                        // Generic updater
                        if (typeof window.updateStartTime === 'function') window.updateStartTime(applyLabel);
                        if (typeof window.updateEndTime === 'function') window.updateEndTime(applyEndLabel);
                        // Also set visible buttons directly as fallback
                        const startBtns = document.querySelectorAll('#start_time_right, #start_time_left');
                        const endBtns = document.querySelectorAll('#end_time_right, #end_time_left');
                        startBtns.forEach(b=>{ if(b) b.textContent = applyLabel; });
                        endBtns.forEach(b=>{ if(b) b.textContent = applyEndLabel; });
                    }
                } else {
                    alert('Requested time overlaps an existing booking and no same-length slot is available today. Please choose a different date or duration.');
                }
                return; // stop submission
            }
            
            // Expand the requested booking into one or more dates based on repeat settings
            function parseISODate(str) {
                if (!str) return null;
                const parts = str.split('-');
                if (parts.length !== 3) return null;
                const y = parseInt(parts[0], 10);
                const m = parseInt(parts[1], 10) - 1;
                const d = parseInt(parts[2], 10);
                if (Number.isNaN(y) || Number.isNaN(m) || Number.isNaN(d)) return null;
                return new Date(y, m, d);
            }

            function toISODate(d) {
                const y = d.getFullYear();
                const m = String(d.getMonth() + 1).padStart(2, '0');
                const day = String(d.getDate()).padStart(2, '0');
                return `${y}-${m}-${day}`;
            }

            function buildOccurrenceDates() {
                const baseDate = parseISODate(date);
                if (!baseDate) return [date];

                // If no repeat or unsupported type, just return the base date
                if (!repeatType || repeatType === 'Never') {
                    return [date];
                }

                const dates = [];
                const seen = new Set();

                function addDate(d) {
                    const iso = toISODate(d);
                    if (!seen.has(iso)) {
                        seen.add(iso);
                        dates.push(iso);
                    }
                }

                if (repeatType === 'Daily') {
                    const endStr = document.getElementById('dailyEndDate')?.value;
                    const endDate = parseISODate(endStr);
                    if (!endDate || endDate < baseDate) {
                        return [date];
                    }
                    const cur = new Date(baseDate);
                    while (cur <= endDate) {
                        addDate(cur);
                        cur.setDate(cur.getDate() + 1);
                    }
                    return dates;
                }

                if (repeatType === 'Weekly') {
                    const endStr = document.getElementById('weeklyEndDate')?.value;
                    const endDate = parseISODate(endStr);
                    const dayIds = ['Mon','Tue','Wed','Thu','Fri'];
                    const jsDayFor = { Mon:1, Tue:2, Wed:3, Thu:4, Fri:5 };
                    const selectedCodes = dayIds.filter(code => {
                        const cb = document.getElementById('day' + code);
                        return cb && cb.checked;
                    });
                    if (!endDate || endDate < baseDate || selectedCodes.length === 0) {
                        return [date];
                    }
                    const selectedJsDays = selectedCodes.map(code => jsDayFor[code]);
                    const cur = new Date(baseDate);
                    while (cur <= endDate) {
                        if (selectedJsDays.includes(cur.getDay())) {
                            addDate(cur);
                        }
                        cur.setDate(cur.getDate() + 1);
                    }
                    return dates.length ? dates : [date];
                }

                if (repeatType === 'Monthly') {
                    const endStr = document.getElementById('monthlyEndDate')?.value;
                    const endDate = parseISODate(endStr);
                    if (!endDate || endDate < baseDate) {
                        return [date];
                    }
                    const cur = new Date(baseDate);
                    while (cur <= endDate) {
                        addDate(cur);
                        cur.setMonth(cur.getMonth() + 1);
                    }
                    return dates;
                }

                // Custom and other types: just single booking for now
                return [date];
            }

            const occurrenceDates = buildOccurrenceDates();

            // Prepare base booking data (date is filled per occurrence)
            const baseBookingData = {
                room: room,
                timeRange: timeRange,
                repeat: repeatLabel,
                name: name, // will be stored as userId on the server
                email: email,
                purpose: purpose
            };
            
            console.log('Repeat type:', repeatType, 'occurrence dates:', occurrenceDates);
            
            try {
                const created = [];
                const failures = [];

                for (const dateISO of occurrenceDates) {
                    const bookingData = { ...baseBookingData, date: dateISO };
                    console.log('Sending booking data:', bookingData);

                    const response = await fetch('/api/bookings', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify(bookingData)
                    });

                    const result = await response.json();
                    console.log('Response for', dateISO, ':', response.status, result);

                    if (response.ok && result.success) {
                        created.push({ id: result.id, date: dateISO });
                    } else {
                        failures.push({
                            date: dateISO,
                            status: response.status,
                            error: result.error || 'Failed to book room.'
                        });
                    }
                }

                if (created.length > 0) {
                    if (created.length === 1) {
                        alert('Room booked successfully!');
                    } else {
                        alert(`Room booked successfully on ${created.length} date(s).`);
                    }

                    // Send confirmation email for the first created booking only
                    const first = created[0];
                    try {
                        const emailResp = await fetch('/api/send-booking-confirmation', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ bookingId: first.id })
                        });
                        const emailResult = await emailResp.json();
                        if (emailResp.ok && emailResult.ok) {
                            console.log('Confirmation email sent.');
                        } else {
                            console.warn('⚠️ Email send failed:', emailResult.error);
                        }
                    } catch (emailError) {
                        console.error('Email send error:', emailError);
                    }

                    // Refresh map bookings to update room colors
                    if (typeof window.refreshMapBookings === 'function') {
                        window.refreshMapBookings();
                    }
                    // Refresh calendar bookings to update grid
                    if (typeof window.refreshCalendarBookings === 'function') {
                        window.refreshCalendarBookings();
                    }
                    // Clear form fields that should be reset
                    const emailInput = getElement('email');
                    const purposeInput = getElement('purpose');
                    if (emailInput) emailInput.value = '';
                    if (purposeInput) purposeInput.value = '';
                }

                if (failures.length > 0) {
                    const conflictFailures = failures.filter(f => f.status === 409);
                    const otherFailures = failures.filter(f => f.status !== 409);

                    let msg = '';
                    if (conflictFailures.length) {
                        msg += 'Some repeated dates could not be booked due to conflicts:\n' +
                               conflictFailures.map(f => `  - ${f.date}: ${f.error}`).join('\n') +
                               '\n\n';
                    }
                    if (otherFailures.length) {
                        msg += 'Some repeated dates failed to book:\n' +
                               otherFailures.map(f => `  - ${f.date}: ${f.error}`).join('\n');
                    }
                    if (msg) {
                        alert(msg);
                    }
                }
            } catch (error) {
                console.error('Network error:', error);
                alert('Network error: ' + error.message + '. Please check your connection and try again.');
            }
    });
};

// Try to initialize immediately (for static pages)
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.initBookingButton();
        // Autofill email + name once the DOM is ready (Calendar view, or Map if visible)
        if (typeof window.autofillBookingEmailIfEmpty === 'function') {
            window.autofillBookingEmailIfEmpty();
        }
        if (typeof window.autofillBookingNameIfEmpty === 'function') {
            window.autofillBookingNameIfEmpty();
        }
    });
} else {
    // DOM already loaded, try immediately
    window.initBookingButton();
    if (typeof window.autofillBookingEmailIfEmpty === 'function') {
        window.autofillBookingEmailIfEmpty();
    }
    if (typeof window.autofillBookingNameIfEmpty === 'function') {
        window.autofillBookingNameIfEmpty();
    }
}

// Also try after a short delay (for dynamically loaded content)
setTimeout(window.initBookingButton, 100);
setTimeout(window.initBookingButton, 500);
