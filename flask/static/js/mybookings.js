document.addEventListener('DOMContentLoaded', () => {
  const bookingCards = document.querySelectorAll('.booking-card');
  const form = document.getElementById('bookingForm');
  const cancelBtn = document.getElementById('cancelBookingBtn');

  // Helper function to populate form with booking data
  function populateForm(card) {
    form.dataset.id = card.dataset.id;
    document.getElementById('date').value = card.dataset.date;
    document.getElementById('time').value = card.dataset.time;
    document.getElementById('repeat').value =
      card.dataset.repeat.charAt(0).toUpperCase() + card.dataset.repeat.slice(1);
    document.getElementById('name').value = card.dataset.name;
    document.getElementById('email').value = card.dataset.email;
    document.getElementById('purpose').value = card.dataset.purpose;
  }

  // Click handler for each booking card
  bookingCards.forEach(card => {
    card.addEventListener('click', () => {
      // Remove active from all cards
      bookingCards.forEach(c => c.classList.remove('active'));
      card.classList.add('active');

      // Populate the form
      populateForm(card);
    });
  });

  // Automatically select the first booking if available
  if (bookingCards.length) {
    bookingCards[0].click();
  }

  // Cancel booking handler
  cancelBtn.addEventListener('click', () => {
    const bookingId = form.dataset.id;
    if (!bookingId) return;

    const confirmDelete = confirm("Are you sure you want to cancel this reservation?");
    if (!confirmDelete) return;

    fetch(`/delete_booking/${bookingId}`, { method: 'DELETE' })
      .then(res => {
        if (res.ok) {
          // Remove card from UI
          const card = document.querySelector(`.booking-card[data-id='${bookingId}']`);
          if (card) card.remove();

          // Clear the form
          form.reset();
          form.dataset.id = '';

          alert('Booking canceled successfully.');
        } else {
          alert('Failed to cancel booking.');
        }
      })
      .catch(err => {
        console.error(err);
        alert('An error occurred while canceling the booking.');
      });
  });
});
