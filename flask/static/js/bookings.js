// Function to initialize booking button - can be called after content loads
window.initBookingButton = function() {
    const bookButton = document.getElementById('bookRoomBtn');
    
    if (!bookButton) {
        console.warn('Book Room button not found');
        return;
    }
    
    // Remove any existing listeners by cloning the button
    const newButton = bookButton.cloneNode(true);
    bookButton.parentNode.replaceChild(newButton, bookButton);
    
    newButton.addEventListener('click', async function(e) {
            e.preventDefault();
            
            // Get form values
            const room = document.getElementById('selectedRoom').textContent.trim();
            const date = document.getElementById('date_right').value;
            const startTime = document.getElementById('start_time_right').textContent.trim();
            const endTime = document.getElementById('end_time_right').textContent.trim();
            const timeRange = `${startTime} - ${endTime}`;
            const repeat = document.getElementById('repeatDropdown').textContent.trim();
            const name = document.getElementById('name').value.trim();
            const purpose = document.getElementById('purpose').value.trim();
            // TODO: add email here
            
            // Validate
            if (room === 'Select Room' || !room) {
                alert('Please select a room');
                return;
            }
            if (!date || !startTime || !endTime || !name || !purpose) {
                alert('Please fill in all required fields');
                return;
            }
            
            // Prepare booking data
            const bookingData = {
                room: room,
                date: date,
                timeRange: timeRange,
                repeat: repeat,
                name: name,
                purpose: purpose
            };
            
            console.log('Sending booking data:', bookingData);
            
            try {
                const response = await fetch('/api/bookings', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(bookingData)
                });
                
                console.log('Response status:', response.status);
                
                const result = await response.json();
                console.log('Response data:', result);
                
                if (response.ok && result.success) {
                    alert('Room booked successfully!');
                    // Send confirmation email automatically
                    try {
                        const emailResp = await fetch('/api/send-booking-confirmation', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ bookingId: result.id })
                        });
                        const emailResult = await emailResp.json();
                        if (emailResp.ok && emailResult.ok) {
                            console.log('Confirmation email sent.');
                        } else {
                            console.warn('⚠️ Email send failed:', emailResult.error);
                        }
                    } catch (emailError) {
                        console.error('Email send error:', emailError);
                    }
                    // Clear form
                    document.getElementById('name').value = '';
                    document.getElementById('purpose').value = '';
                } else {
                    const errorMsg = result.error || 'Failed to book room. Please try again.';
                    console.error('Booking failed:', errorMsg);
                    alert('Error: ' + errorMsg);
                }
            } catch (error) {
                console.error('Network error:', error);
                alert('Network error: ' + error.message + '. Please check your connection and try again.');
            }
    });
};

// Try to initialize immediately (for static pages)
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', window.initBookingButton);
} else {
    // DOM already loaded, try immediately
    window.initBookingButton();
}

// Also try after a short delay (for dynamically loaded content)
setTimeout(window.initBookingButton, 100);
setTimeout(window.initBookingButton, 500);
