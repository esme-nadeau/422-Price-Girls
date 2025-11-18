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
            
            // Get form values - try to find in the container that has the button
            const getElement = (id) => {
                // Find the tab pane that contains this button (re-evaluate at click time)
                const buttonContainer = newButton.closest('.tab-pane') || 
                                       document.querySelector('.tab-pane.show.active') ||
                                       document.querySelector('#nav-map.show, #nav-calendar.show');
                if (buttonContainer) {
                    const el = buttonContainer.querySelector('#' + id);
                    if (el) return el;
                }
                return document.getElementById(id);
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
            const repeat = repeatEl ? repeatEl.textContent.trim() : '';
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

            // Find next available slot on the same date for this room
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
                    // add bounds for day
                    const DAY_START = 8*60; const DAY_END = 20*60; // end boundary (exclusive)
                    // Merge intervals
                    intervals.sort((a,b)=>a[0]-b[0]);
                    const merged = [];
                    for(const iv of intervals){
                        if(!merged.length) merged.push(iv.slice());
                        else{
                            const last = merged[merged.length-1];
                            if(iv[0] <= last[1]) last[1] = Math.max(last[1], iv[1]);
                            else merged.push(iv.slice());
                        }
                    }
                    // Build free windows
                    const free = [];
                    let cur = DAY_START;
                    for(const m of merged){
                        if(m[0] > cur) free.push([cur, m[0]]);
                        cur = Math.max(cur, m[1]);
                    }
                    if(cur < DAY_END) free.push([cur, DAY_END]);
                    // Find earliest window starting at or after desiredStartMin with enough duration
                    for(const w of free){
                        const startCandidate = Math.max(w[0], desiredStartMin);
                        if(w[1] - startCandidate >= durationMin){
                            return {start: startCandidate, end: startCandidate + durationMin};
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
            
            // Prepare booking data
            const bookingData = {
                room: room,
                date: date,
                timeRange: timeRange,
                repeat: repeat,
                name: name, // will be stored as userId on the server
                email: email,
                purpose: purpose
            };
            
            console.log('Sending booking data:', bookingData);
            
            try {
                const response = await fetch('/api/bookings', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(bookingData)
                });
                
                console.log('Response status:', response.status);
                
                const result = await response.json();
                console.log('Response data:', result);
                
                if (response.ok && result.success) {
                    alert('Room booked successfully!');
                    // Send confirmation email automatically
                    try {
                        const emailResp = await fetch('/api/send-booking-confirmation', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ bookingId: result.id })
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
                    // Clear form
                    const emailInput = getElement('email');
                    const purposeInput = getElement('purpose');
                    if (emailInput) emailInput.value = '';
                    if (purposeInput) purposeInput.value = '';
                } else {
                    // Handle different error types
                    const errorMsg = result.error || 'Failed to book room. Please try again.';
                    console.error('Booking failed:', errorMsg);
                    
                    // Special handling for overlap conflicts (409)
                    if (response.status === 409) {
                        alert('Booking Conflict:\n\n' + errorMsg + '\n\nPlease select a different time slot.');
                    } else {
                        alert('Error: ' + errorMsg);
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
    document.addEventListener('DOMContentLoaded', window.initBookingButton);
} else {
    // DOM already loaded, try immediately
    window.initBookingButton();
}

// Also try after a short delay (for dynamically loaded content)
setTimeout(window.initBookingButton, 100);
setTimeout(window.initBookingButton, 500);
