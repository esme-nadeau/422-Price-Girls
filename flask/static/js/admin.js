/* ==============================
    Helper Functions
============================== */
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function showMessage(msg, isError = false) {
  const roomsMessage = document.getElementById('roomsMessage');
  if (!roomsMessage) return;
  roomsMessage.textContent = msg || '';
  if (isError) {
    roomsMessage.style.color = '#F28380';
    roomsMessage.classList.remove('text-muted');
  } else {
    roomsMessage.style.color = '#666';
    roomsMessage.classList.add('text-muted');
  }
}

/* ==============================
    Admin Page Booking Management
============================== */
(function() {
  function initAdminBookingManagement() {
    // Check if elements exist
    const bookingForm = document.getElementById('bookingForm');
    const cancelBtn = document.getElementById('cancelBookingBtn');
    const editBtn = document.getElementById('editBookingBtn');
    
    if (!bookingForm) {
      return false; // Elements not loaded yet
    }

    // Initialize Flatpickr on the date field (only if flatpickr is loaded)
    const dateInput = document.getElementById('date');
    let datePicker = null;
    if (dateInput && typeof flatpickr !== 'undefined') {
      datePicker = flatpickr(dateInput, { dateFormat: "m/d/Y" });
    }

    // Grab booking cards
    const bookingCards = document.querySelectorAll('.booking-card');
        // Elements for the info card in the middle column (admin.html)
        const bookingInfoCard = document.getElementById("bookingInfoCard");
        const confirmBtn = document.getElementById("confirmBookingBtn");
        const denyBtn = document.getElementById("denyBookingBtn");
    
        const dateField = bookingForm.querySelector("#date");
        const timeField = bookingForm.querySelector("#time");
        const repeatField = bookingForm.querySelector("#repeat");
        const nameField = bookingForm.querySelector("#name");
        const emailField = bookingForm.querySelector("#email");
        const purposeField = bookingForm.querySelector("#purpose");
        const roomIdField = bookingForm.querySelector("#roomId");
    
        function setField(el, value) {
          if (!el) return;
          const v = value || "";
          // If it's an <input> or <select>, use .value, otherwise use .textContent
          if ("value" in el && el.tagName !== "SPAN" && el.tagName !== "DIV") {
            el.value = v;
          } else {
            el.textContent = v;
          }
        }
    
        function clearActiveCards() {
          document
            .querySelectorAll(".booking-card.active")
            .forEach((card) => card.classList.remove("active"));
        }
    
        function getBookingFromCard(card) {
          let booking = {};
          const raw = card.getAttribute("data-booking");
    
          if (raw) {
            try {
              booking = JSON.parse(raw);
            } catch (e) {
              console.error("[admin.js] Failed to parse data-booking JSON", e);
            }
          }
    
          booking.id = booking.id || card.dataset.id || "";
          booking.date = booking.date || card.dataset.date || "";
          booking.time =
            booking.time || booking.timeRange || card.dataset.time || "";
          booking.repeat = booking.repeat || card.dataset.repeat || "Never";
          booking.name =
            booking.name || booking.userId || card.dataset.name || "";
          booking.email =
            booking.email || booking.userEmail || card.dataset.email || "";
          booking.purpose = booking.purpose || card.dataset.purpose || "";
          booking.roomId = booking.roomId || card.dataset.roomid || "";
    
          return booking;
        }
    
        function populateBookingInfo(booking) {
          if (!bookingInfoCard) return;
    
          // Save ID for approve/deny
          bookingForm.dataset.id = booking.id || "";
    
          // Populate <span> fields for non-editable display (matching mybookings styling)
          const setSpan = (id, value) => {
            const el = bookingForm.querySelector(`#${id}`) || document.getElementById(id);
            if (el) el.textContent = value || '';
          };
    
          setSpan('date', booking.date || '');
          setSpan('time', booking.time || booking.timeRange || '');
          setSpan('repeat', booking.repeat || 'Never');
          setSpan('name', booking.name || booking.userId || '');
          setSpan('email', booking.email || booking.userEmail || '');
          setSpan('purpose', booking.purpose || '');
          setSpan('roomId', booking.roomId || '');
    
          bookingInfoCard.style.display = "block";
        }
    
        // Attach click listeners to all pending booking cards
        bookingCards.forEach((card) => {
          // Skip if already has click handler
          if (card.dataset.adminClickBound === 'true') {
            return;
          }
          card.dataset.adminClickBound = 'true';
          
          card.addEventListener("click", () => {
            if (!bookingInfoCard) return;
            const booking = getBookingFromCard(card);
            console.log("Admin: Clicked booking", card.dataset.id);
            
            const currentBookingId = bookingForm.dataset.id;
            const clickedBookingId = card.dataset.id;
            
            // Check if the same booking is clicked again
            if (currentBookingId === clickedBookingId && bookingInfoCard && bookingInfoCard.style.display === 'block') {
              // Hide the booking information card
              bookingInfoCard.style.display = 'none';
              // Remove selection highlight
              document.querySelectorAll('.booking-card').forEach(c => c.classList.remove('selected'));
              // Clear the form ID
              bookingForm.dataset.id = '';
              console.log('Admin: Booking card hidden');
              return;
            }
            
            // Highlight selected
            document.querySelectorAll('.booking-card').forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            populateBookingInfo(booking);
          });
        });
    
        // Helper for POST JSON used by Approve / Deny
        async function postJSON(url) {
          const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({}),
          });
    
          let data = {};
          try {
            data = await res.json();
          } catch (e) {
            // ignore parse errors
          }
    
          if (!res.ok || data.success === false || data.ok === false) {
            const msg =
              data.error || data.message || `Request failed: ${res.status}`;
            throw new Error(msg);
          }
    
          return data;
        }
    
        // Helper to check if bookings list is empty and show message
        function checkAndShowEmptyMessage() {
          const bookingsList = document.getElementById('bookingsList');
          if (!bookingsList) return;
          
          const remainingCards = bookingsList.querySelectorAll('.booking-card');
          if (remainingCards.length === 0) {
            bookingsList.innerHTML = '<div style="color: #6c757d; background: #f8f9fa; border: 1px solid #e9ecef; padding: 10px; border-radius: 8px; margin-bottom: 1rem;">No bookings to approve.</div>';
          }
        }

        // Approve (Confirm Reservation) for pending bookings
        if (confirmBtn && !confirmBtn.dataset.bound) {
          confirmBtn.dataset.bound = "true";
          confirmBtn.addEventListener("click", async () => {
            const id = bookingForm.dataset.id;
            if (!id) {
              alert("Select a booking first.");
              return;
            }
    
            try {
              console.log(`Admin: approving pending booking ${id}`);
              await postJSON(
                `/api/pending-bookings/${encodeURIComponent(id)}/approve`
              );
    
              const selector = `.booking-card[data-id="${CSS.escape(id)}"]`;
              const card = document.querySelector(selector);
              if (card) card.remove();
    
              if (bookingInfoCard) bookingInfoCard.style.display = "none";
              bookingForm.dataset.id = "";
              
              // Check if list is now empty and show message
              checkAndShowEmptyMessage();
    
              alert("Booking approved and moved to confirmed bookings.");
            } catch (err) {
              console.error("Error approving pending booking:", err);
              alert(`Error approving booking: ${err.message}`);
            }
          });
        }
    
        // Deny pending booking
        if (denyBtn && !denyBtn.dataset.bound) {
          denyBtn.dataset.bound = "true";
          denyBtn.addEventListener("click", async () => {
            const id = bookingForm.dataset.id;
            if (!id) {
              alert("Select a booking first.");
              return;
            }
    
            try {
              console.log(`Admin: denying pending booking ${id}`);
              await postJSON(
                `/api/pending-bookings/${encodeURIComponent(id)}/deny`
              );
    
              const selector = `.booking-card[data-id="${CSS.escape(id)}"]`;
              const card = document.querySelector(selector);
              if (card) card.remove();
    
              if (bookingInfoCard) bookingInfoCard.style.display = "none";
              bookingForm.dataset.id = "";
              
              // Check if list is now empty and show message
              checkAndShowEmptyMessage();
    
              alert("Booking denied and removed.");
            } catch (err) {
              console.error("Error denying pending booking:", err);
              alert(`Error denying booking: ${err.message}`);
            }
          });
        }
    

    function setField(el, value) {
      if (!el) return;
      const v = value || "";
      // If it's an <input> or <select>, use .value, otherwise use .textContent
      if ("value" in el && el.tagName !== "SPAN" && el.tagName !== "DIV") {
        el.value = v;
      } else {
        el.textContent = v;
      }
    }

    function clearActiveCards() {
      document
        .querySelectorAll(".booking-card.active")
        .forEach((card) => card.classList.remove("active"));
    }

    function getBookingFromCard(card) {
      let booking = {};
      const raw = card.getAttribute("data-booking");

      if (raw) {
        try {
          booking = JSON.parse(raw);
        } catch (e) {
          console.error("[admin.js] Failed to parse data-booking JSON", e);
        }
      }

      booking.id = booking.id || card.dataset.id || "";
      booking.date = booking.date || card.dataset.date || "";
      booking.time =
        booking.time || booking.timeRange || card.dataset.time || "";
      booking.repeat = booking.repeat || card.dataset.repeat || "Never";
      booking.name =
        booking.name || booking.userId || card.dataset.name || "";
      booking.email =
        booking.email || booking.userEmail || card.dataset.email || "";
      booking.purpose = booking.purpose || card.dataset.purpose || "";
      booking.roomId = booking.roomId || card.dataset.roomid || "";

      return booking;
    }

    function populateBookingInfo(booking) {
      if (!bookingInfoCard) return;

      // Save ID for approve/deny
      bookingForm.dataset.id = booking.id || "";

      // Populate <span> fields for non-editable display (matching mybookings styling)
      const setSpan = (id, value) => {
        const el = bookingForm.querySelector(`#${id}`) || document.getElementById(id);
        if (el) el.textContent = value || '';
      };

      setSpan('date', booking.date || '');
      setSpan('time', booking.time || booking.timeRange || '');
      setSpan('repeat', booking.repeat || 'Never');
      setSpan('name', booking.name || booking.userId || '');
      setSpan('email', booking.email || booking.userEmail || '');
      setSpan('purpose', booking.purpose || '');
      setSpan('roomId', booking.roomId || '');

      bookingInfoCard.style.display = "block";
    }

    // Attach click listeners to all pending booking cards
    bookingCards.forEach((card) => {
      // Skip if already has click handler
      if (card.dataset.adminClickBound === 'true') {
        return;
      }
      card.dataset.adminClickBound = 'true';
      
      card.addEventListener("click", () => {
        if (!bookingInfoCard) return;
        const booking = getBookingFromCard(card);
        console.log("Admin: Clicked booking", card.dataset.id);
        
        const currentBookingId = bookingForm.dataset.id;
        const clickedBookingId = card.dataset.id;
        
        // Check if the same booking is clicked again
        if (currentBookingId === clickedBookingId && bookingInfoCard && bookingInfoCard.style.display === 'block') {
          // Hide the booking information card
          bookingInfoCard.style.display = 'none';
          // Remove selection highlight
          document.querySelectorAll('.booking-card').forEach(c => c.classList.remove('selected'));
          // Clear the form ID
          bookingForm.dataset.id = '';
          console.log('Admin: Booking card hidden');
          return;
        }
        
        // Highlight selected
        document.querySelectorAll('.booking-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        populateBookingInfo(booking);
      });
    });

    // Helper for POST JSON used by Approve / Deny
    async function postJSON(url) {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      let data = {};
      try {
        data = await res.json();
      } catch (e) {
        // ignore parse errors
      }

      if (!res.ok || data.success === false || data.ok === false) {
        const msg =
          data.error || data.message || `Request failed: ${res.status}`;
        throw new Error(msg);
      }

      return data;
    }

    // Helper to check if bookings list is empty and show message
    function checkAndShowEmptyMessage() {
      const bookingsList = document.getElementById('bookingsList');
      if (!bookingsList) return;
      
      const remainingCards = bookingsList.querySelectorAll('.booking-card');
      if (remainingCards.length === 0) {
        bookingsList.innerHTML = '<div style="color: #6c757d; background: #f8f9fa; border: 1px solid #e9ecef; padding: 10px; border-radius: 8px; margin-bottom: 1rem;">No bookings to approve.</div>';
      }
    }

    // Approve (Confirm Reservation) for pending bookings
    if (confirmBtn && !confirmBtn.dataset.bound) {
      confirmBtn.dataset.bound = "true";
      confirmBtn.addEventListener("click", async () => {
        const id = bookingForm.dataset.id;
        if (!id) {
          alert("Select a booking first.");
          return;
        }

        try {
          console.log(`Admin: approving pending booking ${id}`);
          await postJSON(
            `/api/pending-bookings/${encodeURIComponent(id)}/approve`
          );

          const selector = `.booking-card[data-id="${CSS.escape(id)}"]`;
          const card = document.querySelector(selector);
          if (card) card.remove();

          if (bookingInfoCard) bookingInfoCard.style.display = "none";
          bookingForm.dataset.id = "";
          
          // Check if list is now empty and show message
          checkAndShowEmptyMessage();

          alert("Booking approved and moved to confirmed bookings.");
        } catch (err) {
          console.error("Error approving pending booking:", err);
          alert(`Error approving booking: ${err.message}`);
        }
      });
    }

    // Deny pending booking
    if (denyBtn && !denyBtn.dataset.bound) {
      denyBtn.dataset.bound = "true";
      denyBtn.addEventListener("click", async () => {
        const id = bookingForm.dataset.id;
        if (!id) {
          alert("Select a booking first.");
          return;
        }

        try {
          console.log(`Admin: denying pending booking ${id}`);
          await postJSON(
            `/api/pending-bookings/${encodeURIComponent(id)}/deny`
          );

          const selector = `.booking-card[data-id="${CSS.escape(id)}"]`;
          const card = document.querySelector(selector);
          if (card) card.remove();

          if (bookingInfoCard) bookingInfoCard.style.display = "none";
          bookingForm.dataset.id = "";
          
          // Check if list is now empty and show message
          checkAndShowEmptyMessage();

          alert("Booking denied and removed.");
        } catch (err) {
          console.error("Error denying pending booking:", err);
          alert(`Error denying booking: ${err.message}`);
        }
      });
    }


  // Helper to switch between display and edit mode (scoped to admin)
  function setBookingFormEditable(editable) {
    if (!bookingForm) return;
    const fields = [
      { id: 'date', type: 'date' },
      { id: 'time', type: 'custom-time' },
      { id: 'repeat', type: 'select' },
      { id: 'name', type: 'text' },
      { id: 'email', type: 'email' },
      { id: 'purpose', type: 'text' },
      { id: 'roomId', type: 'dropdown' }
    ];
    fields.forEach(async f => {
      const el = bookingForm.querySelector(`#${f.id}`);
    if (!el) return;
    if (editable) {
      let newEl;
      if (f.type === 'select') {
        newEl = document.createElement('select');
        newEl.className = 'form-select';
        newEl.id = f.id;
        ['Never', 'Weekly', 'Monthly'].forEach(opt => {
          const o = document.createElement('option');
          o.textContent = opt;
          o.value = opt;
          newEl.appendChild(o);
        });
        newEl.value = el.textContent || 'Never';
        el.replaceWith(newEl);
        return;
      } else if (f.type === 'dropdown') {
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

  // Note: Edit and cancel button handlers are now inside initAdminBookingManagement function

    // Edit button handler
    let isEditing = false;
    if (editBtn) {
      editBtn.addEventListener('click', async () => {
        if (!isEditing) {
          // Enter edit mode
          setBookingFormEditable(true);
          editBtn.textContent = 'Save';
          isEditing = true;
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
            const el = bookingForm.querySelector(`#${id}`);
            return el ? (el.tagName === 'SELECT' ? el.value : el.value) : '';
          };
          const updated = {
            date: getVal('date'),
            timeRange: getVal('time'),
            repeat: getVal('repeat'),
            email: getVal('email'),
            purpose: getVal('purpose'),
            roomId: getVal('roomId'),
            userId: getVal('name'),
            name: getVal('name')
          };
          if (updated.timeRange === null) return;
          try {
            const response = await fetch(`/update_booking/${bookingId}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(updated)
            });
            const result = await response.json();
            if (result.success) {
              setBookingFormEditable(false);
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
              editBtn.textContent = 'Edit Reservation';
              isEditing = false;
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
      cancelBtn.addEventListener('click', async () => {
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
            if (bookingForm) {
              bookingForm.reset();
              bookingForm.dataset.id = "";
            }
          } else {
            alert("Error canceling booking: " + (result.error || "unknown error"));
          }
        } catch (err) {
          console.error("Admin: Error deleting booking:", err);
          alert("Failed to cancel booking.");
        }
      });
    }

    return true;
  }

  // Try to initialize immediately
  if (initAdminBookingManagement()) {
    return;
  }

  // If not ready, wait for content to load
  [100, 300, 500, 1000, 2000].forEach(delay => {
    setTimeout(() => {
      if (!document.getElementById('mybookings-root')) {
        initAdminBookingManagement();
      }
    }, delay);
  });

  // Also watch for content to load
  const observer = new MutationObserver(() => {
    if (!document.getElementById('mybookings-root')) {
      if (initAdminBookingManagement()) {
        observer.disconnect();
      }
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
})(); // End of admin-only booking management IIFE


  /* ==============================
      Room Management Modal
  ============================== */
async function initAdminTools() {
  const listWrap = document.getElementById("roomsList");
  const addBtn = document.getElementById("addRoomBtn");
  const refreshBtn = document.getElementById("refreshRoomsBtn");

  const inputName = document.getElementById("newRoomName");
  const inputDesc = document.getElementById("newRoomDescription");
  const inputActive = document.getElementById("newRoomActive");
  const roomsMessage = document.getElementById("roomsMessage");

  const modalEl = document.getElementById("addRoomModal");
  const modal = modalEl ? new bootstrap.Modal(modalEl, { 
    backdrop: true,
    keyboard: true
  }) : null;

  if (!listWrap) return;

  function renderRooms(rooms) {
    listWrap.innerHTML = "";

    if (!rooms || rooms.length === 0) {
      listWrap.innerHTML =
        '<div class="text-muted small">No rooms found.</div>';
      return;
    }

    rooms.forEach((r) => {
      const row = document.createElement("div");
      row.className =
        "d-flex align-items-start justify-content-between mb-2 p-2 rounded";
      row.style.border = "1px solid rgba(0,0,0,0.05)";

      row.innerHTML = `
          <div>
            <div class="fw-semibold">${escapeHtml(r.name || r.id)}</div>
          </div>
        `;

        const actions = document.createElement("div");
        actions.className = "d-flex flex-column align-items-end gap-1";

        const manage = document.createElement("button");
        // Match server template appearance: secondary outline, gear icon, 'Edit' text
        manage.className = "btn btn-sm btn-outline-secondary user-manage-btn";
        manage.innerHTML = `<i class="bi bi-gear me-1"></i>Edit`;
        manage.dataset.id = r.id;
        manage.dataset.name = r.name || r.id;
        // Convert array description to comma-separated string for display
        let descStr = "";
        if (r.room_description) {
          if (Array.isArray(r.room_description)) {
            descStr = r.room_description.join(", ");
          } else {
            descStr = String(r.room_description);
          }
        }
        manage.dataset.description = descStr;
        manage.dataset.active = r.active ? "true" : "false";

      actions.appendChild(manage);
      row.appendChild(actions);
      listWrap.appendChild(row);
    });
  }

  async function loadRooms() {
    showMessage("Loading rooms...");
    try {
      const resp = await fetch("/api/rooms");
      const data = resp.ok ? await resp.json() : null;

      if (!resp.ok) {
        showMessage(data?.error || "Failed to load rooms", true);
        renderRooms([]);
        return;
      }

      // Sort rooms by number (lowest first)
      const rooms = data.rooms || [];
      rooms.sort((a, b) => {
        const nameA = (a.name || a.id || '').toString();
        const nameB = (b.name || b.id || '').toString();
        
        // Extract numeric part from room name (e.g., "127" from "127" or "Room 127")
        const numA = parseInt(nameA.match(/\d+/)?.[0] || '0', 10);
        const numB = parseInt(nameB.match(/\d+/)?.[0] || '0', 10);
        
        // If both have numbers, sort numerically
        if (numA !== 0 || numB !== 0) {
          return numA - numB;
        }
        
        // Otherwise, sort alphabetically
        return nameA.localeCompare(nameB);
      });

      renderRooms(rooms);
      showMessage("");
    } catch (err) {
      console.error("loadRooms error:", err);
      showMessage("Failed to load rooms (network error)", true);
      renderRooms([]);
    }
  }

  if (addBtn) {
    addBtn.addEventListener("click", async () => {
      const name = inputName?.value.trim();
      const desc = inputDesc?.value.trim();
      const active = inputActive?.checked;

      if (!name) {
        showMessage("Room name is required", true);
        return;
      }

      const payload = { name, room_description: desc, active };

      try {
        const resp = await fetch("/api/rooms", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const data = await resp.json().catch(() => ({}));

        if (!resp.ok) {
          showMessage(data.error || "Failed to add room", true);
          return;
        }

        showMessage("Room added");

        // Reset inputs
        inputName.value = "";
        inputDesc.value = "";
        inputActive.checked = true;

        // Hide modal normally
        modal?.hide();

        await loadRooms();
      } catch (err) {
        console.error("addRoom error:", err);
        showMessage("Failed to add room (network error)", true);
      }
    });
  }


  /* ==============================
      Add user modal
  ============================== */
  const usersListWrap = document.getElementById("usersList");
  const addUserBtn = document.getElementById("addUserBtn");
  const addUserModalEl = document.getElementById("addUserModal");
  const addUserNameInput = document.getElementById("addUserName");
  const addUserEmailInput = document.getElementById("addUserEmail");
  const addUserRoleSelect = document.getElementById("addUserRole");
  const addUserMessage = document.getElementById("addUserMessage");
  const addUserModal = addUserModalEl ? new bootstrap.Modal(addUserModalEl, {
    backdrop: true,
    keyboard: true
  }) : null;

  function showAddUserMessage(msg, isError = false) {
    if (!addUserMessage) return;
    addUserMessage.textContent = msg || '';
    if (isError) {
      addUserMessage.style.color = '#F28380';
      addUserMessage.classList.remove('text-muted');
    } else {
      addUserMessage.style.color = '#666';
      addUserMessage.classList.add('text-muted');
    }
  }

  function renderUsers(users) {
    if (!usersListWrap) return;
    usersListWrap.innerHTML = "";

    if (!users || users.length === 0) {
      usersListWrap.innerHTML = '<div class="text-muted small">No users found.</div>';
      return;
    }

    users.forEach((u) => {
      const row = document.createElement("div");
      row.className = "d-flex align-items-start justify-content-between mb-2 p-2 rounded";
      row.style.border = "1px solid rgba(0,0,0,0.05)";

      const leftSide = document.createElement("div");
      leftSide.className = "flex-grow-1 text-start";
      leftSide.innerHTML = `
        <div class="fw-semibold">${escapeHtml(u.name || u.email)}</div>
        <div class="small text-muted">${escapeHtml(u.email)}</div>
        <div class="small text-muted">Role: ${escapeHtml(u.role || 'student')}</div>
      `;

      const actions = document.createElement("div");
      actions.className = "d-flex flex-column align-items-end gap-1";

      const manage = document.createElement("button");
      manage.className = "btn btn-sm btn-outline-secondary user-manage-btn";
      manage.innerHTML = `<i class="bi bi-gear me-1"></i>Edit`;
      manage.dataset.email = u.email;

      actions.appendChild(manage);
      row.appendChild(leftSide);
      row.appendChild(actions);
      usersListWrap.appendChild(row);
    });
  }

  async function loadUsers() {
    if (!usersListWrap) return;
    try {
      const resp = await fetch("/api/users");
      const data = resp.ok ? await resp.json() : null;

      if (!resp.ok) {
        console.error("Failed to load users:", data?.error);
        renderUsers([]);
        return;
      }

      renderUsers(data.users || []);
    } catch (err) {
      console.error("loadUsers error:", err);
      renderUsers([]);
    }
  }

  if (addUserBtn) {
    addUserBtn.addEventListener("click", async () => {
      const name = addUserNameInput?.value.trim();
      const email = addUserEmailInput?.value.trim();
      const role = addUserRoleSelect?.value || 'student';

      if (!name) {
        showAddUserMessage("Name is required", true);
        return;
      }

      if (!email) {
        showAddUserMessage("Email is required", true);
        return;
      }

      if (!email.endsWith("@uoregon.edu")) {
        showAddUserMessage("Email must end with @uoregon.edu", true);
        return;
      }

      const payload = { name, email: email.toLowerCase(), role };

      try {
        const resp = await fetch("/api/add-user", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const data = await resp.json().catch(() => ({}));

        if (!resp.ok || !data.ok) {
          showAddUserMessage(data.error || "Failed to add user", true);
          return;
        }

        showAddUserMessage("User added successfully");

        // Reset inputs
        addUserNameInput.value = "";
        addUserEmailInput.value = "";
        addUserRoleSelect.value = "student";

        // Hide modal and reload users list
        setTimeout(() => {
          addUserModal?.hide();
          loadUsers();
        }, 500);
      } catch (err) {
        console.error("addUser error:", err);
        showAddUserMessage("Failed to add user (network error)", true);
      }
    });
  }

  // Reset modal when opened
  if (addUserModalEl) {
    addUserModalEl.addEventListener("show.bs.modal", () => {
      if (addUserNameInput) addUserNameInput.value = "";
      if (addUserEmailInput) addUserEmailInput.value = "";
      if (addUserRoleSelect) addUserRoleSelect.value = "student";
      showAddUserMessage("");
    });
  }

  // Manage room modal setup
  let manageModalEl = null;
  let manageRoomName = null;
  let manageRoomDesc = null;
  let manageRoomActive = null;
  let manageRoomMessage = null;
  let deleteRoomBtn = null;
  let changeRoomBtn = null;

  let currentRoomId = null;

  // Function to initialize modal elements (call after DOM is ready)
  function initManageModalElements() {
    manageModalEl = document.getElementById("manageRoomModal");
    manageRoomName = document.getElementById("manageRoomName");
    manageRoomDesc = document.getElementById("manageRoomDescription");
    manageRoomActive = document.getElementById("manageRoomActive");
    manageRoomMessage = document.getElementById("manageRoomMessage");
    deleteRoomBtn = document.getElementById("deleteRoomBtn");
    changeRoomBtn = document.getElementById("changeRoomBtn");
  }

  // Function to get or create modal instance
  function getManageModalInstance() {
    if (!manageModalEl) {
      initManageModalElements();
    }
    if (!manageModalEl) {
      console.error("manageRoomModal element not found");
      return null;
    }
    if (window.bootstrap && bootstrap.Modal) {
      return bootstrap.Modal.getInstance(manageModalEl) || new bootstrap.Modal(manageModalEl, {
        backdrop: true,
        keyboard: true
      });
    }
    console.error("Bootstrap Modal not available");
    return null;
  }

  // Initialize modal elements
  initManageModalElements();

/* ==============================
    Manage User Modal
============================== */
  let userModalEl = null;
  let userNameInput = null;
  let userEmailInput = null;
  let userRoleSelect = null;
  let deleteUserBtnEl = null;
  let changeUserBtnEl = null;
  let userModalMessage = null;

  let currentUserEmail = null;

  function initUserModalElements() {
    userModalEl = document.getElementById('userModal');
    userNameInput = document.getElementById('userId');
    userEmailInput = document.getElementById('userEmail');
    userRoleSelect = document.getElementById('userRole');
    deleteUserBtnEl = document.getElementById('deleteUserBtn');
    changeUserBtnEl = document.getElementById('changeUserBtn');
    userModalMessage = document.getElementById('userModalMessage');
  }

  function getUserModalInstance() {
    if (!userModalEl) initUserModalElements();
    if (!userModalEl) return null;
    return bootstrap.Modal.getInstance(userModalEl) || new bootstrap.Modal(userModalEl, { backdrop: true, keyboard: true });
  }

  // Ensure user modal elements are initialized and move modals to body
  function moveModalToBody(el) {
    if (!el) return;
    try {
      if (el.parentElement !== document.body) {
        document.body.appendChild(el);
      }
    } catch (err) {
      console.warn('Could not move modal to body', err, el);
    }
  }

  // initialize user modal references now that variables are declared
  initUserModalElements();
  moveModalToBody(document.getElementById('addRoomModal'));
  moveModalToBody(document.getElementById('manageRoomModal'));
  moveModalToBody(document.getElementById('userModal'));
  moveModalToBody(document.getElementById('addUserModal'));

  // Handle Manage button clicks - open modal with room data
  listWrap.addEventListener("click", (e) => {
    // Accept either room-manage-btn (preferred) or user-manage-btn (templates may vary)
    const btn = e.target.closest(".room-manage-btn, .user-manage-btn");
    if (!btn) return;

    // Ensure this button has an id (rooms have data-id). If not, ignore.
    if (!btn.dataset || !btn.dataset.id) {
      console.warn("Manage button clicked but missing data-id, ignoring", btn);
      return;
    }

    e.preventDefault();
    e.stopPropagation();

    console.log("Manage button clicked", btn);

    currentRoomId = btn.dataset.id;
    const roomName = btn.dataset.name || btn.dataset.id || "";
    const roomDesc = btn.dataset.description || "";
    const roomActive = btn.dataset.active === "true";

    console.log("Room data:", { currentRoomId, roomName, roomDesc, roomActive });

    // Ensure modal elements are initialized
    if (!manageRoomName || !manageRoomDesc || !manageRoomActive) {
      initManageModalElements();
    }

    // Populate modal with room data
    if (manageRoomName) manageRoomName.value = roomName;
    if (manageRoomDesc) manageRoomDesc.value = roomDesc;
    if (manageRoomActive) manageRoomActive.checked = roomActive;
    if (manageRoomMessage) manageRoomMessage.textContent = "";

    // Open the modal
    const modalInstance = getManageModalInstance();
    if (modalInstance) {
      console.log("Opening modal");
      modalInstance.show();
    } else {
      console.error("Could not open modal. Bootstrap or modal element not found.", {
        manageModalEl: !!manageModalEl,
        bootstrap: !!window.bootstrap,
        bootstrapModal: !!(window.bootstrap && bootstrap.Modal)
      });
    }
  });

    // Users: open user modal when Edit clicked
    const usersListEl = document.getElementById('usersList');
    if (usersListEl) {
      usersListEl.addEventListener('click', (e) => {
        const btn = e.target.closest('.user-manage-btn');
        if (!btn) return;

        e.preventDefault();
        e.stopPropagation();

        // Ensure user modal elements are ready
        if (!userModalEl) initUserModalElements();
        if (!userModalEl) {
          console.error('User modal element (#userModal) not found in DOM');
          return;
        }

        // Find the containing row to extract displayed values
        // btn is inside .d-flex.flex-column, which is inside the main row .d-flex
        const mainRow = btn.closest('.d-flex.align-items-start.justify-content-between');
        console.log('Main row found:', mainRow);
        
        // Look inside the row's left side (flex-grow-1) for name and email/role
        const leftSide = mainRow ? mainRow.querySelector('.flex-grow-1') : null;
        console.log('Left side found:', leftSide);
        
        const nameEl = leftSide ? leftSide.querySelector('.fw-semibold') : null;
        const textMutedEls = leftSide ? leftSide.querySelectorAll('.small.text-muted') : [];

        // Extract name (first fw-semibold)
        const displayName = nameEl ? nameEl.textContent.trim() : '';

        // Extract email (first .small.text-muted)
        const displayEmail = textMutedEls.length > 0 ? textMutedEls[0].textContent.trim() : '';

        // Extract role (second .small.text-muted, strip "Role: " prefix)
        let displayRole = '';
        if (textMutedEls.length > 1) {
          const txt = textMutedEls[1].textContent || '';
          displayRole = txt.replace(/^Role:\s*/i, '').trim();
        }

        console.log('User modal population:', { displayName, displayEmail, displayRole, nameEl, textMutedEls });

        // Set current user email for delete/update operations
        currentUserEmail = displayEmail || btn.dataset.email || '';

        if (userNameInput) userNameInput.value = displayName || '';
        if (userEmailInput) userEmailInput.value = displayEmail || '';
        if (userRoleSelect) userRoleSelect.value = displayRole || 'student';
        if (userModalMessage) userModalMessage.textContent = '';

        const instance = getUserModalInstance();
        if (instance) instance.show();
      });
    }

  // Handle delete button in modal
  if (deleteRoomBtn) {
    deleteRoomBtn.addEventListener("click", async () => {
      if (!currentRoomId) return;
      
      const roomName = manageRoomName?.value || currentRoomId;
      const ok = confirm(
        `Delete room "${roomName}"?\nThis action cannot be undone.`
      );
      if (!ok) return;

      try {
        const resp = await fetch(`/api/rooms/${encodeURIComponent(currentRoomId)}`, {
          method: "DELETE",
        });

        const data = await resp.json().catch(() => ({}));

        if (!resp.ok) {
          if (manageRoomMessage) {
            manageRoomMessage.textContent = data.error || "Failed to delete room";
            manageRoomMessage.style.color = "#F28380";
            manageRoomMessage.classList.remove('text-muted');
          }
          return;
        }

        if (manageRoomMessage) {
          manageRoomMessage.textContent = "Room deleted";
          manageRoomMessage.style.color = "#666";
          manageRoomMessage.classList.add('text-muted');
        }

        // Close modal and reload rooms
        const modalInstance = getManageModalInstance();
        if (modalInstance) modalInstance.hide();
        await loadRooms();
        currentRoomId = null;
      } catch (err) {
        console.error("deleteRoom error:", err);
        if (manageRoomMessage) {
          manageRoomMessage.textContent = "Failed to delete room (network error)";
          manageRoomMessage.style.color = "#F28380";
          manageRoomMessage.classList.remove('text-muted');
        }
      }
    });
  }

  // Handle delete user button in modal
  if (deleteUserBtnEl) {
    deleteUserBtnEl.addEventListener("click", async () => {
      if (!currentUserEmail) return;
      
      const userName = userNameInput?.value || currentUserEmail;
      const ok = confirm(
        `Delete user "${userName}"?\nThis action cannot be undone.`
      );
      if (!ok) return;

      try {
        const resp = await fetch(`/api/users/${encodeURIComponent(currentUserEmail)}`, {
          method: "DELETE",
        });

        const data = await resp.json().catch(() => ({}));

        if (!resp.ok) {
          if (userModalMessage) {
            userModalMessage.textContent = data.error || "Failed to delete user";
            userModalMessage.style.color = "#F28380";
            userModalMessage.classList.remove('text-muted');
          }
          return;
        }

        if (userModalMessage) {
          userModalMessage.textContent = "User deleted";
          userModalMessage.style.color = "#666";
          userModalMessage.classList.add('text-muted');
        }

        // Close modal and reload users
        const modalInstance = getUserModalInstance();
        if (modalInstance) modalInstance.hide();
        await loadUsers();
        currentUserEmail = null;
      } catch (err) {
        console.error("deleteUser error:", err);
        if (userModalMessage) {
          userModalMessage.textContent = "Failed to delete user (network error)";
          userModalMessage.style.color = "#F28380";
          userModalMessage.classList.remove('text-muted');
        }
      }
    });
  }

  // Handle confirm changes button for user modal
  if (!changeUserBtnEl) {
    initUserModalElements();
  }
  if (changeUserBtnEl) {
    changeUserBtnEl.addEventListener("click", async () => {
      if (!currentUserEmail) return;

      const name = userNameInput?.value.trim();
      const email = userEmailInput?.value.trim().toLowerCase();
      const role = userRoleSelect?.value || 'student';

      if (!name) {
        if (userModalMessage) {
          userModalMessage.textContent = "Name is required";
          userModalMessage.style.color = "#F28380";
          userModalMessage.classList.remove('text-muted');
        }
        return;
      }

      if (!email) {
        if (userModalMessage) {
          userModalMessage.textContent = "Email is required";
          userModalMessage.style.color = "#F28380";
          userModalMessage.classList.remove('text-muted');
        }
        return;
      }

      if (!email.endsWith("@uoregon.edu")) {
        if (userModalMessage) {
          userModalMessage.textContent = "Email must end with @uoregon.edu";
          userModalMessage.style.color = "#F28380";
          userModalMessage.classList.remove('text-muted');
        }
        return;
      }

      const payload = { name, email, role };

      try {
        const resp = await fetch(`/api/users/${encodeURIComponent(currentUserEmail)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const data = await resp.json().catch(() => ({}));

        if (!resp.ok) {
          if (userModalMessage) {
            userModalMessage.textContent = data.error || "Failed to update user";
            userModalMessage.style.color = "#F28380";
            userModalMessage.classList.remove('text-muted');
          }
          return;
        }

        if (userModalMessage) {
          userModalMessage.textContent = "User updated";
          userModalMessage.style.color = "#666";
          userModalMessage.classList.add('text-muted');
        }

        // Close modal and reload users
        setTimeout(async () => {
          const modalInstance = getUserModalInstance();
          if (modalInstance) modalInstance.hide();
          await loadUsers();
          currentUserEmail = null;
        }, 500);
      } catch (err) {
        console.error("updateUser error:", err);
        if (userModalMessage) {
          userModalMessage.textContent = "Failed to update user (network error)";
          userModalMessage.style.color = "#F28380";
          userModalMessage.classList.remove('text-muted');
        }
      }
    });
  }

  // Handle confirm changes button in modal
  if (changeRoomBtn) {
    changeRoomBtn.addEventListener("click", async () => {
      if (!currentRoomId) return;

      const name = manageRoomName?.value.trim();
      const desc = manageRoomDesc?.value.trim();
      const active = manageRoomActive?.checked;

      if (!name) {
        if (manageRoomMessage) {
          manageRoomMessage.textContent = "Room name is required";
          manageRoomMessage.style.color = "#F28380";
          manageRoomMessage.classList.remove('text-muted');
        }
        return;
      }

      const payload = { name, room_description: desc, active };

      try {
        const resp = await fetch(`/api/rooms/${encodeURIComponent(currentRoomId)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const data = await resp.json().catch(() => ({}));

        if (!resp.ok) {
          if (manageRoomMessage) {
            manageRoomMessage.textContent = data.error || "Failed to update room";
            manageRoomMessage.style.color = "#F28380";
            manageRoomMessage.classList.remove('text-muted');
          }
          return;
        }

        if (manageRoomMessage) {
          manageRoomMessage.textContent = "Room updated";
          manageRoomMessage.style.color = "#666";
          manageRoomMessage.classList.add('text-muted');
        }

        // Close modal and reload rooms
        setTimeout(async () => {
          const modalInstance = getManageModalInstance();
          if (modalInstance) modalInstance.hide();
          await loadRooms();
          currentRoomId = null;
        }, 500);
      } catch (err) {
        console.error("updateRoom error:", err);
        if (manageRoomMessage) {
          manageRoomMessage.textContent = "Failed to update room (network error)";
          manageRoomMessage.style.color = "#F28380";
          manageRoomMessage.classList.remove('text-muted');
        }
      }
    });
  }

  refreshBtn?.addEventListener("click", loadRooms); // refresh

  if (modalEl) { // reset modal when opened
    modalEl.addEventListener("show.bs.modal", () => {
      inputName.value = "";
      inputDesc.value = "";
      inputActive.checked = true;
      roomsMessage.textContent = "";
    });
  }

  await loadRooms();

  /* ==============================
      Closure Management
  ============================== */
  const closureListWrap = document.getElementById("closureList");
  const addClosureBtn = document.getElementById("addClosureBtn");

  const inputClosureName = document.getElementById("newClosureName");
  const inputClosureDate = document.getElementById("newClosureDate");
  const inputClosureDesc = document.getElementById("newClosureDescription");
  const closuresMessage = document.getElementById("closuresMessage");

  const addClosureModalEl = document.getElementById("addClosureModal");

  if (!closureListWrap) {
    console.warn("Closure list wrapper not found");
  } else {
    function showClosureMessage(msg, isError = false) {
      if (!closuresMessage) return;
      closuresMessage.textContent = msg || '';
      if (isError) {
        closuresMessage.style.color = '#F28380';
        closuresMessage.classList.remove('text-muted');
      } else {
        closuresMessage.style.color = '#666';
        closuresMessage.classList.add('text-muted');
      }
    }

    function renderClosures(closures) {
      closureListWrap.innerHTML = "";

      if (!closures || closures.length === 0) {
        closureListWrap.innerHTML =
          '<div style="color: #6c757d; background: #f8f9fa; border: 1px solid #e9ecef; padding: 10px; border-radius: 8px; margin-bottom: 1rem;">No closures found.</div>';
        return;
      }

      closures.forEach((c) => {
        const row = document.createElement("div");
        row.className =
          "d-flex align-items-start justify-content-between mb-2 p-2 rounded";
        row.style.border = "1px solid rgba(0,0,0,0.05)";

        const leftSide = document.createElement("div");
        leftSide.className = "flex-grow-1 text-start";
        leftSide.innerHTML = `
          ${c.date ? `<div class="fw-semibold">${escapeHtml(c.date)}</div>` : ''}
          <div class="small text-muted">${escapeHtml(c.name || c.id)}</div>
        `;

        const actions = document.createElement("div");
        actions.className = "d-flex flex-column align-items-end gap-1";

        const deleteBtn = document.createElement("button");
        deleteBtn.className = "btn btn-sm btn-outline-red closure-delete-btn";
        deleteBtn.innerHTML = `<i class="bi bi-trash me-1"></i>Delete`;
        deleteBtn.dataset.id = c.id;
        deleteBtn.dataset.name = c.name || c.id;
        deleteBtn.dataset.date = c.date || '';

        actions.appendChild(deleteBtn);
        row.appendChild(leftSide);
        row.appendChild(actions);
        closureListWrap.appendChild(row);
      });
    }

    async function loadClosures() {
      showClosureMessage("Loading closures...");
      try {
        const resp = await fetch("/api/closures");
        const data = resp.ok ? await resp.json() : null;

        if (!resp.ok) {
          showClosureMessage(data?.error || "Failed to load closures", true);
          renderClosures([]);
          return;
        }

        const closures = data.closures || [];
        // Sort closures by date (most recent first)
        closures.sort((a, b) => {
          const dateA = a.date || '';
          const dateB = b.date || '';
          return dateB.localeCompare(dateA);
        });

        renderClosures(closures);
        showClosureMessage("");
      } catch (err) {
        console.error("loadClosures error:", err);
        showClosureMessage("Failed to load closures (network error)", true);
        renderClosures([]);
      }
    }

    if (addClosureBtn) {
      addClosureBtn.addEventListener("click", async () => {
        const name = inputClosureName?.value.trim();
        const date = inputClosureDate?.value.trim();
        const description = inputClosureDesc?.value.trim();

        if (!name) {
          showClosureMessage("Closure name is required", true);
          return;
        }

        if (!date) {
          showClosureMessage("Date is required", true);
          return;
        }

        const payload = { name, date, description };

        try {
          const resp = await fetch("/api/closures", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });

          const data = await resp.json().catch(() => ({}));

          if (!resp.ok) {
            showClosureMessage(data.error || "Failed to add closure", true);
            return;
          }

          showClosureMessage("Closure added");

          // Reset inputs
          inputClosureName.value = "";
          inputClosureDate.value = "";
          inputClosureDesc.value = "";

          // Hide modal
          const modalInstance = bootstrap.Modal.getInstance(addClosureModalEl);
          if (modalInstance) modalInstance.hide();

          await loadClosures();
        } catch (err) {
          console.error("addClosure error:", err);
          showClosureMessage("Failed to add closure (network error)", true);
        }
      });
    }

    // Handle delete button clicks
    closureListWrap.addEventListener("click", async (e) => {
      const btn = e.target.closest(".closure-delete-btn");
      if (!btn) return;

      e.preventDefault();
      e.stopPropagation();

      const closureId = btn.dataset.id;
      const closureName = btn.dataset.name || closureId;
      const closureDate = btn.dataset.date || '';

      if (!closureId) {
        console.warn("Delete button clicked but missing data-id", btn);
        return;
      }

      // Build display text - use date if available, otherwise use name
      const displayText = closureDate ? `${closureDate} (${closureName})` : closureName;
      const ok = confirm(
        `Are you sure you want to delete this closure?\n\nClosure: ${displayText}\nThis action cannot be undone.`
      );
      if (!ok) return;

      try {
        const resp = await fetch(`/api/closures/${encodeURIComponent(closureId)}`, {
          method: "DELETE",
        });

        const data = await resp.json().catch(() => ({}));

        if (!resp.ok) {
          alert(data.error || "Failed to delete closure");
          return;
        }

        await loadClosures();
      } catch (err) {
        console.error("deleteClosure error:", err);
        alert("Failed to delete closure (network error)");
      }
    });

    if (addClosureModalEl) {
      addClosureModalEl.addEventListener("show.bs.modal", () => {
        if (inputClosureName) inputClosureName.value = "";
        if (inputClosureDate) inputClosureDate.value = "";
        if (inputClosureDesc) inputClosureDesc.value = "";
        showClosureMessage("");
      });
    }

    moveModalToBody(document.getElementById('addClosureModal'));

    await loadClosures();
  }
}

// Expose initializer so the dynamic tab loader can call it after injecting admin HTML
window.initAdminTools = initAdminTools;

// Auto-run when admin content already present on page
if (document.readyState !== 'loading') {
  if (document.getElementById('roomsList')) {
    initAdminTools().catch(err => console.error('initAdminTools error:', err));
  }
} else {
  document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('roomsList')) {
      initAdminTools().catch(err => console.error('initAdminTools error:', err));
    }
  });
}

/* ==============================
    Admin Page Booking Card Clicks (Same as MyBookings)
============================== */
(function() {
  // Don't run if on mybookings page
  if (document.getElementById('mybookings-root')) {
    return;
  }

  function setupAdminBookingClicks() {
    const bookingCards = document.querySelectorAll('.booking-card');
    const bookingForm = document.getElementById('bookingForm');
    
    if (!bookingForm) {
      return false; // Form not loaded yet
    }

    if (!bookingCards.length) {
      console.warn("Admin: No booking cards found");
      return true;
    }

    console.log(`Admin: Found ${bookingCards.length} booking cards`);

    // Add click listeners to booking cards (same as mybookings)
    bookingCards.forEach(card => {
      // Skip if already has click handler
      if (card.dataset.adminClickBound === 'true') {
        return;
      }
      card.dataset.adminClickBound = 'true';
      
      card.addEventListener('click', () => {
        console.log(`Admin: Clicked booking ${card.dataset.id}`);

        const bookingInfoCard = document.getElementById('bookingInfoCard');
        const currentBookingId = bookingForm.dataset.id;
        const clickedBookingId = card.dataset.id;

        // Check if the same booking is clicked again
        if (currentBookingId === clickedBookingId && bookingInfoCard && bookingInfoCard.style.display === 'block') {
          // Hide the booking information card
          bookingInfoCard.style.display = 'none';
          // Remove selection highlight
          document.querySelectorAll('.booking-card').forEach(c => c.classList.remove('selected'));
          // Clear the form ID
          bookingForm.dataset.id = '';
          console.log('Admin: Booking card hidden');
          return;
        }

        // Highlight selected
        document.querySelectorAll('.booking-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');

        // Parse structured booking data
        let bookingData = {};
        try {
          if (card.dataset.booking) bookingData = JSON.parse(card.dataset.booking);
        } catch (err) {
          console.warn('Could not parse data-booking JSON, falling back to data-* attributes', err);
          bookingData = {};
        }

        // Save the ID
        bookingForm.dataset.id = bookingData.id || card.dataset.id || '';

        // Handle the date format safely
        let dateValue = bookingData.date || card.dataset.date || '';
        if (dateValue) {
          const parsed = new Date(dateValue);
          if (!isNaN(parsed)) dateValue = parsed;
          else {
            console.warn('Could not parse date:', bookingData.date || card.dataset.date);
            dateValue = null;
          }
        }

        // Populate <span> fields for non-editable display
        const setSpan = (id, value) => {
          const el = bookingForm.querySelector(`#${id}`) || document.getElementById(id);
          if (el) el.textContent = value || '';
        };

        setSpan('date', bookingData.date || card.dataset.date || '');
        setSpan('time', bookingData.time || card.dataset.time || '');
        setSpan('repeat', bookingData.repeat || card.dataset.repeat || 'Never');
        setSpan('name', bookingData.name || bookingData.userId || card.dataset.name || '');
        setSpan('email', bookingData.email || card.dataset.email || '');
        setSpan('purpose', bookingData.purpose || card.dataset.purpose || '');
        setSpan('roomId', bookingData.roomId || card.dataset.roomid || '');

        // Show the booking information card
        if (bookingInfoCard) {
          bookingInfoCard.style.display = 'block';
        }

        console.log('Admin: Form populated with:', {
          id: bookingForm.dataset.id,
          date: bookingData.date || card.dataset.date,
          time: bookingData.time || card.dataset.time,
          repeat: bookingData.repeat || card.dataset.repeat,
          email: bookingData.email || card.dataset.email,
          purpose: bookingData.purpose || card.dataset.purpose,
          roomId: bookingData.roomId || card.dataset.roomid
        });
      });
    });

    return true;
  }

  // Try to set up immediately
  if (setupAdminBookingClicks()) {
    return;
  }

  // If not ready, wait for content to load
  [100, 300, 500, 1000, 2000].forEach(delay => {
    setTimeout(() => {
      if (!document.getElementById('mybookings-root')) {
        setupAdminBookingClicks();
      }
    }, delay);
  });

  // Watch for dynamically added booking cards
  const bookingsList = document.getElementById('bookingsList');
  if (bookingsList) {
    const observer = new MutationObserver(() => {
      if (!document.getElementById('mybookings-root')) {
        setupAdminBookingClicks();
      }
    });
    observer.observe(bookingsList, { childList: true, subtree: true });
  }
})();

/* ==============================
    Account Management - User Search
============================== */
document.addEventListener("DOMContentLoaded", function () {
    const userSearchInput = document.getElementById("userSearch");
    const usersList = document.getElementById("usersList");

    userSearchInput.addEventListener("input", function () {
        const searchValue = userSearchInput.value.toLowerCase().trim();

        // Get all user items
        const userItems = usersList.querySelectorAll("div.d-flex");

        userItems.forEach(item => {
            const name = item.querySelector(".fw-semibold")?.textContent.toLowerCase() || "";
            const email = item.querySelector(".small.text-muted")?.textContent.toLowerCase() || "";

            // Match name OR email
            if (name.includes(searchValue) || email.includes(searchValue)) {
                item.style.display = "flex";  // show it
            } else {
                item.style.display = "none";  // hide it
            }
        });
    });
});