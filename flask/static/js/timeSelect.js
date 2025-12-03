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

// Get the minimum allowed time for today (rounded up to the next 30-minute slot)
function getMinAllowedTime() {
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  
  // Round up to next 30-minute slot
  const roundedMinutes = Math.ceil(currentMinutes / 30) * 30;
  
  // If we're past 7:00 PM (19:00), return null (no times available today)
  if (roundedMinutes >= 19 * 60) {
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

  // Compare against local-date string (YYYY-MM-DD) so we don't get timezone off-by-one issues
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const today = `${yyyy}-${mm}-${dd}`;
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
window.initTimeFilter = async function(container) {
  if (!container) {
    // Try to find active tab
    container = document.querySelector('.tab-pane.show.active') ||
                document.querySelector('#nav-map.show, #nav-calendar.show');
  }
  
  if (!container) return;
  
  // Initialize date prevention (weekends and closures) for all date inputs
  await window.initWeekendPrevention(container);
  
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

// Store closures as date ranges
let closureRanges = [];

// Function to fetch and cache closure date ranges
async function loadClosureDates() {
  try {
    const resp = await fetch("/api/closures");
    if (!resp.ok) {
      console.warn("Failed to load closures for date prevention");
      return;
    }
    const data = await resp.json();
    const closures = data.closures || [];
    closureRanges = [];
    closures.forEach(closure => {
      // Support both new format (startDate/endDate) and old format (date) for backwards compatibility
      if (closure.startDate && closure.endDate) {
        closureRanges.push({
          start: closure.startDate,
          end: closure.endDate
        });
      } else if (closure.date) {
        // Backwards compatibility: treat single date as a range of one day
        closureRanges.push({
          start: closure.date,
          end: closure.date
        });
      }
    });
  } catch (err) {
    console.error("Error loading closures:", err);
  }
}

// Function to refresh closure dates and re-validate all date inputs
window.refreshClosureDates = async function() {
  await loadClosureDates();
  // Re-validate all date inputs on the page
  const allDateInputs = document.querySelectorAll('input[type="date"]');
  allDateInputs.forEach(input => {
    if (input.value && isInvalidDate(input.value)) {
      const nextValid = findNextValidDate(input.value);
      if (nextValid) {
        input.value = nextValid;
      } else {
        input.value = '';
      }
    }
  });
};

// Function to check if a date is a weekend (Saturday = 6, Sunday = 0)
function isWeekend(dateString) {
  if (!dateString) return false;
  const date = new Date(dateString + 'T00:00:00'); // Add time to avoid timezone issues
  const dayOfWeek = date.getDay();
  return dayOfWeek === 0 || dayOfWeek === 6; // Sunday = 0, Saturday = 6
}

// Function to check if a date falls within any closure range
function isClosureDate(dateString) {
  if (!dateString) return false;
  return closureRanges.some(range => {
    return dateString >= range.start && dateString <= range.end;
  });
}

// Function to check if a date is invalid (weekend or closure)
function isInvalidDate(dateString) {
  return isWeekend(dateString) || isClosureDate(dateString);
}

// Function to find the next valid date (not a weekend, not a closure) from a given date
function findNextValidDate(dateString) {
  if (!dateString) return null;
  let date = new Date(dateString + 'T00:00:00');
  let attempts = 0;
  const maxAttempts = 365; // Prevent infinite loops
  
  // Start by checking if we need to move from weekend
  let dayOfWeek = date.getDay();
  if (dayOfWeek === 6) {
    // Saturday, move to Monday
    date.setDate(date.getDate() + 2);
  } else if (dayOfWeek === 0) {
    // Sunday, move to Monday
    date.setDate(date.getDate() + 1);
  }
  
  // Now check if the date is valid (not weekend, not closure)
  while (attempts < maxAttempts) {
    const dateStr = formatDateString(date);
    if (!isInvalidDate(dateStr)) {
      return dateStr;
    }
    // Move to next day
    date.setDate(date.getDate() + 1);
    attempts++;
  }
  
  return null; // Couldn't find a valid date
}

// Helper function to format date as YYYY-MM-DD
function formatDateString(date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// Function to prevent weekend and closure date selection
function preventInvalidDateSelection(dateInput) {
  if (!dateInput) return;
  
  // Store the last valid (non-weekend, non-closure) date
  let lastValidDate = dateInput.value;
  
  // Check if initial value is invalid and fix it
  if (lastValidDate && isInvalidDate(lastValidDate)) {
    const nextValid = findNextValidDate(lastValidDate);
    if (nextValid) {
      dateInput.value = nextValid;
      lastValidDate = nextValid;
    } else {
      lastValidDate = '';
      dateInput.value = '';
    }
  } else if (!lastValidDate) {
    // If no initial value, try to set to today if it's valid, or next valid date
    const today = new Date();
    const todayStr = formatDateString(today);
    if (!isInvalidDate(todayStr)) {
      lastValidDate = todayStr;
    } else {
      const nextValid = findNextValidDate(todayStr);
      if (nextValid) {
        lastValidDate = nextValid;
      }
    }
  }
  
  // Helper function to handle invalid date selection
  const handleInvalidSelection = function(input, selectedDate) {
    if (selectedDate && isInvalidDate(selectedDate)) {
      // If an invalid date is selected, revert to the last valid date or find next valid date
      if (lastValidDate && !isInvalidDate(lastValidDate)) {
        input.value = lastValidDate;
      } else {
        const nextValid = findNextValidDate(selectedDate);
        if (nextValid) {
          input.value = nextValid;
          lastValidDate = nextValid;
        } else {
          input.value = '';
          lastValidDate = '';
        }
      }
      return false; // Indicate that selection was prevented
    } else if (selectedDate) {
      // Update last valid date if it's valid
      lastValidDate = selectedDate;
      return true; // Indicate that selection was allowed
    }
    return true;
  };
  
  // Listen for date changes
  dateInput.addEventListener('change', function() {
    handleInvalidSelection(this, this.value);
  });
  
  // Also listen for input event to catch changes before they're committed
  dateInput.addEventListener('input', function() {
    handleInvalidSelection(this, this.value);
  });
}

// Initialize date prevention (weekends and closures) for all date inputs in a container
window.initWeekendPrevention = async function(container) {
  if (!container) {
    // Try to find active tab
    container = document.querySelector('.tab-pane.show.active') ||
                document.querySelector('#nav-map.show, #nav-calendar.show');
  }
  
  if (!container) return;
  
  // Load closure dates first (if not already loaded or if we want to refresh)
  await loadClosureDates();
  
  // Find all date inputs in the container
  const dateInputs = container.querySelectorAll('input[type="date"]');
  dateInputs.forEach(input => {
    preventInvalidDateSelection(input);
  });
};

// Auto-initialize for dynamically loaded content
if (typeof window.initTimeFilter === 'function') {
  // Will be called from script.js after content loads
}

