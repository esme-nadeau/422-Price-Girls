document.addEventListener('DOMContentLoaded', () => {
  const bookingCards = document.querySelectorAll('.booking-card');
  const form = document.getElementById('bookingForm');
  const cancelBtn = document.getElementById('cancelBookingBtn');

  function populateForm(card) {
    bookingCards.forEach(c => c.classList.remove('active')); 
    card.classList.add('active'); 

    form.dataset.id = card.dataset.id;
    document.getElementById('date').value = card.dataset.date;
    document.getElementById('time').value = card.dataset.time;
    document.getElementById('repeat').value =
      card.dataset.repeat.charAt(0).toUpperCase() + card.dataset.repeat.slice(1);
    document.getElementById('name').value = card.dataset.name;
    document.getElementById('email').value = card.dataset.email;
    document.getElementById('purpose').value = card.dataset.purpose;
    document.getElementById('roomId').value = card.dataset.roomid; // populate new field
  }

  bookingCards.forEach(card => {
    card.addEventListener('click', () => populateForm(card));
  });

  if (bookingCards.length) populateForm(bookingCards[0]);

  cancelBtn.addEventListener('click', () => {
    const bookingId = form.dataset.id;
    if (!bookingId) return;

    const confirmDelete = confirm("Are you sure you want to cancel this reservation?");
    if (!confirmDelete) return;

    fetch(`/delete_booking/${bookingId}`, { method: 'DELETE' })
      .then(res => {
        if (res.ok) {
          const card = document.querySelector(`.booking-card[data-id='${bookingId}']`);
          if (card) card.remove();
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