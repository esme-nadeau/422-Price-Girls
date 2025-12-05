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
  // Use attribute selectors to find the repeat dropdown and notes icon.
  const repeatDropdown = container.querySelector('[data-repeat-dropdown]');
  const notesIcon = container.querySelector('[data-repeat-notes-icon]');

  if (!repeatDropdown) return null;
  return { dropdownEl: repeatDropdown, notesIconEl: notesIcon, containerEl: container };
}

// Function to open modal with given type (Daily/Weekly/Monthly)
// ev should be the click event from the dropdown item or pencil icon
window.openRepeatModal = function(type, ev) {
  // Resolve context early and set it immediately
  const ctx = getRepeatContextFromEvent(ev) || currentRepeatContext;
  if (!ctx || !ctx.dropdownEl) return;

  const repeatDropdown = ctx.dropdownEl;
  const notesIcon = ctx.notesIconEl;
  const container = ctx.containerEl || document;
  currentRepeatContext = ctx; // Set immediately

  // Determine type if not explicitly provided (e.g., edit icon)
  if (!type) {
    type = repeatDropdown.dataset.repeatType || 'Never';
  }

  // "Custom" is no longer supported; treat it as "Never" to avoid stale
  // data from older sessions.
  if (type === 'Custom') {
    type = 'Never';
  }

  // Get modal element at the top
  const modalEl = document.getElementById('repeatModal');
  if (!modalEl) {
    console.warn('Repeat modal not found in DOM');
    return;
  }

  // Hide all option sections - scoped to modalEl
  modalEl.querySelectorAll('.repeat-option').forEach(el => {
    el.classList.add('d-none');
    el.style.display = 'none';
  });

  // Show the chosen type - do this synchronously before showing modal
  if (type === 'Daily') {
    const dailyOptions = modalEl.querySelector('#dailyOptions');
    if (dailyOptions) {
      dailyOptions.classList.remove('d-none');
      dailyOptions.style.display = 'block';
    }
  } else if (type === 'Weekly') {
    const weeklyOptions = modalEl.querySelector('#weeklyOptions');
    if (weeklyOptions) {
      weeklyOptions.classList.remove('d-none');
      weeklyOptions.style.display = 'block';
    }
  } else if (type === 'Monthly') {
    const monthlyOptions = modalEl.querySelector('#monthlyOptions');
    if (monthlyOptions) {
      monthlyOptions.classList.remove('d-none');
      monthlyOptions.style.display = 'block';
    }
  }

  // Store type in dataset so we can read it later
  repeatDropdown.dataset.repeatType = type;

  // Move modal to body if needed (but don't repeatedly add it)
  if (modalEl.parentElement !== document.body) {
    document.body.appendChild(modalEl);
  }

  // Initialize save button handler synchronously (scoped to modalEl)
  initSaveButton(modalEl);

  // Show modal
  let modalInstance = bootstrap.Modal.getInstance(modalEl);
  if (!modalInstance) {
    modalInstance = new bootstrap.Modal(modalEl);
  }
  modalInstance.show();
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

// Initialize save button listener - scoped to modalEl
function initSaveButton(modalEl) {
  if (!modalEl) {
    console.warn('initSaveButton called without modalEl');
    return;
  }

  const saveBtn = modalEl.querySelector('#saveRepeatOptions');
  if (!saveBtn) return;

  // Guard: only attach handler once per button
  if (saveBtn.dataset.handlerAttached === 'true') {
    return;
  }

  // Create new handler
  const handler = function(e) {
    e.preventDefault();
    e.stopPropagation();
    
    // Use currentRepeatContext which was set when modal opened
    const ctx = currentRepeatContext;
    if (!ctx || !ctx.dropdownEl) {
      console.warn('Repeat context not set when saving');
      return;
    }

    const repeatDropdown = ctx.dropdownEl;
    const notesIcon = ctx.notesIconEl;

    const type = repeatDropdown.dataset.repeatType || 'Never';
    let label = type;

    // Read values from modalEl using querySelector
    if (type === 'Daily') {
      const endDateEl = modalEl.querySelector('#dailyEndDate');
      if (endDateEl && endDateEl.value) {
        const endDate = endDateEl.value.trim();
        if (endDate) {
          label += ` until ${endDate}`;
        }
      }
    } else if (type === 'Weekly') {
      const days = [];
      ['Mon','Tue','Wed','Thu','Fri'].forEach(d => {
        const cb = modalEl.querySelector('#day' + d);
        if (cb && cb.checked) days.push(d);
      });
      const endDateEl = modalEl.querySelector('#weeklyEndDate');
      const endDate = (endDateEl && endDateEl.value) ? endDateEl.value.trim() : '';
      
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
      const endDateEl = modalEl.querySelector('#monthlyEndDate');
      if (endDateEl && endDateEl.value) {
        const endDate = endDateEl.value.trim();
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

    // Close the modal
    let modalInstance = bootstrap.Modal.getInstance(modalEl);
    if (modalInstance) {
      modalInstance.hide();
    }
  };
  
  // Attach handler and mark as attached
  saveBtn.addEventListener('click', handler);
  saveBtn.dataset.handlerAttached = 'true';
}

// Initialize globally when DOM is ready (for pages that dynamically add the modal)
function initGlobalModal() {
  const modalEl = document.getElementById('repeatModal');
  if (modalEl) {
    // Just ensure the structure exists; handlers will be attached on first open
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initGlobalModal);
} else {
  initGlobalModal();
}

// Also set up a MutationObserver to catch when the modal is added dynamically
if (typeof MutationObserver !== 'undefined') {
  const observer = new MutationObserver(function() {
    if (document.getElementById('repeatModal')) {
      initGlobalModal();
    }
  });

  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true });
  }
}
