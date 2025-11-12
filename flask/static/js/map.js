let bookableRooms = [];              // display names (from DB) for dropdown
let dbRoomDigits = new Set();        // set of numeric strings present in DB rooms
let digitsToDisplay = new Map();     // map: digits -> display name (first seen)
let allBookings = [];                // all bookings from database
let roomClickHandlers = new Map();   // store click handlers so we can disable them
let roomDataMap = new Map();         // map: room name/id -> full room data from DB


/* ==============================
    General database functions
============================== */
function extractDigits(str) {
  if (!str) return null;
  const m = String(str).match(/(\d{2,4})/); // match 2-4 digit room numbers
  return m ? m[1] : null;
}

// Fetch all bookings from the database
async function fetchBookings() {
  try {
    const resp = await fetch('/api/bookings');
    const data = await resp.json();
    allBookings = data.bookings || [];
    console.log('Loaded bookings:', allBookings.length);
    return allBookings;
  } catch (e) {
    console.warn('Failed to load bookings:', e);
    allBookings = [];
    return [];
  }
}

// Expose function to refresh bookings and update room colors
// This can be called after a new booking is created
window.refreshMapBookings = async function() {
  await fetchBookings();
  updateRoomColors();
};


/* ==============================
    Room information card
============================== */
function setRoomPhotoByDigits(digits){
  const img = document.getElementById('roomPhoto');
  if(!img || !digits) return;
  const exts = ['JPG'];
  let i = 0;
  const tryNext = () => {
    if(i >= exts.length){
      console.warn('No photo found for room', digits);
      descEl.textContent = 'No image available.';
      showRoomInfoCard();
      return;
    }
    const url = `/static/room_images/${digits}.${exts[i++]}`;
    img.onerror = tryNext;
    img.onload = () => { 
      img.onerror = null;
      // Show card when photo loads successfully
      showRoomInfoCard();
    };
    img.src = url;
  };
  tryNext();
}

// Show the room info card
function showRoomInfoCard() {
  const card = document.getElementById('roomInfoCard');
  if (card) {
    card.style.display = 'block';
  }
}

// Update room description display
function setRoomDescription(roomName) {
  const descEl = document.getElementById('roomDescription');
  if (!descEl) return;
  
  // Try to find room data by name or by extracted digits
  let roomData = null;
  const digits = extractDigits(roomName);
  
  // First try to find by exact room name
  if (roomDataMap.has(roomName)) {
    roomData = roomDataMap.get(roomName);
  } else if (digits) {
    // Try to find by matching digits in room names
    for (const [key, data] of roomDataMap.entries()) {
      const keyDigits = extractDigits(key);
      if (keyDigits === digits) {
        roomData = data;
        break;
      }
    }
  }
  
  // Get room_description from room data
  if (roomData) {
    const description = roomData.room_description;
    if (description) {
      // Handle array of descriptions
      if (Array.isArray(description)) {
        if (description.length === 0) {
          descEl.textContent = 'No description available.';
        } else {
          // Multiple descriptions: display as bullet list or comma-separated
          descEl.innerHTML = description.map(desc => `• ${String(desc)}`).join('<br>');
        }
      } else {
        descEl.textContent = String(description);
      }
    } else {
      descEl.textContent = 'No description available.';
    }
  } else {
    descEl.textContent = 'No description available.';
  }
  
  // Show the card when description is set
  showRoomInfoCard();
}



/* ==============================
    Map
============================== */
// Update room colors based on booking status
function updateRoomColors() {
  const { date, startTime, endTime } = getSelectedDateTime();
  
  // Update all SVG objects
  document.querySelectorAll('.svg-object').forEach(svgObject => {
    const svgDoc = svgObject.contentDocument;
    if (!svgDoc) return;
    
    const rooms = svgDoc.querySelectorAll('[id^="room"]');
    
    rooms.forEach(room => {
      const roomId = room.id;
      const num = (roomId && roomId.match(/^\D*(\d+)\D*$/)) ? roomId.match(/^\D*(\d+)\D*$/)[1] : null;
      const hasSuffix = /[A-Za-z]$/.test(roomId);
      const isBookable = (!hasSuffix) && !!(num && dbRoomDigits.has(num));
      
      if (!isBookable) return;
      
      const shape = room.querySelector('path, rect');
      if (!shape) return;
      
      // Check if room is booked
      const booked = isRoomBooked(roomId, date, startTime, endTime);
      
      // Update color and visual feedback
      if (booked) {
        shape.style.fill = '#c25956'; // Red for booked
        room.style.cursor = 'not-allowed';
        // Don't disable pointer events - we want the click handler to show the alert
      } else {
        shape.style.fill = '#6FAD6F'; // Green for available
        room.style.cursor = 'pointer';
      }
    });
  });
}

async function loadRoomsAndPopulateDropdown() {
  // Load from API (DB)
  let displayRooms = [];
  try {
    const resp = await fetch('/api/rooms');
    const data = await resp.json();
    const rooms = (data.rooms || []);
    rooms.forEach(r => {
      const display = (r.name || r.id || '').toString().trim();
      if (!display) return;
      
      // Store full room data in map
      roomDataMap.set(display, r);
      // Also store by ID if different from name
      if (r.id && r.id !== display) {
        roomDataMap.set(r.id, r);
      }
      
      const digits = extractDigits(display);
      if (digits) {
        if (!digitsToDisplay.has(digits)) digitsToDisplay.set(digits, display);
        dbRoomDigits.add(digits);
      }
      displayRooms.push(display);
    });
  } catch (e) {
    console.warn('Failed to load rooms from /api/rooms; no rooms will be interactive.', e);
  }

  // Populate dropdown from DB names
  bookableRooms = Array.from(new Set(displayRooms)).sort();
  const menu = document.getElementById('roomDropdownMenu');
  if (menu) {
    menu.innerHTML = '';
    bookableRooms.forEach(roomName => {
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.className = 'dropdown-item';
      a.href = '#';
      a.textContent = roomName;
      a.addEventListener('click', (e) => {
        e.preventDefault();
        const labelEl = document.getElementById('selectedRoom');
        if (labelEl) labelEl.textContent = roomName;
        const digits = extractDigits(roomName);
        if (digits) setRoomPhotoByDigits(digits);
        setRoomDescription(roomName); // Update room description and show card
        
        // Show the booking form fields
        const bookingFields = document.getElementById('bookingFormFields');
        if (bookingFields) {
          bookingFields.style.display = 'block';
        }
      });
      li.appendChild(a);
      menu.appendChild(li);
    });
  }
}

// Add interactivity to the SVGs
function addSVGInteractivity(svgObject) {
  const svgDoc = svgObject.contentDocument;
  if (!svgDoc) return;
  
  const svgEl = svgDoc.querySelector('svg');
  if (!svgEl) return;
  
  const rooms = svgDoc.querySelectorAll('[id^="room"]');
  let selectedRoom = null;
  
function clearSelection() {
  if (selectedRoom) {
    const prevShape = selectedRoom.querySelector('path, rect');
    if (prevShape) prevShape.style.opacity = '0.7';
    selectedRoom = null;
  }

  // Reset label text back to "Select Room"
  const labelEl = document.getElementById('selectedRoom');
  if (labelEl) {
    labelEl.textContent = 'Select Room';
  }

  // Hide the room info card (optional — remove if you want it to stay visible)
  const card = document.getElementById('roomInfoCard');
  if (card) {
    card.style.display = 'none';
  }

  // Hide the booking form fields
  const bookingFields = document.getElementById('bookingFormFields');
  if (bookingFields) {
    bookingFields.style.display = 'none';
  }
}
  
  svgDoc.addEventListener('click', (event) => {
    if (![...rooms].some(r => r.contains(event.target))) {
      clearSelection();
    }
  });
  
  document.addEventListener('click', (event) => {
    const mapCard = document.getElementById('mapCard');

    if (mapCard && mapCard.contains(event.target) && !svgObject.contains(event.target)) {
      clearSelection();
    }
  });
  
  rooms.forEach(room => {
    const roomId = room.id;
    const num = (roomId && roomId.match(/^\D*(\d+)\D*$/)) ? roomId.match(/^\D*(\d+)\D*$/)[1] : null;
    const hasSuffix = /[A-Za-z]$/.test(roomId);
    const roomName = (num && !hasSuffix) ? `Room ${num}` : roomId;
    const isBookable = (!hasSuffix) && !!(num && dbRoomDigits.has(num));
    
    if (isBookable) {
      const clickHandler = (e) => {
        const { date, startTime, endTime } = getSelectedDateTime();
        if (isRoomBooked(roomId, date, startTime, endTime)) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        
        console.log('Clicked room:', roomId);
        
        const labelEl = document.getElementById('selectedRoom');
        if (labelEl) {
          const display = (num && digitsToDisplay.get(num)) || roomName;
          labelEl.textContent = display;
        }

        if (num) setRoomPhotoByDigits(num);
        
        const display = (num && digitsToDisplay.get(num)) || roomName;
        setRoomDescription(display);

        rooms.forEach(r => {
          const shape = r.querySelector('path, rect');
          if (shape) shape.style.opacity = '0.7';
        });

        const clickedShape = room.querySelector('path, rect');
        if (clickedShape) clickedShape.style.opacity = '1';

        selectedRoom = room;

        // Show the booking form fields
        const bookingFields = document.getElementById('bookingFormFields');
        if (bookingFields) {
          bookingFields.style.display = 'block';
        }

        e.stopPropagation();
      };
      
      roomClickHandlers.set(room, clickHandler);
      room.addEventListener('click', clickHandler);
      
      room.addEventListener('mouseenter', (e) => {
        const { date, startTime, endTime } = getSelectedDateTime();
        if (isRoomBooked(roomId, date, startTime, endTime)) {
          room.style.cursor = 'not-allowed';
          return;
        }
        const shape = room.querySelector('path, rect');
        if (shape && room !== selectedRoom) shape.style.opacity = '0.9';
      });
      
      room.addEventListener('mouseleave', (e) => {
        const shape = room.querySelector('path, rect');
        if (!shape) return;
        if (room === selectedRoom) {
          shape.style.opacity = '1';
        } else {
          shape.style.opacity = '0.7';
        }
      });
    }
  });
  // Initial color update
  updateRoomColors();
}

// Initialize map - called after map content is loaded
window.initMap = function() {
  const svgObjects = document.querySelectorAll('.svg-object');

  // Start loading rooms and bookings; wait to wire SVGs until both load
  const roomsReady = loadRoomsAndPopulateDropdown();
  const bookingsReady = fetchBookings();
  
  // Wait for each SVG to load, then wire after rooms and bookings are ready
  svgObjects.forEach(svgObject => {
    const wire = () => { 
      Promise.all([roomsReady, bookingsReady]).then(() => {
        addSVGInteractivity(svgObject);
      });
    };
    if (svgObject.contentDocument) {
      wire();
    }
    svgObject.addEventListener('load', wire);
  });

  // for dropdown menu
  document.querySelectorAll('.dropdown-item[data-slide]').forEach(item => {
    item.addEventListener('click', e => {
      e.preventDefault();
      const slideIndex = e.target.getAttribute('data-slide');
      const carousel = bootstrap.Carousel.getOrCreateInstance(document.querySelector('#carouselFloors'));
      carousel.to(slideIndex);

      // Update button text
      document.getElementById('floorDropdown').textContent = e.target.textContent;
    });
  });

  // Update dropdown text when carousel slides (via arrows)
  const carouselElement = document.querySelector('#carouselFloors');
  if (carouselElement) {
    carouselElement.addEventListener('slid.bs.carousel', event => {
      const activeIndex = event.to; // Index of the active slide
      const floorText = `Floor ${activeIndex + 1}`;
      document.getElementById('floorDropdown').textContent = floorText;
    });
  }

  // Sync date inputs between left and right sections
  const dateLeft = document.getElementById('date_left');
  const dateRight = document.getElementById('date_right');
  
  // Set minimum date to today (prevents selecting past dates)
  const today = new Date().toISOString().split('T')[0];
  if (dateLeft) {
    dateLeft.setAttribute('min', today);
    if (!dateLeft.value) dateLeft.value = today;
  }
  if (dateRight) {
    dateRight.setAttribute('min', today);
    if (!dateRight.value) dateRight.value = today;
  }
  
  if (dateLeft && dateRight) {
    // Sync from left to right
    dateLeft.addEventListener('change', function() {
      dateRight.value = this.value;
      updateRoomColors(); // Update colors when date changes
    });
    
    // Sync from right to left
    dateRight.addEventListener('change', function() {
      dateLeft.value = this.value;
      updateRoomColors(); // Update colors when date changes
    });
  }
  
  // Update room colors when time changes
  const startTimeLeft = document.getElementById('start_time_left');
  const endTimeLeft = document.getElementById('end_time_left');
  const startTimeRight = document.getElementById('start_time_right');
  const endTimeRight = document.getElementById('end_time_right');
  
  // Use MutationObserver to watch for text changes in time buttons
  // This is more reliable than Bootstrap events
  const timeButtons = [startTimeLeft, endTimeLeft, startTimeRight, endTimeRight];
  timeButtons.forEach(btn => {
    if (btn) {
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.type === 'childList' || mutation.type === 'characterData') {
            updateRoomColors();
          }
        });
      });
      
      // Observe text content changes
      observer.observe(btn, {
        childList: true,
        characterData: true,
        subtree: true
      });
      
      // Also listen for dropdown close events as backup
      btn.addEventListener('hidden.bs.dropdown', updateRoomColors);
    }
  });
};


/* ==============================
    Time and calendar
============================== */
// Convert time label (e.g., "8:00 AM") to minutes since midnight
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

// Check if two time ranges overlap
function timesOverlap(start1, end1, start2, end2) {
  return start1 < end2 && start2 < end1;
}

// Check if a room is booked at the selected date and time
function isRoomBooked(roomId, selectedDate, selectedStartTime, selectedEndTime) {
  if (!selectedDate || !selectedStartTime || !selectedEndTime) return false;
  
  // Convert selected times to minutes
  const startMin = labelToMinutes(selectedStartTime);
  const endMin = labelToMinutes(selectedEndTime);
  if (startMin === null || endMin === null) return false;
  
  // Find matching room ID (could be room number or full room name)
  const roomDigits = extractDigits(roomId);
  
  // Check all bookings for this room on this date
  for (const booking of allBookings) {
    const bookingRoomId = booking.roomId || '';
    const bookingDate = booking.date || '';
    const bookingTimeRange = booking.timeRange || '';
    
    // Check if room matches (by digits or full name)
    let roomMatches = false;
    if (roomDigits) {
      const bookingDigits = extractDigits(bookingRoomId);
      roomMatches = bookingDigits === roomDigits || bookingRoomId === roomId;
    } else {
      roomMatches = bookingRoomId === roomId;
    }
    
    if (!roomMatches || bookingDate !== selectedDate || !bookingTimeRange) {
      continue;
    }
    
    // Parse booking time range (format: "8:00 AM - 8:30 AM")
    const [bookingStartStr, bookingEndStr] = bookingTimeRange.split(' - ').map(s => s.trim());
    if (!bookingStartStr || !bookingEndStr) continue;
    
    const bookingStartMin = labelToMinutes(bookingStartStr);
    const bookingEndMin = labelToMinutes(bookingEndStr);
    if (bookingStartMin === null || bookingEndMin === null) continue;
    
    // Check for overlap
    if (timesOverlap(startMin, endMin, bookingStartMin, bookingEndMin)) {
      return true;
    }
  }
  
  return false;
}

// Get selected date and time from the form
function getSelectedDateTime() {
  const date = document.getElementById('date_right')?.value || document.getElementById('date_left')?.value || '';
  const startTime = document.getElementById('start_time_right')?.textContent.trim() || 
                    document.getElementById('start_time_left')?.textContent.trim() || '';
  const endTime = document.getElementById('end_time_right')?.textContent.trim() || 
                  document.getElementById('end_time_left')?.textContent.trim() || '';
  return { date, startTime, endTime };
}


// Sync date inputs on page load (runs independently of initMap)
document.addEventListener('DOMContentLoaded', function() {
  const dateLeft = document.getElementById('date_left');
  const dateRight = document.getElementById('date_right');
  
  // Set minimum date to today (prevents selecting past dates)
  const today = new Date().toISOString().split('T')[0];
  if (dateLeft) {
    dateLeft.setAttribute('min', today);
    if (!dateLeft.value) dateLeft.value = today;
  }
  if (dateRight) {
    dateRight.setAttribute('min', today);
    if (!dateRight.value) dateRight.value = today;
  }
  
  if (dateLeft && dateRight) {
    // Sync from left to right
    dateLeft.addEventListener('change', function() {
      dateRight.value = this.value;
    });
    
    // Sync from right to left
    dateRight.addEventListener('change', function() {
      dateLeft.value = this.value;
    });
  }
});

// Functions to sync start and end times between left and right sections
// Enforce: end >= start + 30 minutes; also clamp to available range (8:00–20:00)
(function(){
  const START_MIN = 8 * 60;     // 8:00 AM
  const END_MIN = 19 * 60;      // 6:30 PM (last valid end)
  const STEP = 30;              // minutes

  function labelToMinutes(label){
    if(!label) return null;
    const m = String(label).trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if(!m) return null;
    let h = parseInt(m[1],10);
    const mm = parseInt(m[2],10);
    const ampm = m[3].toUpperCase();
    if(ampm === 'PM' && h !== 12) h += 12;
    if(ampm === 'AM' && h === 12) h = 0;
    return h*60 + mm;
  }
  function minutesToLabel(min){
    let h = Math.floor(min/60);
    const mm = min%60;
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = ((h + 11) % 12) + 1; // 0 -> 12
    const m2 = mm.toString().padStart(2,'0');
    return `${h}:${m2} ${ampm}`;
  }
  function clampToBounds(min){
    if(min < START_MIN) return START_MIN;
    if(min > END_MIN) return END_MIN;
    return min;
  }
  function setStartLabel(label){
    const left = document.getElementById('start_time_left');
    const right = document.getElementById('start_time_right');
    if(left) left.textContent = label;
    if(right) right.textContent = label;
  }
  function setEndLabel(label){
    const left = document.getElementById('end_time_left');
    const right = document.getElementById('end_time_right');
    if(left) left.textContent = label;
    if(right) right.textContent = label;
  }

  window.updateStartTime = function(time){
    // Set start to requested label
    setStartLabel(time);

    let startMin = labelToMinutes(time);
    if(startMin == null) return;

    // If start is too late to allow 30 min, back it up to last valid (19:30)
    const minEnd = startMin + STEP;
    if(minEnd > END_MIN){
      startMin = END_MIN - STEP; // 19:30
      setStartLabel(minutesToLabel(startMin));
    }

    // Ensure end >= start + 30
    const desiredEnd = clampToBounds(startMin + STEP);
    const currentEndLabel = (document.getElementById('end_time_right') || {}).textContent || (document.getElementById('end_time_left') || {}).textContent || '';
    const currentEndMin = labelToMinutes(currentEndLabel);
    if(currentEndMin == null || currentEndMin < desiredEnd){
      setEndLabel(minutesToLabel(desiredEnd));
    }
    
    // Update room colors after time change
    setTimeout(updateRoomColors, 50);
  };

  window.updateEndTime = function(time){
    let endMin = labelToMinutes(time);
    if(endMin == null) return;

    // Read current start; if missing, assume earliest
    const currentStartLabel = (document.getElementById('start_time_right') || {}).textContent || (document.getElementById('start_time_left') || {}).textContent || minutesToLabel(START_MIN);
    let startMin = labelToMinutes(currentStartLabel) ?? START_MIN;

    // If start too late to allow 30 mins, back it up
    if(startMin + STEP > END_MIN){
      startMin = END_MIN - STEP; // 19:30
      setStartLabel(minutesToLabel(startMin));
    }

    // Enforce end >= start + 30 and within bounds
    const minEnd = startMin + STEP;
    if(endMin < minEnd) endMin = minEnd;
    if(endMin > END_MIN) endMin = END_MIN;

    setEndLabel(minutesToLabel(endMin));
    
    // Update room colors after time change
    setTimeout(updateRoomColors, 50);
  };
})();




