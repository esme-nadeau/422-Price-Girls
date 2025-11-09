const bookable_rooms = ["Room 127", "Room 160", "Room 200", "Room 220", "Room 258", "Room 260", "Room 360"]; // FIXME should update from the booking database

// Add interactivity to the SVGs
function addSVGInteractivity(svgObject) {
  // Access the SVG document inside the object tag
  const svgDoc = svgObject.contentDocument;
  if (!svgDoc) return;
  
  const svgEl = svgDoc.querySelector('svg');
  if (!svgEl) return;
  
  // To manipulate SVG elements
  const rooms = svgDoc.querySelectorAll('[id^="room"]');
  
  rooms.forEach(room => {
    const roomId = room.id;
    const num = (roomId && roomId.match(/^\D*(\d+)\D*$/)) ? roomId.match(/^\D*(\d+)\D*$/)[1] : null;
    const hasSuffix = /[A-Za-z]$/.test(roomId); // exclude rooms like 220A
    const roomName = (num && !hasSuffix) ? `Room ${num}` : roomId;
    const isBookable = bookable_rooms.includes(roomName);
    
    // Only make bookable rooms interactive (clickable and hoverable)
    if (isBookable) {
      room.style.cursor = 'pointer';
      
      // Set bookable room color
      const shape = room.querySelector('path, rect');
      if (shape) {
        shape.style.fill = '#6FAD6F';
      }
      
      room.addEventListener('click', (e) => {
        console.log('Clicked room:', roomId);
        
        // Update selected room label so bookings.js validation passes
        const labelEl = document.getElementById('selectedRoom');
        if (labelEl) {
          labelEl.textContent = roomName;
        }

        // Highlight the clicked room
        rooms.forEach(r => {
          const shape = r.querySelector('path, rect');
          if (shape) shape.style.opacity = '0.7';
        });
        
        const clickedShape = room.querySelector('path, rect');
        if (clickedShape) clickedShape.style.opacity = '1';
      });
      
      // Hover effects
      room.addEventListener('mouseenter', (e) => {
        const shape = room.querySelector('path, rect');
        if (shape) shape.style.opacity = '0.9';
      });
      
      room.addEventListener('mouseleave', (e) => {
        const shape = room.querySelector('path, rect');
        if (shape) shape.style.opacity = '0.7';
      });
    };
  });
}

// Initialize map - called after map content is loaded
window.initMap = function() {
  const svgObjects = document.querySelectorAll('.svg-object');
  
  // Wait for each SVG to load
  svgObjects.forEach(svgObject => {
    // Check if already loaded (for the first/active slide)
    if (svgObject.contentDocument) {
      addSVGInteractivity(svgObject);
    }
    // Listen for load event (for lazy-loaded slides)
    svgObject.addEventListener('load', () => {
      addSVGInteractivity(svgObject);
    });
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
    });
    
    // Sync from right to left
    dateRight.addEventListener('change', function() {
      dateLeft.value = this.value;
    });
  }
};

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
function updateStartTime(time) {
  const startTimeLeft = document.getElementById('start_time_left');
  const startTimeRight = document.getElementById('start_time_right');
  
  if (startTimeLeft) {
    startTimeLeft.textContent = time;
  }
  if (startTimeRight) {
    startTimeRight.textContent = time;
  }
}

function updateEndTime(time) {
  const endTimeLeft = document.getElementById('end_time_left');
  const endTimeRight = document.getElementById('end_time_right');
  
  if (endTimeLeft) {
    endTimeLeft.textContent = time;
  }
  if (endTimeRight) {
    endTimeRight.textContent = time;
  }
}

