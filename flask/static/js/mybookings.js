console.log("📜 mybookings.js loaded and executing");

// Variables that will be initialized when DOM is ready
let dateInput = null;
let datePicker = null;
let bookingForm = null;
let cancelBtn = null;
let editBtn = null;

// Initialize elements - call this when DOM is ready
function initMyBookingsElements() {
  dateInput = document.getElementById('date');
  if (dateInput && typeof flatpickr !== 'undefined') {
    datePicker = flatpickr(dateInput, { dateFormat: "m/d/Y" });
  } else if (dateInput) {
    console.warn("⚠️ Date input found but flatpickr not loaded");
  } else {
    console.warn("⚠️ Date input not found");
  }

  bookingForm = document.getElementById('bookingForm');
  cancelBtn = document.getElementById('cancelBookingBtn');
  editBtn = document.getElementById('editBookingBtn');
  
  if (!bookingForm) {
    console.warn("⚠️ bookingForm not found");
  }
  if (!cancelBtn) {
    console.warn("⚠️ cancelBtn not found");
  }
  if (!editBtn) {
    console.warn("⚠️ editBtn not found");
  }
}

// Helper to switch between display and edit mode
function setBookingFormEditable(editable) {
  // Handle repeat field separately (using repeat modal system)
  // Scope lookups to bookingForm if available to avoid conflicts
  const container = bookingForm || document;
  const repeatDisplay = container.querySelector('#repeatDisplay') || document.getElementById('repeatDisplay');
  const repeatEdit = container.querySelector('#repeatEdit') || document.getElementById('repeatEdit');
  const repeatDropdown = container.querySelector('#repeatDropdown') || document.getElementById('repeatDropdown');
  const repeatNotesIcon = container.querySelector('#repeatNotesIcon') || document.getElementById('repeatNotesIcon');
  const repeatSpan = container.querySelector('#repeat') || document.getElementById('repeat');
  
  if (editable) {
    // Show edit mode, hide display mode
    if (repeatDisplay) repeatDisplay.classList.add('d-none');
    if (repeatEdit) repeatEdit.classList.remove('d-none');
    
    // Get current repeat value from span - make sure we get the actual text content
    let repeatVal = 'Never';
    if (repeatSpan) {
      // Get text content, handling whitespace and empty strings
      const spanText = repeatSpan.textContent || repeatSpan.innerText || '';
      repeatVal = spanText.trim() || 'Never';
      
      // If span is empty, try to get from booking card as fallback
      if (!repeatVal || repeatVal === 'Never') {
        const bookingId = bookingForm ? bookingForm.dataset.id : '';
        if (bookingId) {
          const card = document.querySelector(`.booking-card[data-id="${bookingId}"]`);
          if (card) {
            try {
              const bookingData = card.dataset.booking ? JSON.parse(card.dataset.booking) : {};
              const cardRepeat = bookingData.repeat || card.dataset.repeat || '';
              if (cardRepeat && cardRepeat !== 'Never') {
                repeatVal = cardRepeat;
                // Also update the span so it's correct
                repeatSpan.textContent = repeatVal;
              }
            } catch (e) {
              const cardRepeat = card.dataset.repeat || '';
              if (cardRepeat && cardRepeat !== 'Never') {
                repeatVal = cardRepeat;
                repeatSpan.textContent = repeatVal;
              }
            }
          }
        }
      }
    }
    
    // Debug: log the repeat value we're reading
    console.log('[mybookings] Entering edit mode, repeat value:', repeatVal);
    
    if (repeatDropdown) {
      repeatDropdown.textContent = repeatVal;
      repeatDropdown.disabled = false;
      repeatDropdown.style.pointerEvents = '';
      repeatDropdown.style.opacity = '';
      repeatDropdown.style.cursor = '';
      repeatDropdown.removeAttribute('data-disabled');
      
      // Remove all click prevention handlers
      if (repeatDropdown._clickHandlers) {
        repeatDropdown._clickHandlers.forEach(handler => {
          repeatDropdown.removeEventListener('click', handler, true);
        });
        repeatDropdown._clickHandlers = [];
      }
      
      // Also ensure the dropdown menu items are clickable
      const dropdownMenu = repeatDropdown.nextElementSibling;
      if (dropdownMenu && dropdownMenu.classList.contains('dropdown-menu')) {
        dropdownMenu.style.pointerEvents = '';
        dropdownMenu.style.opacity = '';
      }
      
      // Parse repeat value to determine type
      let type = 'Never';
      if (repeatVal.startsWith('Daily')) type = 'Daily';
      else if (repeatVal.startsWith('Weekly')) type = 'Weekly';
      else if (repeatVal.startsWith('Monthly')) type = 'Monthly';
      else if (repeatVal && repeatVal !== 'Never') type = 'Custom';
      repeatDropdown.dataset.repeatType = type;
      
      // Show notes icon if not Never
      if (repeatNotesIcon) {
        if (type !== 'Never') {
          repeatNotesIcon.classList.remove('d-none');
        } else {
          repeatNotesIcon.classList.add('d-none');
        }
      }
    }
  } else {
    // Show display mode, hide edit mode
    if (repeatDisplay) repeatDisplay.classList.remove('d-none');
    if (repeatEdit) repeatEdit.classList.add('d-none');
    
    // Get repeat value from dropdown
    if (repeatDropdown && repeatSpan) {
      const repeatVal = repeatDropdown.textContent || 'Never';
      repeatSpan.textContent = repeatVal;
    }
    
    // Disable dropdown using CSS instead of disabled attribute (so Bootstrap dropdown still works)
    if (repeatDropdown) {
      repeatDropdown.style.pointerEvents = 'none';
      repeatDropdown.style.opacity = '0.6';
      repeatDropdown.style.cursor = 'not-allowed';
      repeatDropdown.dataset.disabled = 'true';
      
      // Prevent dropdown button from opening when disabled
      const clickHandler = function(e) {
        if (this.dataset.disabled === 'true') {
          e.preventDefault();
          e.stopPropagation();
          return false;
        }
      };
      if (!repeatDropdown._clickHandlers) {
        repeatDropdown._clickHandlers = [];
      }
      repeatDropdown._clickHandlers.push(clickHandler);
      repeatDropdown.addEventListener('click', clickHandler, true);
    }
  }

  const fields = [
    { id: 'date', type: 'date' },
    { id: 'time', type: 'custom-time' },
    { id: 'name', type: 'text' },
    { id: 'email', type: 'email' },
    { id: 'purpose', type: 'text' },
    { id: 'roomId', type: 'dropdown' }
  ];
  fields.forEach(async f => {
    const el = bookingForm.querySelector(`#${f.id}`) || document.getElementById(f.id);
    if (!el) return;
    if (editable) {
      let newEl;
      if (f.type === 'dropdown') {
        newEl = document.createElement('select');
        newEl.className = 'form-select';
        newEl.id = f.id;
        try {
          const resp = await fetch('/api/rooms');
          const data = await resp.json();
          (data.rooms || []).forEach(room => {
            const o = document.createElement('option');
            o.value = room.id;
            o.textContent = room.name || room.id;
            newEl.appendChild(o);
          });
          newEl.value = el.textContent;
        } catch (err) {
          const o = document.createElement('option');
          o.textContent = el.textContent || 'Unavailable';
          newEl.appendChild(o);
        }
        el.replaceWith(newEl);
        return;
      } else if (f.type === 'custom-time') {
        // Create two dropdowns for start and end time
        const wrapper = document.createElement('div');
        wrapper.className = 'd-flex gap-2';
        // Generate time slots from 8:00 AM to 6:30 PM (last start at 6:30 PM)
        const slots = [];
        for (let h = 8; h <= 18; h++) {
          for (let m = 0; m < 60; m += 30) {
            let hour = h > 12 ? h - 12 : h;
            let ampm = h < 12 ? 'AM' : 'PM';
            let min = m === 0 ? '00' : '30';
            slots.push(`${hour}:${min} ${ampm}`);
          }
        }
        // Parse current timeRange
        let startVal = slots[0], endVal = slots[1];
        if (el.textContent && el.textContent.includes(' - ')) {
          const [start, end] = el.textContent.split(' - ');
          startVal = start.trim();
          endVal = end.trim();
        }
        const startSel = document.createElement('select');
        startSel.className = 'form-select';
        startSel.id = 'startTime';
        slots.forEach(s => {
          const o = document.createElement('option');
          o.value = s;
          o.textContent = s;
          startSel.appendChild(o);
        });
        startSel.value = startVal;
        const endSel = document.createElement('select');
        endSel.className = 'form-select';
        endSel.id = 'endTime';
        slots.forEach(s => {
          const o = document.createElement('option');
          o.value = s;
          o.textContent = s;
          endSel.appendChild(o);
        });
        endSel.value = endVal;
        // Validation: prevent end before start
        function validateTimes() {
          const startIdx = slots.indexOf(startSel.value);
          const endIdx = slots.indexOf(endSel.value);
          if (endIdx <= startIdx) {
            endSel.setCustomValidity('End time must be after start time');
            endSel.reportValidity();
          } else {
            endSel.setCustomValidity('');
          }
        }
        startSel.addEventListener('change', validateTimes);
        endSel.addEventListener('change', validateTimes);
        wrapper.appendChild(startSel);
        wrapper.appendChild(document.createTextNode(' to '));
        wrapper.appendChild(endSel);
        el.replaceWith(wrapper);
      } else {
        newEl = document.createElement('input');
        newEl.className = 'form-control';
        newEl.type = f.type;
        newEl.id = f.id;
        newEl.value = el.textContent;
        
        // For date inputs, set min date and initialize date prevention
        if (f.type === 'date') {
          const today = new Date().toISOString().split('T')[0];
          newEl.setAttribute('min', today);
          // Initialize date prevention (weekends and closures) after element is added to DOM
          // This will also validate and correct the current value if needed
          setTimeout(async () => {
            if (typeof window.initWeekendPrevention === 'function') {
              const container = bookingForm || document;
              await window.initWeekendPrevention(container);
            }
          }, 0);
        }
        
        el.replaceWith(newEl);
      }
    } else {
      let newEl = document.createElement('span');
      newEl.className = 'form-control';
      newEl.id = f.id;
      newEl.style.background = '#eee';
      newEl.style.pointerEvents = 'none';
      newEl.style.userSelect = 'text';
      if (f.type === 'custom-time') {
        // Always render as non-interactive span in display mode
        let startVal = '', endVal = '';
        if (el.classList.contains('d-flex')) {
          const startSel = el.querySelector('#startTime');
          const endSel = el.querySelector('#endTime');
          if (startSel && endSel) {
            startVal = startSel.value;
            endVal = endSel.value;
          } else {
            // fallback: try to parse textContent
            if (el.textContent && el.textContent.includes(' to ')) {
              const [start, end] = el.textContent.split(' to ');
              startVal = start.trim();
              endVal = end.trim();
            } else {
              startVal = el.textContent;
            }
          }
        } else {
          // If not a flex wrapper, just use textContent
          startVal = el.textContent;
        }
        newEl.textContent = startVal && endVal ? `${startVal} - ${endVal}` : startVal;
        el.replaceWith(newEl);
        return;
      } else if (el.tagName === 'SELECT') {
        newEl.textContent = el.value;
        el.replaceWith(newEl);
        return;
      } else {
        newEl.textContent = el.value;
        el.replaceWith(newEl);
        return;
      }
    }
  });
}

// Track edit mode
let isEditing = false;

// Function to enable/disable booking card clicks
function setBookingCardsClickable(clickable) {
  // Query for cards each time to handle dynamically loaded content
  const cards = document.querySelectorAll('.booking-card');
  cards.forEach(card => {
    if (clickable) {
      card.style.pointerEvents = '';
      card.style.opacity = '';
      card.style.cursor = '';
    } else {
      card.style.pointerEvents = 'none';
      card.style.opacity = '0.6';
      card.style.cursor = 'not-allowed';
    }
  });
}

// Initialize edit and cancel button handlers
function initMyBookingsButtons() {
  if (editBtn) {
    // Remove existing listener if any by cloning
    const newEditBtn = editBtn.cloneNode(true);
    editBtn.parentNode.replaceChild(newEditBtn, editBtn);
    editBtn = newEditBtn;
    
    editBtn.addEventListener('click', async () => {
    if (!isEditing) {
      // Enter edit mode
      // Before entering edit mode, ensure we have the current repeat value
      // Try to get it from the span, or fall back to the booking card data
      const repeatSpan = document.getElementById('repeat');
      const bookingId = bookingForm ? bookingForm.dataset.id : '';
      let currentRepeat = 'Never';
      
      if (repeatSpan && repeatSpan.textContent && repeatSpan.textContent.trim()) {
        currentRepeat = repeatSpan.textContent.trim();
      } else if (bookingId) {
        // Fallback: get from the booking card
        const card = document.querySelector(`.booking-card[data-id="${bookingId}"]`);
        if (card) {
          try {
            const bookingData = card.dataset.booking ? JSON.parse(card.dataset.booking) : {};
            currentRepeat = bookingData.repeat || card.dataset.repeat || 'Never';
          } catch (e) {
            currentRepeat = card.dataset.repeat || 'Never';
          }
        }
      }
      
      // Ensure the span has the value before entering edit mode
      if (repeatSpan && (!repeatSpan.textContent || !repeatSpan.textContent.trim())) {
        repeatSpan.textContent = currentRepeat;
      }
      
      setBookingFormEditable(true);
      editBtn.textContent = 'Save';
      isEditing = true;
      setBookingCardsClickable(false); // Disable clicking other bookings
    } else {
      // Save edits
      const bookingId = bookingForm.dataset.id;
      if (!bookingId) {
        alert('No booking selected.');
        return;
      }
      // Gather updated values
      const getVal = id => {
        if (id === 'time') {
          const wrapper = bookingForm.querySelector('.d-flex');
          const startSel = wrapper ? wrapper.querySelector('#startTime') : null;
          const endSel = wrapper ? wrapper.querySelector('#endTime') : null;
          if (startSel && endSel) {
            // Validate times
            const slots = Array.from(startSel.options).map(o => o.value);
            const startIdx = slots.indexOf(startSel.value);
            const endIdx = slots.indexOf(endSel.value);
            if (endIdx <= startIdx) {
              alert('End time must be after start time.');
              return null;
            }
            return `${startSel.value} - ${endSel.value}`;
          }
          return '';
        }
        const el = bookingForm.querySelector(`#${id}`) || document.getElementById(id);
        return el ? (el.tagName === 'SELECT' ? el.value : el.value) : '';
      };
      
      // Get repeat value from dropdown (like allbookings does)
      // Make sure we're getting it from the correct dropdown in the booking form
      const repeatDropdown = bookingForm ? bookingForm.querySelector('#repeatDropdown') : document.getElementById('repeatDropdown');
      let repeatText = 'Never';
      if (repeatDropdown) {
        // Get the actual text content from the button
        // The textContent should have been updated by repeat.js when the modal was saved
        repeatText = (repeatDropdown.textContent || repeatDropdown.innerText || 'Never').trim();
        console.log('[mybookings] Saving, repeat value from dropdown:', repeatText);
      } else {
        console.warn('[mybookings] Repeat dropdown not found when saving!');
      }
      
      const updated = {
        date: getVal('date'),
        timeRange: getVal('time'),
        repeat: repeatText,
        email: getVal('email'),
        purpose: getVal('purpose'),
        roomId: getVal('roomId'),
        // Include name/userId so server can update the booking owner info
        userId: getVal('name'),
        name: getVal('name')
      };
      if (updated.timeRange === null) return; // Invalid time selection
      try {
        const response = await fetch(`/update_booking/${bookingId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updated)
        });
        const result = await response.json();
        if (result.success) {
          // Notify user
          alert('Your reservation was updated successfully.');
          
          // Update display - call setBookingFormEditable(false) first (like admin page does)
          setBookingFormEditable(false);
          
          // Forcefully replace time dropdowns with span
          const timeWrapper = bookingForm.querySelector('.d-flex');
          if (timeWrapper) {
            let startVal = '', endVal = '';
            const startSel = timeWrapper.querySelector('#startTime');
            const endSel = timeWrapper.querySelector('#endTime');
            if (startSel && endSel) {
              startVal = startSel.value;
              endVal = endSel.value;
            }
            const span = document.createElement('span');
            span.className = 'form-control';
            span.id = 'time';
            span.style.background = '#eee';
            span.style.pointerEvents = 'none';
            span.style.userSelect = 'text';
            span.textContent = startVal && endVal ? `${startVal} - ${endVal}` : '';
            timeWrapper.replaceWith(span);
          }
          
          // Update form display with saved values (like admin page does)
          const setSpan = (id, value) => {
            const el = bookingForm.querySelector(`#${id}`) || document.getElementById(id);
            if (el) el.textContent = value || '';
          };
          setSpan('date', updated.date);
          setSpan('time', updated.timeRange);
          setSpan('repeat', updated.repeat);
          setSpan('name', updated.name || updated.userId);
          setSpan('email', updated.email);
          setSpan('purpose', updated.purpose);
          setSpan('roomId', updated.roomId);
          
          editBtn.textContent = 'Edit Reservation';
          isEditing = false;
          setBookingCardsClickable(true); // Re-enable clicking other bookings
          // Optionally update the booking card info in DOM
          const card = document.querySelector(`.booking-card[data-id="${bookingId}"]`);
          if (card) {
            card.dataset.date = updated.date;
            card.dataset.time = updated.timeRange;
            card.dataset.repeat = updated.repeat;
            card.dataset.email = updated.email;
            card.dataset.purpose = updated.purpose;
            card.dataset.roomid = updated.roomId;
            card.dataset.name = updated.name || updated.userId || '';
            card.dataset.booking = JSON.stringify({
              id: bookingId,
              date: updated.date,
              time: updated.timeRange,
              repeat: updated.repeat,
              name: updated.name || updated.userId || '',
              email: updated.email,
              purpose: updated.purpose,
              roomId: updated.roomId
            });
            // Update visible card text
            card.querySelector('h5').textContent = updated.purpose;
            card.querySelector('p:nth-of-type(1)').textContent = updated.roomId;
            card.querySelector('p:nth-of-type(2)').textContent = updated.timeRange;
            card.querySelector('p.text-muted').textContent = updated.date;
          }
        } else {
          alert('Error saving booking: ' + (result.error || 'unknown error'));
        }
      } catch (err) {
        alert('Failed to save booking.');
      }
    }
  });
  }

  // Cancel button handler
  if (cancelBtn) {
    // Remove existing listener if any by cloning
    const newCancelBtn = cancelBtn.cloneNode(true);
    cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
    cancelBtn = newCancelBtn;
    
    cancelBtn.addEventListener('click', async () => {
      if (!bookingForm) {
        alert("Booking form not found.");
        return;
      }
      const bookingId = bookingForm.dataset.id;
      if (!bookingId) {
        alert("Please select a booking first.");
        return;
      }

      const confirmDelete = confirm("Are you sure you want to cancel this reservation?");
      if (!confirmDelete) return;

      console.log(`🗑️ Deleting booking ${bookingId}...`);

      try {
        const response = await fetch(`/delete_booking/${bookingId}`, { method: 'DELETE' });
        const result = await response.json();

        if (result.success) {
          alert("Booking canceled successfully!");
          document.querySelector(`.booking-card[data-id="${bookingId}"]`)?.remove();
          bookingForm.reset();
          bookingForm.dataset.id = "";
        } else {
          alert("Error canceling booking: " + (result.error || "unknown error"));
        }
      } catch (err) {
        console.error("❌ Error deleting booking:", err);
        alert("Failed to cancel booking.");
      }
    });
  } else {
    console.warn("⚠️ Cancel button not found");
  }
}

// Store the handler function so we can remove it if needed
let bookingCardClickHandler = null;

// Use event delegation to handle clicks on booking cards (works even if cards are added dynamically)
function bindBookingCardClicks() {
  // Only run on My Bookings page (check for mybookings-root)
  const myBookingsRoot = document.getElementById('mybookings-root');
  if (!myBookingsRoot) {
    return;
  }

  // Find bookingsList WITHIN mybookings-root, not just any bookingsList on the page
  const bookingsList = myBookingsRoot.querySelector('#bookingsList');
  if (!bookingsList) {
    // Retry after a short delay
    setTimeout(bindBookingCardClicks, 200);
    return;
  }

  // Remove old handler if it exists
  if (bookingsList.dataset.clickBound === 'true' && bookingCardClickHandler) {
    bookingsList.removeEventListener('click', bookingCardClickHandler);
  }
  
  bookingsList.dataset.clickBound = 'true';

  // Create the handler function
  bookingCardClickHandler = (e) => {
    console.log("🖱️ Click detected in bookingsList", e.target);
    const card = e.target.closest('.booking-card');
    if (!card) {
      console.log("   (not on a booking card, ignoring)");
      return;
    }
    
    // Ensure the card is within the My Bookings container
    if (!myBookingsRoot.contains(card)) {
      return;
    }
    
    console.log("✅ Clicked on booking card:", card.dataset.id);

    // Prevent clicking other bookings while in edit mode
    if (isEditing) {
      return;
    }

    console.log(`🟢 Clicked booking ${card.dataset.id}`);

    const currentBookingId = bookingForm ? bookingForm.dataset.id : '';
    const clickedBookingId = card.dataset.id;

    // If clicking the same booking again, deselect and clear the Booking Information
    if (currentBookingId && currentBookingId === clickedBookingId) {
      // Remove selection highlight (only within My Bookings container)
      bookingsList.querySelectorAll('.booking-card').forEach(c => c.classList.remove('selected'));
      // Clear stored id
      bookingForm.dataset.id = '';
      // Clear all info fields
      const clearSpan = (id) => {
        const el = bookingForm.querySelector(`#${id}`) || document.getElementById(id);
        if (el) el.textContent = '';
      };
      ['date', 'time', 'repeat', 'name', 'email', 'purpose', 'roomId'].forEach(clearSpan);
      // Hide and disable actions when no booking is selected
      if (bookingActions) {
        bookingActions.style.display = 'none';
      }
      if (editBtn) editBtn.disabled = true;
      if (cancelBtn) cancelBtn.disabled = true;
      console.log('🟡 Booking deselected and info cleared');
      return;
    }

    // Highlight selected (only within My Bookings container)
    bookingsList.querySelectorAll('.booking-card').forEach(c => c.classList.remove('selected'));
    card.classList.add('selected');

    // Show and enable actions when a booking is selected
    if (bookingActions) {
      bookingActions.style.display = 'flex';
    }
    if (editBtn) editBtn.disabled = false;
    if (cancelBtn) cancelBtn.disabled = false;

    // Parse structured booking data (preferred) with fallback to individual data-* attributes
    let bookingData = {};
    try {
      if (card.dataset.booking) bookingData = JSON.parse(card.dataset.booking);
    } catch (err) {
      console.warn('⚠️ Could not parse data-booking JSON, falling back to data-* attributes', err);
      bookingData = {};
    }

    // Save the ID
    if (bookingForm) {
      bookingForm.dataset.id = bookingData.id || card.dataset.id || '';
    }

    // Handle the date format safely
    let dateValue = bookingData.date || card.dataset.date || '';
    if (dateValue) {
      const parsed = new Date(dateValue);
      if (!isNaN(parsed)) dateValue = parsed;
      else {
        console.warn('⚠️ Could not parse date:', bookingData.date || card.dataset.date);
        dateValue = null;
      }
    }

    // Populate <span> fields for non-editable display
    const setSpan = (id, value) => {
      const el = bookingForm ? bookingForm.querySelector(`#${id}`) : null;
      if (!el) {
        const el2 = document.getElementById(id);
        if (el2) el2.textContent = value || '';
      } else {
        el.textContent = value || '';
      }
    };

    setSpan('date', bookingData.date || card.dataset.date || '');
    setSpan('time', bookingData.time || card.dataset.time || '');
    setSpan('repeat', bookingData.repeat || card.dataset.repeat || 'Never');
    setSpan('name', bookingData.name || bookingData.userId || card.dataset.name || '');
    setSpan('email', bookingData.email || card.dataset.email || '');
    setSpan('purpose', bookingData.purpose || card.dataset.purpose || '');
    setSpan('roomId', bookingData.roomId || card.dataset.roomid || '');
  };
  
  // Attach the handler
  bookingsList.addEventListener('click', bookingCardClickHandler);

  // Log how many cards were found
  const cards = bookingsList.querySelectorAll('.booking-card');
  if (!cards.length) {
    console.warn("⚠️ No booking cards found in DOM when mybookings.js ran");
  } else {
    console.log(`✅ Found ${cards.length} booking cards and bound click handler via event delegation`);
  }
}

// Main initialization function - call this when DOM is ready
function initMyBookings() {
  console.log("🔧 Initializing My Bookings...");
  
  // Step 1: Initialize DOM element references
  initMyBookingsElements();
  
  // Step 2: Initialize button handlers
  initMyBookingsButtons();
  
  // Step 3: Bind click handlers for booking cards
  bindBookingCardClicks();
  
  console.log("✅ My Bookings initialization complete");
}

// Expose functions globally so they can be called from tab handler
window.bindBookingCardClicks = bindBookingCardClicks;
window.initMyBookings = initMyBookings;

// Auto-initialize when script loads (if DOM is ready)
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initMyBookings);
} else {
  // DOM already loaded, try immediately
  initMyBookings();
}

// Also try after a short delay in case content loads asynchronously
setTimeout(initMyBookings, 100);

