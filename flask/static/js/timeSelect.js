const timeSelect = document.getElementById('timeSelect');
const selectedRange = document.getElementById('selectedRange');

let lastClickedIndex = null;

// Only attach the event listener if the element exists on the page.
if (timeSelect) {
  timeSelect.addEventListener('change', (e) => {
    const options = Array.from(timeSelect.options);
    const selectedIndexes = options
      .map((o, i) => o.selected ? i : -1)
      .filter(i => i !== -1);

    if (selectedIndexes.length === 0) {
      if (selectedRange) selectedRange.textContent = '';
      lastClickedIndex = null;
      return;
    }

    const currentIndex = selectedIndexes[selectedIndexes.length - 1];

    if (e.shiftKey && lastClickedIndex !== null) {
      const minIndex = Math.min(lastClickedIndex, currentIndex);
      const maxIndex = Math.max(lastClickedIndex, currentIndex);
      for (let i = minIndex; i <= maxIndex; i++) {
        options[i].selected = true;
      }
    }

    lastClickedIndex = currentIndex;

    // Display selected range
    const finalSelected = Array.from(options).filter(o => o.selected);
    if (selectedRange && finalSelected.length > 0) {
      selectedRange.textContent = `Selected: ${finalSelected[0].text} – ${finalSelected[finalSelected.length - 1].text}`;
    }
  });
}

// Function to filter out past time slots from dropdowns
// Rounds up to the next 30-minute slot (e.g., 12:18 PM -> 12:30 PM)

function labelToMinutes(label) {
  if (!label) return null;
  const m = String(label).trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const mm = parseInt(m[2], 10);
  const ampm = m[3].toUpperCase();
  if (ampm === 'PM' && h !== 12) h += 12;
  if (ampm === 'AM' && h === 12) h = 0;
  return h * 60 + mm;
}

function minutesToLabel(min) {
  let h = Math.floor(min / 60);
  const mm = min % 60;
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = ((h + 11) % 12) + 1; // 0 -> 12
  const m2 = mm.toString().padStart(2, '0');
  return `${h}:${m2} ${ampm}`;
}

// Get the minimum allowed time for today (rounded up to next 30-minute slot)
function getMinAllowedTime() {
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  
  // Round up to next 30-minute slot
  const roundedMinutes = Math.ceil(currentMinutes / 30) * 30;
  
  // If we're past 7:30 PM (19:30), return null (no times available today)
  if (roundedMinutes >= (19 * 60 + 30)) {
    return null;
  }
  
  return roundedMinutes;
}

// Filter time dropdown items based on selected date
// Filter time dropdown items based on selected date
function filterPastTimes(container) {
  if (!container) return;

  // Get the selected date input inside this container (prefer right-side then left)
  const dateInput = container.querySelector('#date_right') || container.querySelector('#date_left');
  if (!dateInput) return;

  const selectedDate = dateInput.value;
  if (!selectedDate) return;

  const today = new Date().toISOString().split('T')[0];
  const isToday = selectedDate === today;

  let minAllowedMinutes = null;
  if (isToday) {
    minAllowedMinutes = getMinAllowedTime();
    // If past final slot, set to a sentinel that disables everything
    if (minAllowedMinutes === null) minAllowedMinutes = 24 * 60;
  }

  // Find all dropdown blocks in the container that may contain start/end time menus
  const dropdowns = container.querySelectorAll('.dropdown');
  dropdowns.forEach(drop => {
    const button = drop.querySelector('[id^="start_time"], [id^="end_time"]');
    const menu = drop.querySelector('.dropdown-menu');
    if (!button || !menu) return;

    const items = Array.from(menu.querySelectorAll('.dropdown-item'));
    items.forEach(item => {
      const timeText = item.textContent.trim();
      const timeMinutes = labelToMinutes(timeText);
      if (timeMinutes === null) return;

      if (isToday && minAllowedMinutes !== null && timeMinutes < minAllowedMinutes) {
        // Mark disabled for accessibility and visually
        item.classList.add('disabled');
        item.setAttribute('aria-disabled', 'true');
        item.style.pointerEvents = 'none';
        item.style.opacity = '0.45';

        // Remove inline onclick if present, but save it for restoration
        const originalOnclick = item.getAttribute('onclick');
        if (originalOnclick && !item.dataset.originalOnclick) {
          item.dataset.originalOnclick = originalOnclick;
          item.removeAttribute('onclick');
        }
      } else {
        // Enable item
        item.classList.remove('disabled');
        item.removeAttribute('aria-disabled');
        item.style.pointerEvents = '';
        item.style.opacity = '';

        if (item.dataset.originalOnclick) {
          item.setAttribute('onclick', item.dataset.originalOnclick);
          delete item.dataset.originalOnclick;
        }
      }
    });

    // Ensure the button's visible label is not in the past
    const buttonText = (button.textContent || '').trim();
    const buttonTimeMinutes = labelToMinutes(buttonText);
    if (isToday && minAllowedMinutes !== null && buttonTimeMinutes !== null && buttonTimeMinutes < minAllowedMinutes) {
      const minLabel = minutesToLabel(minAllowedMinutes);
      if (minLabel) {
        // Update button(s) and call appropriate updater
        button.textContent = minLabel;
        if (button.id.includes('start_time')) {
          if (typeof window.updateStartTime === 'function') {
            window.updateStartTime(minLabel);
          } else if (typeof window.calendar_updateStartTime === 'function') {
            window.calendar_updateStartTime(minLabel);
          }
        } else if (button.id.includes('end_time')) {
          if (typeof window.updateEndTime === 'function') {
            window.updateEndTime(minLabel);
          } else if (typeof window.calendar_updateEndTime === 'function') {
            window.calendar_updateEndTime(minLabel);
          }
        }
      }
    }
  });
}

// Initialize time filtering for a container
window.initTimeFilter = function(container) {
  if (!container) {
    // Try to find active tab
    container = document.querySelector('.tab-pane.show.active') ||
                document.querySelector('#nav-map.show, #nav-calendar.show');
  }
  
  if (!container) return;
  
  // Filter immediately
  filterPastTimes(container);
  
  // Filter when date changes
  const dateInputs = container.querySelectorAll('input[type="date"]');
  dateInputs.forEach(input => {
    input.addEventListener('change', () => {
      filterPastTimes(container);
    });
  });
  
  // Also filter periodically (in case time passes while page is open)
  setInterval(() => {
    filterPastTimes(container);
  }, 60000); // Check every minute
};

// Auto-initialize for dynamically loaded content
if (typeof window.initTimeFilter === 'function') {
  // Will be called from script.js after content loads
}

