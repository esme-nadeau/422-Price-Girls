// static/js/repeat.js

document.addEventListener('DOMContentLoaded', function() {
  const repeatDropdown = document.getElementById('repeatDropdown');
  const notesIcon = document.getElementById('repeatNotesIcon');
  const saveBtn = document.getElementById('saveRepeatOptions');

  // Function to open modal with given type
  window.openRepeatModal = function(type) {
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
    const repeatModal = new bootstrap.Modal(document.getElementById('repeatModal'));
    repeatModal.show();
  };

  // Save button behavior
  saveBtn.addEventListener('click', function() {
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
    modalInstance.hide();
  });
});
