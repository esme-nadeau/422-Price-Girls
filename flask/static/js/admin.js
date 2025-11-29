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
  roomsMessage.style.color = isError ? '#b00020' : '#666';
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

    // Initialize Flatpickr on the date field
    const dateInput = document.getElementById('date');
    let datePicker = null;
    if (dateInput) {
      datePicker = flatpickr(dateInput, { dateFormat: "m/d/Y" });
    }

    // Grab booking cards
    const bookingCards = document.querySelectorAll('.booking-card');

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
    Rooms Management (Admin Page Only)
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
        manage.dataset.description = r.room_description || "";
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

  // ----------------------------
  // User modal elements
  // ----------------------------
  let userModalEl = null;
  let userNameInput = null;
  let userEmailInput = null;
  let userRoleSelect = null;
  let deleteUserBtnEl = null;
  let changeUserBtnEl = null;

  function initUserModalElements() {
    userModalEl = document.getElementById('userModal');
    userNameInput = document.getElementById('userId');
    userEmailInput = document.getElementById('userEmail');
    userRoleSelect = document.getElementById('userRole');
    deleteUserBtnEl = document.getElementById('deleteUserBtn');
    changeUserBtnEl = document.getElementById('changeUserBtn');
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

    // ----------------------------
    // Users: open user modal when Edit clicked
    // ----------------------------
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
        const row = btn.closest('.d-flex') || btn.parentElement;
        const nameEl = row ? row.querySelector('.fw-semibold') : null;
        const emailEls = row ? row.querySelectorAll('.small.text-muted') : null;
        const emailEl = emailEls && emailEls.length > 0 ? emailEls[0] : null;
        const roleEl = emailEls && emailEls.length > 1 ? emailEls[1] : null;

        const displayName = nameEl ? nameEl.textContent.trim() : '';
        const displayEmail = btn.dataset.email || (emailEl ? emailEl.textContent.trim() : '');
        let displayRole = '';
        if (roleEl) {
          // roleEl text may be "Role: student"
          const txt = roleEl.textContent || '';
          displayRole = txt.replace(/^Role:\s*/i, '').trim();
        }

        if (userNameInput) userNameInput.value = displayName || '';
        if (userEmailInput) userEmailInput.value = displayEmail || '';
        if (userRoleSelect && displayRole) userRoleSelect.value = displayRole;

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
            manageRoomMessage.style.color = "#b00020";
          }
          return;
        }

        if (manageRoomMessage) {
          manageRoomMessage.textContent = "Room deleted";
          manageRoomMessage.style.color = "#666";
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
          manageRoomMessage.style.color = "#b00020";
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
          manageRoomMessage.style.color = "#b00020";
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
            manageRoomMessage.style.color = "#b00020";
          }
          return;
        }

        if (manageRoomMessage) {
          manageRoomMessage.textContent = "Room updated";
          manageRoomMessage.style.color = "#666";
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
          manageRoomMessage.style.color = "#b00020";
        }
      }
    });
  }

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
    Account Management - User Search
============================== */
// Global function to initialize search - can be called after admin content loads
window.initUserSearch = function() {
  console.log('admin.js: initUserSearch called');
  
  // Don't run if on mybookings page
  if (document.getElementById('mybookings-root')) {
    return false;
  }
  
  const usersListEl = document.getElementById('usersList');
  const userSearchEl = document.getElementById('userSearch');
  
  if (!usersListEl || !userSearchEl) {
    console.log('admin.js: Search elements not found', { usersList: !!usersListEl, userSearch: !!userSearchEl });
    return false;
  }

  console.log('admin.js: FOUND SEARCH ELEMENTS! Setting up search...');

  // Remove any existing listeners by cloning the element
  const newSearchEl = userSearchEl.cloneNode(true);
  userSearchEl.parentNode.replaceChild(newSearchEl, userSearchEl);
  const freshSearchEl = document.getElementById('userSearch');
  
  if (!freshSearchEl) {
    console.log('admin.js: Failed to get fresh search element');
    return false;
  }

  // Create search function that gets fresh rows each time
  function performSearch() {
    console.log('admin.js: SEARCH FUNCTION CALLED!');
    
    const list = document.getElementById('usersList');
    const search = document.getElementById('userSearch');
    
    if (!list || !search) {
      console.log('admin.js: Elements missing during search');
      return;
    }

    const searchTerm = (search.value || '').trim().toLowerCase();
    console.log('admin.js: Searching for:', searchTerm);

    // Get fresh rows each time
    const rows = Array.from(list.children).filter(el => 
      el.classList.contains('d-flex') && 
      el.querySelector('.user-manage-btn') !== null
    );

    console.log('admin.js: Processing', rows.length, 'rows');

    rows.forEach(row => {
      // Get searchable text
      const nameEl = row.querySelector('.fw-semibold');
      const emailEls = row.querySelectorAll('.small.text-muted');
      const emailEl = emailEls && emailEls.length > 0 ? emailEls[0] : null;
      
      const name = nameEl ? nameEl.textContent.trim() : '';
      const email = emailEl ? emailEl.textContent.trim() : '';
      const searchText = `${name} ${email}`.toLowerCase();
      
      // Filter
      if (!searchTerm || searchText.includes(searchTerm)) {
        row.style.display = '';
      } else {
        row.style.display = 'none';
      }
    });
    
    console.log('admin.js: Search complete');
  }

  // Attach listeners
  freshSearchEl.addEventListener('input', performSearch);
  freshSearchEl.addEventListener('keyup', performSearch);
  freshSearchEl.oninput = performSearch;
  freshSearchEl.onkeyup = performSearch;
  
  console.log('admin.js: Search initialized! Listeners attached.');
  performSearch(); // Initial run
  
  return true;
};

// Auto-initialize when admin content loads
(function(){
  // Don't run if on mybookings page
  if (document.getElementById('mybookings-root')) {
    return;
  }

  // Try immediately
  if (window.initUserSearch && window.initUserSearch()) {
    console.log('admin.js: Search initialized immediately');
    return;
  }

  // Retry with delays - check if search is already initialized
  [100, 300, 500, 1000, 2000, 3000].forEach(delay => {
    setTimeout(() => {
      if (document.getElementById('mybookings-root')) return;
      if (window.initUserSearch) {
        const searchEl = document.getElementById('userSearch');
        // Only initialize if search element exists and doesn't have listeners
        if (searchEl && !searchEl.oninput) {
          window.initUserSearch();
        }
      }
    }, delay);
  });

  // MutationObserver - watch for admin content to load
  const observer = new MutationObserver(() => {
    if (document.getElementById('mybookings-root')) return;
    if (window.initUserSearch) {
      const searchEl = document.getElementById('userSearch');
      if (searchEl && !searchEl.oninput) {
        if (window.initUserSearch()) {
          observer.disconnect();
        }
      }
    }
  });
  
  observer.observe(document.body, { childList: true, subtree: true });
})();

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
