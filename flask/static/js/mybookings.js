console.log("📜 mybookings.js loaded and executing");

// Initialize Flatpickr on the date field
const dateInput = document.getElementById('date');
let datePicker = null;
if (dateInput) {
  datePicker = flatpickr(dateInput, { dateFormat: "m/d/Y" });
} else {
  console.warn("⚠️ Date input not found");
}

// Grab other elements
const bookingCards = document.querySelectorAll('.booking-card');
const bookingForm = document.getElementById('bookingForm');
const cancelBtn = document.getElementById('cancelBookingBtn');

if (!bookingCards.length) {
  console.warn("⚠️ No booking cards found in DOM when mybookings.js ran");
} else {
  console.log(`✅ Found ${bookingCards.length} booking cards`);
}

// Add click listeners to booking cards
bookingCards.forEach(card => {
  card.addEventListener('click', () => {
    console.log(`🟢 Clicked booking ${card.dataset.id}`);

    // Highlight selected
    document.querySelectorAll('.booking-card').forEach(c => c.classList.remove('selected'));
    card.classList.add('selected');

    // Parse structured booking data (preferred) with fallback to individual data-* attributes
    let bookingData = {};
    try {
      if (card.dataset.booking) bookingData = JSON.parse(card.dataset.booking);
    } catch (err) {
      console.warn('⚠️ Could not parse data-booking JSON, falling back to data-* attributes', err);
      bookingData = {};
    }

    // Save the ID
    bookingForm.dataset.id = bookingData.id || card.dataset.id || '';

    // Handle the date format safely
    let dateValue = bookingData.date || card.dataset.date || '';
    if (dateValue) {
      const parsed = new Date(dateValue);
      if (!isNaN(parsed)) dateValue = parsed;
      else {
        console.warn('⚠️ Could not parse date:', bookingData.date || card.dataset.date);
        dateValue = null;
      }
    }

    // Populate form fields (use bookingData when available), scope to bookingForm to avoid collisions
    if (datePicker && dateValue) {
      datePicker.setDate(dateValue, true, 'Y-m-d'); // update Flatpickr UI
    } else if (!datePicker) {
      const dateEl = bookingForm.querySelector('#date') || document.getElementById('date');
      if (dateEl) dateEl.value = bookingData.date || card.dataset.date || '';
    }

    const timeEl = bookingForm.querySelector('#time') || document.getElementById('time');
    if (timeEl) timeEl.value = bookingData.time || card.dataset.time || '';

    const repeatEl = bookingForm.querySelector('#repeat') || document.getElementById('repeat');
    if (repeatEl) repeatEl.value = bookingData.repeat || card.dataset.repeat || 'Never';

    const nameEl = bookingForm.querySelector('#name') || document.getElementById('name');
    if (nameEl) nameEl.value = bookingData.name || card.dataset.name || '';

    const emailEl = bookingForm.querySelector('#email') || document.getElementById('email');
    if (emailEl) emailEl.value = bookingData.email || card.dataset.email || '';

    const purposeEl = bookingForm.querySelector('#purpose') || document.getElementById('purpose');
    if (purposeEl) purposeEl.value = bookingData.purpose || card.dataset.purpose || '';

    const roomEl = bookingForm.querySelector('#roomId') || document.getElementById('roomId');
    if (roomEl) roomEl.value = bookingData.roomId || card.dataset.roomid || '';

    console.log('📋 Form populated with:', {
      id: bookingForm.dataset.id,
      date: bookingData.date || card.dataset.date,
      time: bookingData.time || card.dataset.time,
      repeat: bookingData.repeat || card.dataset.repeat,
      name: bookingData.name || card.dataset.name,
      email: bookingData.email || card.dataset.email,
      purpose: bookingData.purpose || card.dataset.purpose,
      roomId: bookingData.roomId || card.dataset.roomid
    });
  });
});

// Cancel button handler
if (cancelBtn) {
  cancelBtn.addEventListener('click', async () => {
    const bookingId = bookingForm.dataset.id;
    if (!bookingId) {
      alert("Please select a booking first.");
      return;
    }

    const confirmDelete = confirm("Are you sure you want to cancel this reservation?");
    if (!confirmDelete) return;

    console.log(`🗑️ Deleting booking ${bookingId}...`);

    try {
      const response = await fetch(`/delete_booking/${bookingId}`, { method: 'DELETE' });
      const result = await response.json();

      if (result.success) {
        alert("Booking canceled successfully!");
        document.querySelector(`.booking-card[data-id="${bookingId}"]`)?.remove();
        bookingForm.reset();
        bookingForm.dataset.id = "";
      } else {
        alert("Error canceling booking: " + (result.error || "unknown error"));
      }
    } catch (err) {
      console.error("❌ Error deleting booking:", err);
      alert("Failed to cancel booking.");
    }
  });
} else {
  console.warn("⚠️ Cancel button not found");
}
