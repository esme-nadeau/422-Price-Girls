document.addEventListener('DOMContentLoaded', function() {
    const bookButton = document.querySelector('.btn-green');
    
    if (bookButton) {
        bookButton.addEventListener('click', async function(e) {
            e.preventDefault();
            
            // Get form values
            const room = document.getElementById('selectedRoom').textContent;
            const date = document.getElementById('date').value;
            const timeRange = document.getElementById('timeDropdown').textContent;
            const repeat = document.getElementById('repeatDropdown').textContent;
            const name = document.getElementById('name').value;
            const purpose = document.getElementById('purpose').value;
            // TODO: add email here
            
            // Validate
            if (!date || timeRange === 'Select a time' || !name || !purpose) {
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
            
            try {
                const response = await fetch('/api/bookings', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(bookingData)
                });
                
                const result = await response.json();
                
                if (response.ok) {
                    alert('Room booked successfully!');
                    // Clear form
                    document.getElementById('name').value = '';
                    document.getElementById('purpose').value = '';
                } else {
                    alert('Error: ' + result.error);
                }
            } catch (error) { // TODO: add more functionality to display what the error is
                console.error('Error:', error);
                alert('There is an overlap in bookings');
            }
        });
    }
});
