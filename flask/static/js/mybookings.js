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

    // Save the ID
    bookingForm.dataset.id = card.dataset.id;

    // Handle the date format safely
    let dateValue = card.dataset.date || '';
    if (dateValue) {
      // Convert YYYY-MM-DD or other formats to JS Date
      const parsed = new Date(dateValue);
      if (!isNaN(parsed)) {
        dateValue = parsed;
      } else {
        console.warn("⚠️ Could not parse date:", card.dataset.date);
        dateValue = null;
      }
    }

    // Populate form fields
    if (datePicker && dateValue) {
      datePicker.setDate(dateValue, true, "Y-m-d"); // update Flatpickr UI
    }

    document.getElementById('time').value = card.dataset.time || '';
    document.getElementById('repeat').value = card.dataset.repeat || 'Never';
    document.getElementById('name').value = card.dataset.name || '';
    document.getElementById('email').value = card.dataset.email || '';
    document.getElementById('purpose').value = card.dataset.purpose || '';
    document.getElementById('roomId').value = card.dataset.roomid || '';

    console.log("📋 Form populated with:", {
      date: card.dataset.date,
      time: card.dataset.time,
      repeat: card.dataset.repeat,
      name: card.dataset.name,
      email: card.dataset.email,
      purpose: card.dataset.purpose,
      roomId: card.dataset.roomid
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
