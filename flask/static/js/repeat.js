// static/js/repeat.js

// Function to open modal with given type
window.openRepeatModal = function(type) {
  const repeatDropdown = document.getElementById('repeatDropdown');
  if (!repeatDropdown) return;
  
  // Hide all option sections
  document.querySelectorAll('.repeat-option').forEach(el => el.classList.add('d-none'));

  // Show the chosen type
  if(type === 'Daily') document.getElementById('dailyOptions').classList.remove('d-none');
  if(type === 'Weekly') document.getElementById('weeklyOptions').classList.remove('d-none');
  if(type === 'Monthly') document.getElementById('monthlyOptions').classList.remove('d-none');
  if(type === 'Custom') document.getElementById('customOptions').classList.remove('d-none');

  // Store type in dataset so we can read it later
  repeatDropdown.dataset.repeatType = type;

  // Show modal
  const modalEl = document.getElementById('repeatModal');
  if (modalEl) {
    // Move modal to body if it's not already there
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

// Initialize save button listener
function initSaveButton() {
  const saveBtn = document.getElementById('saveRepeatOptions');
  if (!saveBtn || saveBtn.dataset.listenerAdded) return;
  
  saveBtn.dataset.listenerAdded = 'true';
  
  saveBtn.addEventListener('click', function() {
    const repeatDropdown = document.getElementById('repeatDropdown');
    const notesIcon = document.getElementById('repeatNotesIcon');
    const type = repeatDropdown.dataset.repeatType || 'Never';
    let label = type;

    if(type === 'Daily') {
      const endDate = document.getElementById('dailyEndDate').value;
      if(endDate) label += ` until ${endDate}`;
    } else if(type === 'Weekly') {
      const days = [];
      ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].forEach(d => {
        if(document.getElementById('day'+d).checked) days.push(d);
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
