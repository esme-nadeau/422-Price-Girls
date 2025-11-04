// Function to add interactivity to an SVG
function addSVGInteractivity(svgObject) {
  // Access the SVG document inside the object tag
  const svgDoc = svgObject.contentDocument;
  if (!svgDoc) return;
  
  const svgEl = svgDoc.querySelector('svg');
  if (!svgEl) return;
  
  // Now you can manipulate SVG elements
  const rooms = svgDoc.querySelectorAll('[id^="room"]');
  
  rooms.forEach(room => {
    room.style.cursor = 'pointer';
    
    room.addEventListener('click', (e) => {
      const roomId = room.id;
      console.log('Clicked room:', roomId);
      
      // Example: highlight the clicked room
      rooms.forEach(r => {
        const shape = r.querySelector('path, rect');
        if (shape) shape.style.opacity = '0.7';
      });
      
      const clickedShape = room.querySelector('path, rect');
      if (clickedShape) clickedShape.style.opacity = '1';
    });
    
    // Optional: hover effects
    room.addEventListener('mouseenter', (e) => {
      const shape = room.querySelector('path, rect');
      if (shape) shape.style.opacity = '0.9';
    });
    
    room.addEventListener('mouseleave', (e) => {
      const shape = room.querySelector('path, rect');
      if (shape) shape.style.opacity = '0.7';
    });
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
    // Also listen for load event (for lazy-loaded slides)
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
};

