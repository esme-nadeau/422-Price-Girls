// /* ==============================
//     MyBookings.js duplicate
// ============================== */
// if (!document.getElementById("admin-page-root")) {
//   console.log("admin.js: exiting (not on admin page)");
//   return;
// }
// else {  console.log("admin.js: running (on admin page)");
// }

// // Initialize Flatpickr on the date field
// const dateInput = document.getElementById('date');
// let datePicker = null;
// if (dateInput) {
//   datePicker = flatpickr(dateInput, { dateFormat: "m/d/Y" });
// } else {
//   console.warn("Date input not found");
// }

// // Grab other elements
// const bookingCards = document.querySelectorAll('.booking-card');
// const bookingForm = document.getElementById('bookingForm');
// const cancelBtn = document.getElementById('cancelBookingBtn');
// const editBtn = document.getElementById('editBookingBtn');

// // Helper to switch between display and edit mode
// function setBookingFormEditable(editable) {
//   const fields = [
//     { id: 'date', type: 'date' },
//     { id: 'time', type: 'custom-time' },
//     { id: 'repeat', type: 'select' },
//     { id: 'name', type: 'text' },
//     { id: 'email', type: 'email' },
//     { id: 'purpose', type: 'text' },
//     { id: 'roomId', type: 'dropdown' }
//   ];
//   fields.forEach(async f => {
//     const el = bookingForm.querySelector(`#${f.id}`) || document.getElementById(f.id);
//     if (!el) return;
//     if (editable) {
//       let newEl;
//       if (f.type === 'select') {
//         newEl = document.createElement('select');
//         newEl.className = 'form-select';
//         newEl.id = f.id;
//         ['Never', 'Weekly', 'Monthly'].forEach(opt => {
//           const o = document.createElement('option');
//           o.textContent = opt;
//           o.value = opt;
//           newEl.appendChild(o);
//         });
//         newEl.value = el.textContent || 'Never';
//         el.replaceWith(newEl);
//         return;
//       } else if (f.type === 'dropdown') {
//         newEl = document.createElement('select');
//         newEl.className = 'form-select';
//         newEl.id = f.id;
//         try {
//           const resp = await fetch('/api/rooms');
//           const data = await resp.json();
//           (data.rooms || []).forEach(room => {
//             const o = document.createElement('option');
//             o.value = room.id;
//             o.textContent = room.name || room.id;
//             newEl.appendChild(o);
//           });
//           newEl.value = el.textContent;
//         } catch (err) {
//           const o = document.createElement('option');
//           o.textContent = el.textContent || 'Unavailable';
//           newEl.appendChild(o);
//         }
//         el.replaceWith(newEl);
//         return;
//       } else if (f.type === 'custom-time') {
//         // Create two dropdowns for start and end time
//         const wrapper = document.createElement('div');
//         wrapper.className = 'd-flex gap-2';
//         // Generate time slots from 8:00 AM to 6:30 PM (last start at 6:30 PM)
//         const slots = [];
//         for (let h = 8; h <= 18; h++) {
//           for (let m = 0; m < 60; m += 30) {
//             let hour = h > 12 ? h - 12 : h;
//             let ampm = h < 12 ? 'AM' : 'PM';
//             let min = m === 0 ? '00' : '30';
//             slots.push(`${hour}:${min} ${ampm}`);
//           }
//         }
//         // Parse current timeRange
//         let startVal = slots[0], endVal = slots[1];
//         if (el.textContent && el.textContent.includes(' - ')) {
//           const [start, end] = el.textContent.split(' - ');
//           startVal = start.trim();
//           endVal = end.trim();
//         }
//         const startSel = document.createElement('select');
//         startSel.className = 'form-select';
//         startSel.id = 'startTime';
//         slots.forEach(s => {
//           const o = document.createElement('option');
//           o.value = s;
//           o.textContent = s;
//           startSel.appendChild(o);
//         });
//         startSel.value = startVal;
//         const endSel = document.createElement('select');
//         endSel.className = 'form-select';
//         endSel.id = 'endTime';
//         slots.forEach(s => {
//           const o = document.createElement('option');
//           o.value = s;
//           o.textContent = s;
//           endSel.appendChild(o);
//         });
//         endSel.value = endVal;
//         // Validation: prevent end before start
//         function validateTimes() {
//           const startIdx = slots.indexOf(startSel.value);
//           const endIdx = slots.indexOf(endSel.value);
//           if (endIdx <= startIdx) {
//             endSel.setCustomValidity('End time must be after start time');
//             endSel.reportValidity();
//           } else {
//             endSel.setCustomValidity('');
//           }
//         }
//         startSel.addEventListener('change', validateTimes);
//         endSel.addEventListener('change', validateTimes);
//         wrapper.appendChild(startSel);
//         wrapper.appendChild(document.createTextNode(' to '));
//         wrapper.appendChild(endSel);
//         el.replaceWith(wrapper);
//       } else {
//         newEl = document.createElement('input');
//         newEl.className = 'form-control';
//         newEl.type = f.type;
//         newEl.id = f.id;
//         newEl.value = el.textContent;
//         el.replaceWith(newEl);
//       }
//     } else {
//       let newEl = document.createElement('span');
//       newEl.className = 'form-control';
//       newEl.id = f.id;
//       newEl.style.background = '#eee';
//       newEl.style.pointerEvents = 'none';
//       newEl.style.userSelect = 'text';
//       if (f.type === 'custom-time') {
//         // Always render as non-interactive span in display mode
//         let startVal = '', endVal = '';
//         if (el.classList.contains('d-flex')) {
//           const startSel = el.querySelector('#startTime');
//           const endSel = el.querySelector('#endTime');
//           if (startSel && endSel) {
//             startVal = startSel.value;
//             endVal = endSel.value;
//           } else {
//             // fallback: try to parse textContent
//             if (el.textContent && el.textContent.includes(' to ')) {
//               const [start, end] = el.textContent.split(' to ');
//               startVal = start.trim();
//               endVal = end.trim();
//             } else {
//               startVal = el.textContent;
//             }
//           }
//         } else {
//           // If not a flex wrapper, just use textContent
//           startVal = el.textContent;
//         }
//         newEl.textContent = startVal && endVal ? `${startVal} - ${endVal}` : startVal;
//         el.replaceWith(newEl);
//         return;
//       } else if (el.tagName === 'SELECT') {
//         newEl.textContent = el.value;
//         el.replaceWith(newEl);
//         return;
//       } else {
//         newEl.textContent = el.value;
//         el.replaceWith(newEl);
//         return;
//       }
//     }
//   });
// }

// // Track edit mode
// let isEditing = false;

// if (editBtn) {
//   editBtn.addEventListener('click', async () => {
//     if (!isEditing) {
//       // Enter edit mode
//       setBookingFormEditable(true);
//       editBtn.textContent = 'Save';
//       isEditing = true;
//     } else {
//       // Save edits
//       const bookingId = bookingForm.dataset.id;
//       if (!bookingId) {
//         alert('No booking selected.');
//         return;
//       }
//       // Gather updated values
//       const getVal = id => {
//         if (id === 'time') {
//           const wrapper = bookingForm.querySelector('.d-flex');
//           const startSel = wrapper ? wrapper.querySelector('#startTime') : null;
//           const endSel = wrapper ? wrapper.querySelector('#endTime') : null;
//           if (startSel && endSel) {
//             // Validate times
//             const slots = Array.from(startSel.options).map(o => o.value);
//             const startIdx = slots.indexOf(startSel.value);
//             const endIdx = slots.indexOf(endSel.value);
//             if (endIdx <= startIdx) {
//               alert('End time must be after start time.');
//               return null;
//             }
//             return `${startSel.value} - ${endSel.value}`;
//           }
//           return '';
//         }
//         const el = bookingForm.querySelector(`#${id}`) || document.getElementById(id);
//         return el ? (el.tagName === 'SELECT' ? el.value : el.value) : '';
//       };
//       const updated = {
//         date: getVal('date'),
//         timeRange: getVal('time'),
//         repeat: getVal('repeat'),
//         email: getVal('email'),
//         purpose: getVal('purpose'),
//         roomId: getVal('roomId'),
//         // Include name/userId so server can update the booking owner info
//         userId: getVal('name'),
//         name: getVal('name')
//       };
//       if (updated.timeRange === null) return; // Invalid time selection
//       try {
//         const response = await fetch(`/update_booking/${bookingId}`, {
//           method: 'POST',
//           headers: { 'Content-Type': 'application/json' },
//           body: JSON.stringify(updated)
//         });
//         const result = await response.json();
//         if (result.success) {
//           // Update display
//           setBookingFormEditable(false);
//           // Forcefully replace time dropdowns with span
//           const timeWrapper = bookingForm.querySelector('.d-flex');
//           if (timeWrapper) {
//             let startVal = '', endVal = '';
//             const startSel = timeWrapper.querySelector('#startTime');
//             const endSel = timeWrapper.querySelector('#endTime');
//             if (startSel && endSel) {
//               startVal = startSel.value;
//               endVal = endSel.value;
//             }
//             const span = document.createElement('span');
//             span.className = 'form-control';
//             span.id = 'time';
//             span.style.background = '#eee';
//             span.style.pointerEvents = 'none';
//             span.style.userSelect = 'text';
//             span.textContent = startVal && endVal ? `${startVal} - ${endVal}` : '';
//             timeWrapper.replaceWith(span);
//           }
//           editBtn.textContent = 'Edit Reservation';
//           isEditing = false;
//           // Optionally update the booking card info in DOM
//           const card = document.querySelector(`.booking-card[data-id="${bookingId}"]`);
//           if (card) {
//             card.dataset.date = updated.date;
//             card.dataset.time = updated.timeRange;
//             card.dataset.repeat = updated.repeat;
//             card.dataset.email = updated.email;
//             card.dataset.purpose = updated.purpose;
//             card.dataset.roomid = updated.roomId;
//             card.dataset.name = updated.name || updated.userId || '';
//             card.dataset.booking = JSON.stringify({
//               id: bookingId,
//               date: updated.date,
//               time: updated.timeRange,
//               repeat: updated.repeat,
//               name: updated.name || updated.userId || '',
//               email: updated.email,
//               purpose: updated.purpose,
//               roomId: updated.roomId
//             });
//             // Update visible card text
//             card.querySelector('h5').textContent = updated.purpose;
//             card.querySelector('p:nth-of-type(1)').textContent = updated.roomId;
//             card.querySelector('p:nth-of-type(2)').textContent = updated.timeRange;
//             card.querySelector('p.text-muted').textContent = updated.date;
//           }
//         } else {
//           alert('Error saving booking: ' + (result.error || 'unknown error'));
//         }
//       } catch (err) {
//         alert('Failed to save booking.');
//       }
//     }
//   });
// }

// if (!bookingCards.length) {
//   console.warn("No booking cards found in DOM when mybookings.js ran");
// } else {
//   console.log(`Found ${bookingCards.length} booking cards`);
// }

// // Add click listeners to booking cards
// bookingCards.forEach(card => {
//   card.addEventListener('click', () => {
//     console.log(`Clicked booking ${card.dataset.id}`);

//     // Highlight selected
//     document.querySelectorAll('.booking-card').forEach(c => c.classList.remove('selected'));
//     card.classList.add('selected');

//     // Parse structured booking data (preferred) with fallback to individual data-* attributes
//     let bookingData = {};
//     try {
//       if (card.dataset.booking) bookingData = JSON.parse(card.dataset.booking);
//     } catch (err) {
//       console.warn('Could not parse data-booking JSON, falling back to data-* attributes', err);
//       bookingData = {};
//     }

//     // Save the ID
//     bookingForm.dataset.id = bookingData.id || card.dataset.id || '';

//     // Handle the date format safely
//     let dateValue = bookingData.date || card.dataset.date || '';
//     if (dateValue) {
//       const parsed = new Date(dateValue);
//       if (!isNaN(parsed)) dateValue = parsed;
//       else {
//         console.warn('Could not parse date:', bookingData.date || card.dataset.date);
//         dateValue = null;
//       }
//     }


//     // Populate <span> fields for non-editable display
//     const setSpan = (id, value) => {
//       const el = bookingForm.querySelector(`#${id}`) || document.getElementById(id);
//       if (el) el.textContent = value || '';
//     };

//     setSpan('date', bookingData.date || card.dataset.date || '');
//     setSpan('time', bookingData.time || card.dataset.time || '');
//     setSpan('repeat', bookingData.repeat || card.dataset.repeat || 'Never');
//     setSpan('name', bookingData.name || bookingData.userId || card.dataset.name || '');
//     setSpan('email', bookingData.email || card.dataset.email || '');
//     setSpan('purpose', bookingData.purpose || card.dataset.purpose || '');
//     setSpan('roomId', bookingData.roomId || card.dataset.roomid || '');

//     console.log('Form populated with:', {
//       id: bookingForm.dataset.id,
//       date: bookingData.date || card.dataset.date,
//       time: bookingData.time || card.dataset.time,
//       repeat: bookingData.repeat || card.dataset.repeat,
//       email: bookingData.email || card.dataset.email,
//       purpose: bookingData.purpose || card.dataset.purpose,
//       roomId: bookingData.roomId || card.dataset.roomid
//     });
//   });
// });

// // Cancel button handler
// if (cancelBtn) {
//   cancelBtn.addEventListener('click', async () => {
//     const bookingId = bookingForm.dataset.id;
//     if (!bookingId) {
//       alert("Please select a booking first.");
//       return;
//     }

//     const confirmDelete = confirm("Are you sure you want to cancel this reservation?");
//     if (!confirmDelete) return;

//     console.log(`🗑️ Deleting booking ${bookingId}...`);

//     try {
//       const response = await fetch(`/delete_booking/${bookingId}`, { method: 'DELETE' });
//       const result = await response.json();

//       if (result.success) {
//         alert("Booking canceled successfully!");
//         document.querySelector(`.booking-card[data-id="${bookingId}"]`)?.remove();
//         bookingForm.reset();
//         bookingForm.dataset.id = "";
//       } else {
//         alert("Error canceling booking: " + (result.error || "unknown error"));
//       }
//     } catch (err) {
//       console.error("Error deleting booking:", err);
//       alert("Failed to cancel booking.");
//     }
//   });
// } else {
//   console.warn("Cancel button not found");
// }



/* ==============================
    Rooms Management
============================== */
(async function () {
  const listWrap = document.getElementById("roomsList");
  const addBtn = document.getElementById("addRoomBtn");
  const refreshBtn = document.getElementById("refreshRoomsBtn");

  const inputName = document.getElementById("newRoomName");
  const inputDesc = document.getElementById("newRoomDescription");
  const inputActive = document.getElementById("newRoomActive");
  const roomsMessage = document.getElementById("roomsMessage");

  const modalEl = document.getElementById("addRoomModal");
  const modal = modalEl ? new bootstrap.Modal(modalEl) : null;

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
          <div class="small text-muted">${
            escapeHtml(r.room_description || "")
          }</div>
          <div class="small mt-1">Active: ${r.active ? "Yes" : "No"}</div>
        </div>
      `;

      const actions = document.createElement("div");
      actions.className = "d-flex flex-column align-items-end gap-1";

      const del = document.createElement("button");
      del.className = "btn btn-sm btn-outline-danger room-delete-btn";
      del.textContent = "Delete";
      del.dataset.id = r.id;
      del.dataset.name = r.name || r.id;

      actions.appendChild(del);
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

      renderRooms(data.rooms || []);
      showMessage("");
    } catch (err) {
      console.error("loadRooms error:", err);
      showMessage("Failed to load rooms (network error)", true);
      renderRooms([]);
    }
  }

  async function deleteRoom(id, name) {
    if (!id) return;

    const ok = confirm(
      `Delete room "${name || id}"?\nThis action cannot be undone.`
    );
    if (!ok) return;

    try {
      const resp = await fetch(`/api/rooms/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });

      const data = await resp.json().catch(() => ({}));

      if (!resp.ok) {
        showMessage(data.error || "Failed to delete room", true);
        return;
      }

      showMessage("Room deleted");
      await loadRooms();
    } catch (err) {
      console.error("deleteRoom error:", err);
      showMessage("Failed to delete room (network error)", true);
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

  listWrap.addEventListener("click", (e) => {
    const btn = e.target.closest(".room-delete-btn");
    if (!btn) return;
    deleteRoom(btn.dataset.id, btn.dataset.name);
  });

  // --------------------------------
  // Refresh button
  // --------------------------------
  refreshBtn?.addEventListener("click", loadRooms);

  // --------------------------------
  // Reset modal when opened
  // --------------------------------
  if (modalEl) {
    modalEl.addEventListener("show.bs.modal", () => {
      inputName.value = "";
      inputDesc.value = "";
      inputActive.checked = true;
      roomsMessage.textContent = "";
    });
  }

  // --------------------------------
  // First load
  // --------------------------------
  await loadRooms();
})();

/* ==============================
    Users (Pending Accounts) filter
============================== */
(function(){
  // Initialize users filter when #usersList becomes available
  function initUsersFilter() {
    const usersListEl = document.getElementById('usersList');
    const roleFilterEl = document.getElementById('userRoleFilter');
    if (!usersListEl) return false;

    console.log('admin.js: initializing users filter');

    function esc(s){ if (!s) return ''; return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }

    // Build sourceUsers from server-provided JSON if available, otherwise from DOM
    const sourceUsers = (window.ADMIN_USERS && Array.isArray(window.ADMIN_USERS)) ? window.ADMIN_USERS.slice() : null;

    // If DOM already contains rows (server-rendered), prefer preserving them and toggle visibility
    const domRows = Array.from(usersListEl.querySelectorAll('div.d-flex'));

    // Helper to get email from an existing DOM row (first .small is email in server template)
    function emailFromRow(row){
      const smalls = row.querySelectorAll('.small');
      if (smalls && smalls.length > 0) return smalls[0].textContent.trim();
      return '';
    }

    // If we have server-side users (domRows), annotate rows with data-role from sourceUsers (if available)
    if (domRows.length > 0) {
      // Map sourceUsers by email for quick lookup
      const mapByEmail = {};
      if (sourceUsers) sourceUsers.forEach(u => { if (u.email) mapByEmail[String(u.email).toLowerCase()] = u; });

      domRows.forEach(row => {
        const email = emailFromRow(row) || '';
        const key = String(email).toLowerCase();
        const u = mapByEmail[key];
        const role = u && u.role ? String(u.role) : (row.dataset.role || row.querySelector('.small.text-muted:last-of-type')?.textContent?.replace(/^Role:\s*/i,'') || '');
        row.dataset.email = email;
        row.dataset.role = role ? role.trim().toLowerCase() : '';
      });

      function applyFilterToDom(){
        const role = (roleFilterEl?.value || 'all').toLowerCase();
        domRows.forEach(row => {
          const r = row.dataset.role || '';
          if (role === 'all' || r === role) row.style.display = '';
          else row.style.display = 'none';
        });
      }

      roleFilterEl?.addEventListener('change', applyFilterToDom);
      // initial state
      applyFilterToDom();
      return true;
    }

    // If no DOM rows, but we have sourceUsers JSON, render them
    if (sourceUsers && sourceUsers.length > 0) {
      function renderUsers(users){
        usersListEl.innerHTML = '';
        users.forEach(u => {
          const row = document.createElement('div');
          row.className = 'd-flex align-items-start justify-content-between mb-2 p-2 rounded';
          row.style.border = '1px solid rgba(0,0,0,0.05)';
          row.innerHTML = `
            <div>
              <div class="fw-semibold">${esc(u.name || u.email)}</div>
              <div class="small text-muted">${esc(u.email)}</div>
              <div class="small text-muted">Role: ${esc((u.role||'').toString() || 'student')}</div>
            </div>
          `;
          row.dataset.email = u.email || '';
          row.dataset.role = (u.role || '').toString().toLowerCase();
          const actions = document.createElement('div');
          actions.className = 'd-flex flex-column align-items-end gap-1';
          const btn = document.createElement('button');
          btn.className = 'btn btn-sm btn-outline-secondary user-manage-btn';
          btn.textContent = 'Manage';
          btn.dataset.email = u.email || '';
          actions.appendChild(btn);
          row.appendChild(actions);
          usersListEl.appendChild(row);
        });
      }

      function applyFilter(){
        const role = (roleFilterEl?.value || 'all').toLowerCase();
        if (role === 'all') return renderUsers(sourceUsers);
        const filtered = sourceUsers.filter(u => (u.role||'').toString().toLowerCase() === role);
        renderUsers(filtered);
      }

      // initial render and hook
      renderUsers(sourceUsers);
      roleFilterEl?.addEventListener('change', applyFilter);
      return true;
    }

    // Nothing to do
    return true;
  }

  // Try immediate init
  if (initUsersFilter()) return;

  // Otherwise observe for insertion
  const mo = new MutationObserver((mutations, obs) => {
    if (document.getElementById('usersList')) {
      if (initUsersFilter()) obs.disconnect();
    }
  });
  mo.observe(document.documentElement || document.body, { childList: true, subtree: true });
})();
