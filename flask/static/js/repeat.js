// static/js/repeat.js

// Track which booking widget (Map, Calendar, All Bookings) opened the repeat modal
// so Save and the pencil icon can update the correct controls.
let currentRepeatContext = null; // { dropdownEl, notesIconEl, containerEl }

function getRepeatContextFromEvent(ev) {
  const trigger = ev && (ev.currentTarget || ev.target);
  let container = null;

  if (trigger) {
    container = trigger.closest('.tab-pane') ||
                trigger.closest('.booking-widget') ||
                trigger.closest('#mapContainer') ||
                trigger.closest('.calendar-page') ||
                trigger.closest('#allbookings-tab-content') ||
                trigger.closest('#mybookings-root') ||
                trigger.closest('#mybookings-tab-content') ||
                document;
  } else {
    container = document.querySelector('.tab-pane.show.active') ||
                document.getElementById('mapContainer') ||
                document.querySelector('.calendar-page') ||
                document.getElementById('allbookings-tab-content') ||
                document.getElementById('mybookings-root') ||
                document.getElementById('mybookings-tab-content') ||
                document;
  }

  // Always scope lookups to the container; avoid falling back to the first
  // matching ID in the whole document, since multiple tabs reuse IDs.
  const repeatDropdown = container.querySelector('#repeatDropdown') || 
                          container.querySelector('#allBookingsRepeatDropdown');
  const notesIcon = container.querySelector('#repeatNotesIcon') ||
                    container.querySelector('#allBookingsRepeatNotesIcon');

  if (!repeatDropdown) return null;
  return { dropdownEl: repeatDropdown, notesIconEl: notesIcon, containerEl: container };
}

// Function to open modal with given type (Daily/Weekly/Monthly)
// ev should be the click event from the dropdown item or pencil icon
window.openRepeatModal = function(type, ev) {
  const ctx = getRepeatContextFromEvent(ev) || currentRepeatContext;
  if (!ctx || !ctx.dropdownEl) return;

  const repeatDropdown = ctx.dropdownEl;
  const notesIcon = ctx.notesIconEl;
  const container = ctx.containerEl || document;
  currentRepeatContext = { dropdownEl: repeatDropdown, notesIconEl: notesIcon, containerEl: container };

  // Determine type if not explicitly provided (e.g., edit icon)
  if (!type) {
    type = repeatDropdown.dataset.repeatType || 'Never';
  }

  // "Custom" is no longer supported; treat it as "Never" to avoid stale
  // data from older sessions.
  if (type === 'Custom') {
    type = 'Never';
  }

  // Hide all option sections globally (single shared modal)
  document.querySelectorAll('.repeat-option').forEach(el => {
    el.classList.add('d-none');
    el.style.display = 'none';
  });

  // Show the chosen type - do this synchronously before showing modal
  if (type === 'Daily') {
    const dailyOptions = document.getElementById('dailyOptions');
    if (dailyOptions) {
      dailyOptions.classList.remove('d-none');
      dailyOptions.style.display = 'block';
    }
  } else if (type === 'Weekly') {
    const weeklyOptions = document.getElementById('weeklyOptions');
    if (weeklyOptions) {
      weeklyOptions.classList.remove('d-none');
      weeklyOptions.style.display = 'block';
    }
  } else if (type === 'Monthly') {
    const monthlyOptions = document.getElementById('monthlyOptions');
    if (monthlyOptions) {
      monthlyOptions.classList.remove('d-none');
      monthlyOptions.style.display = 'block';
    }
  }

  // Store type in dataset so we can read it later
  repeatDropdown.dataset.repeatType = type;

  // Show modal (prefer the one in the same container; fall back only if needed)
  let modalEl = (container && container.querySelector('#repeatModal')) ||
                document.getElementById('repeatModal');
  if (modalEl) {
    if (modalEl.parentElement !== document.body) {
      document.body.appendChild(modalEl);
    }

    // Ensure the Save button for the active modal has a listener BEFORE showing
    // Call initSaveButton immediately and also after a short delay to ensure it's attached
    initSaveButton();
    
    // Use a small delay to ensure DOM updates are complete and content is visible
    setTimeout(() => {
      // Re-initialize save button to ensure it's attached (in case modal was recreated)
      initSaveButton();
      
      let modalInstance = bootstrap.Modal.getInstance(modalEl);
      if (!modalInstance) {
        modalInstance = new bootstrap.Modal(modalEl);
      }
      modalInstance.show();
    }, 50);
  }
};

// Helper: set repeat to Never for the appropriate widget (no modal)
window.setRepeatToNever = function(ev) {
  const ctx = getRepeatContextFromEvent(ev) || currentRepeatContext;
  if (!ctx || !ctx.dropdownEl) return;
  const repeatDropdown = ctx.dropdownEl;
  const notesIcon = ctx.notesIconEl;

  repeatDropdown.textContent = 'Never';
  repeatDropdown.dataset.repeatType = 'Never';
  if (notesIcon) notesIcon.classList.add('d-none');
};

// Initialize save button listener
function initSaveButton() {
  const buttons = document.querySelectorAll('#saveRepeatOptions');
  if (!buttons.length) return;

  buttons.forEach((saveBtn) => {
    // Remove any existing listener first to avoid duplicates
    const existingHandler = saveBtn._repeatSaveHandler;
    if (existingHandler) {
      saveBtn.removeEventListener('click', existingHandler);
    }

    // Create new handler
    const handler = function(e) {
      e.preventDefault();
      e.stopPropagation();
      
      // Get context - use currentRepeatContext which should be set when modal opens
      const ctx = currentRepeatContext || getRepeatContextFromEvent();
      const repeatDropdown = ctx && ctx.dropdownEl ? ctx.dropdownEl : null;
      const notesIcon = ctx && ctx.notesIconEl ? ctx.notesIconEl : null;
      const container = ctx && ctx.containerEl ? ctx.containerEl : document;
      if (!repeatDropdown) {
        console.warn('Repeat dropdown not found in context');
        return;
      }

      const type = repeatDropdown.dataset.repeatType || 'Never';
      let label = type;

      // Read values directly from the DOM - ensure inputs are accessible
      if (type === 'Daily') {
        const endDateEl = document.getElementById('dailyEndDate');
        if (endDateEl) {
          const endDate = (endDateEl.value || '').trim();
          if (endDate) {
            label += ` until ${endDate}`;
          }
        }
      } else if (type === 'Weekly') {
        const days = [];
        ['Mon','Tue','Wed','Thu','Fri'].forEach(d => {
          const cb = document.getElementById('day' + d);
          if (cb && cb.checked) days.push(d);
        });
        const endDateEl = document.getElementById('weeklyEndDate');
        const endDate = endDateEl ? (endDateEl.value || '').trim() : '';
        
        // Only add "on" if there are days selected
        if (days.length > 0) {
          label += ` on ${days.join(', ')}`;
          // Add end date if provided
          if (endDate) {
            label += ` until ${endDate}`;
          }
        } else if (endDate) {
          // If no days but there's an end date, just show the end date
          label += ` until ${endDate}`;
        }
        // If neither days nor end date, just show "Weekly"
      } else if (type === 'Monthly') {
        const endDateEl = document.getElementById('monthlyEndDate');
        if (endDateEl) {
          const endDate = (endDateEl.value || '').trim();
          if (endDate) {
            label += ` until ${endDate}`;
          }
        }
      }

      // Update dropdown display
      repeatDropdown.textContent = label;

      // Show the notes icon if type is not Never
      if (type !== 'Never') {
        if (notesIcon) notesIcon.classList.remove('d-none');
      } else if (notesIcon) {
        notesIcon.classList.add('d-none');
      }

      // Close the modal in the same container (or the first as fallback)
      const modalEl = container.querySelector('#repeatModal') ||
                      document.getElementById('repeatModal');
      if (modalEl) {
        let modalInstance = bootstrap.Modal.getInstance(modalEl);
        if (!modalInstance) {
          modalInstance = new bootstrap.Modal(modalEl);
        }
        modalInstance.hide();
      }
    };
    
    // Store handler reference and attach
    saveBtn._repeatSaveHandler = handler;
    saveBtn.addEventListener('click', handler);
  });
}

// Try to initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSaveButton);
} else {
  initSaveButton();
}

// Also set up a MutationObserver to catch when the modal is added dynamically
if (typeof MutationObserver !== 'undefined') {
  const observer = new MutationObserver(function() {
    if (document.getElementById('saveRepeatOptions')) {
      initSaveButton();
    }
  });

  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true });
  }
}
