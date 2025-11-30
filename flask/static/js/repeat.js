// static/js/repeat.js

// Track which booking widget (Map or Calendar) opened the repeat modal
let currentRepeatContext = null; // { dropdownEl, notesIconEl }

function getRepeatContextFromEvent(ev) {
  const trigger = ev && (ev.currentTarget || ev.target);
  let container = null;

  if (trigger) {
    container = trigger.closest('.tab-pane') ||
                trigger.closest('.booking-widget') ||
                trigger.closest('#mapContainer') ||
                trigger.closest('.calendar-page') ||
                document;
  } else {
    container = document.querySelector('.tab-pane.show.active') ||
                document.getElementById('mapContainer') ||
                document.querySelector('.calendar-page') ||
                document;
  }

  const repeatDropdown = container.querySelector('#repeatDropdown') ||
                         document.getElementById('repeatDropdown');
  const notesIcon = container.querySelector('#repeatNotesIcon') ||
                    document.getElementById('repeatNotesIcon');

  if (!repeatDropdown) return null;
  return { dropdownEl: repeatDropdown, notesIconEl: notesIcon };
}

// Function to open modal with given type (Daily/Weekly/Monthly/Custom)
// ev should be the click event from the dropdown item or pencil icon
window.openRepeatModal = function(type, ev) {
  const ctx = getRepeatContextFromEvent(ev) || currentRepeatContext;
  if (!ctx || !ctx.dropdownEl) return;

  const repeatDropdown = ctx.dropdownEl;
  const notesIcon = ctx.notesIconEl || document.getElementById('repeatNotesIcon');
  currentRepeatContext = { dropdownEl: repeatDropdown, notesIconEl: notesIcon };

  // Determine type if not explicitly provided (e.g., edit icon)
  if (!type) {
    type = repeatDropdown.dataset.repeatType || 'Never';
  }

  // Hide all option sections
  document.querySelectorAll('.repeat-option').forEach(el => el.classList.add('d-none'));

  // Show the chosen type
  if (type === 'Daily') document.getElementById('dailyOptions')?.classList.remove('d-none');
  if (type === 'Weekly') document.getElementById('weeklyOptions')?.classList.remove('d-none');
  if (type === 'Monthly') document.getElementById('monthlyOptions')?.classList.remove('d-none');
  if (type === 'Custom') document.getElementById('customOptions')?.classList.remove('d-none');

  // Store type in dataset so we can read it later
  repeatDropdown.dataset.repeatType = type;

  // Show modal (use the first repeatModal in the DOM as a shared modal)
  const modalEl = document.getElementById('repeatModal');
  if (modalEl) {
    if (modalEl.parentElement !== document.body) {
      document.body.appendChild(modalEl);
    }

    let modalInstance = bootstrap.Modal.getInstance(modalEl);
    if (!modalInstance) {
      modalInstance = new bootstrap.Modal(modalEl);
    }
    modalInstance.show();
  }
};

// Helper: set repeat to Never for the appropriate widget (no modal)
window.setRepeatToNever = function(ev) {
  const ctx = getRepeatContextFromEvent(ev) || currentRepeatContext;
  if (!ctx || !ctx.dropdownEl) return;
  const repeatDropdown = ctx.dropdownEl;
  const notesIcon = ctx.notesIconEl || document.getElementById('repeatNotesIcon');

  repeatDropdown.textContent = 'Never';
  repeatDropdown.dataset.repeatType = 'Never';
  if (notesIcon) notesIcon.classList.add('d-none');
};

// Initialize save button listener
function initSaveButton() {
  const saveBtn = document.getElementById('saveRepeatOptions');
  if (!saveBtn || saveBtn.dataset.listenerAdded) return;
  
  saveBtn.dataset.listenerAdded = 'true';
  
  saveBtn.addEventListener('click', function() {
    const ctx = currentRepeatContext || getRepeatContextFromEvent();
    const repeatDropdown = ctx && ctx.dropdownEl ? ctx.dropdownEl : document.getElementById('repeatDropdown');
    const notesIcon = ctx && ctx.notesIconEl ? ctx.notesIconEl : document.getElementById('repeatNotesIcon');
    if (!repeatDropdown) return;

    const type = repeatDropdown.dataset.repeatType || 'Never';
    let label = type;

    if(type === 'Daily') {
      const endDate = document.getElementById('dailyEndDate').value;
      if(endDate) label += ` until ${endDate}`;
    } else if(type === 'Weekly') {
      const days = [];
      // Only weekdays are available; also guard against missing elements
      ['Mon','Tue','Wed','Thu','Fri'].forEach(d => {
        const cb = document.getElementById('day' + d);
        if (cb && cb.checked) days.push(d);
      });
      const endDate = document.getElementById('weeklyEndDate').value;
      label += ` on ${days.join(', ')}${endDate ? ' until ' + endDate : ''}`;
    } else if(type === 'Monthly') {
      const endDate = document.getElementById('monthlyEndDate').value;
      if(endDate) label += ` until ${endDate}`;
    } else if(type === 'Custom') {
      const text = document.getElementById('customText').value;
      if(text) label += `: ${text}`;
    }

    // Update dropdown display
    repeatDropdown.textContent = label;

    // Show the notes icon if type is not Never
    if(type !== 'Never') {
      notesIcon.classList.remove('d-none');
    } else {
      notesIcon.classList.add('d-none');
    }

    // Close the modal
    const modalEl = document.getElementById('repeatModal');
    const modalInstance = bootstrap.Modal.getInstance(modalEl);
    if (modalInstance) {
      modalInstance.hide();
    }
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
  const observer = new MutationObserver(function(mutations) {
    if (document.getElementById('saveRepeatOptions')) {
      initSaveButton();
    }
  });
  
  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true });
  }
}
