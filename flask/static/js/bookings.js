// Helper: show a lightweight booking error dialog without blocking the whole page
window.showBookingErrorModal = function(message) {
    const body = document.getElementById('bookingErrorModalBody');
    const modalEl = document.getElementById('bookingErrorModal');

    if (body) {
        body.textContent = message;
    }

    if (modalEl) {
        // Manually show the dialog without using Bootstrap's backdrop logic
        modalEl.classList.add('show');
        modalEl.style.display = 'block';
        modalEl.removeAttribute('aria-hidden');
        modalEl.setAttribute('aria-modal', 'true');
        modalEl.setAttribute('role', 'dialog');

        // Ensure close buttons hide the dialog
        const closeButtons = modalEl.querySelectorAll('[data-bs-dismiss="modal"]');
        closeButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                modalEl.classList.remove('show');
                modalEl.style.display = 'none';
                modalEl.setAttribute('aria-hidden', 'true');
                modalEl.removeAttribute('aria-modal');
            }, { once: true });
        });
    } else {
        // Fallback if the dialog markup is not present on this page
        alert(message);
    }
};

// Function to initialize booking button - can be called after content loads
window.initBookingButton = function(containerId) {
    // Try to find button in specified container or active tab, then fall back to document
    let bookButton = null;
    let container = null;
    
    if (containerId) {
        container = document.getElementById(containerId);
    }
    
    if (!container) {
        // Try to find active tab (Bootstrap uses 'show active' classes)
        container = document.querySelector('.tab-pane.show.active') || 
                    document.querySelector('#nav-map.show, #nav-calendar.show, #nav-bookings.show');
    }
    
    if (container) {
        bookButton = container.querySelector('#bookRoomBtn');
    }
    
    if (!bookButton) {
        bookButton = document.getElementById('bookRoomBtn');
    }
    
    if (!bookButton) {
        console.warn('Book Room button not found');
        return;
    }
    
    // Check if button already has a listener (prevent duplicate initialization)
    if (bookButton.dataset.initialized === 'true') {
        console.log('Book button already initialized, skipping');
        return;
    }
    
    // Remove any existing listeners by cloning the button
    const newButton = bookButton.cloneNode(true);
    bookButton.parentNode.replaceChild(newButton, bookButton);
    newButton.dataset.initialized = 'true';
    
    newButton.addEventListener('click', async function(e) {
            e.preventDefault();
            
            // Get form values - try to find in the container that has the button
            const getElement = (id) => {
                // Find the tab pane that contains this button (re-evaluate at click time)
                const buttonContainer = newButton.closest('.tab-pane') || 
                                       document.querySelector('.tab-pane.show.active') ||
                                       document.querySelector('#nav-map.show, #nav-calendar.show');
                if (buttonContainer) {
                    const el = buttonContainer.querySelector('#' + id);
                    if (el) return el;
                }
                return document.getElementById(id);
            };
            
            const roomEl = getElement('selectedRoom');
            const dateEl = getElement('date_right');
            const startTimeEl = getElement('start_time_right');
            const endTimeEl = getElement('end_time_right');
            const repeatEl = getElement('repeatDropdown');
            const emailEl = getElement('email');
            const purposeEl = getElement('purpose');
            
            const room = roomEl ? roomEl.textContent.trim() : '';
            const date = dateEl ? dateEl.value : '';
            const startTime = startTimeEl ? startTimeEl.textContent.trim() : '';
            const endTime = endTimeEl ? endTimeEl.textContent.trim() : '';
            const timeRange = `${startTime} - ${endTime}`;
            const repeat = repeatEl ? repeatEl.textContent.trim() : '';
            const email = emailEl ? emailEl.value.trim() : '';
            const purpose = purposeEl ? purposeEl.value.trim() : '';
            
            // Validate
            if (room === 'Select Room' || !room) {
                alert('Please select a room');
                return;
            }
            if (!date || !startTime || !endTime || !email || !purpose) {
                alert('Please fill in all required fields');
                return;
            }
            
            // Prepare booking data
            const bookingData = {
                room: room,
                date: date,
                timeRange: timeRange,
                repeat: repeat,
                email: email,
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
                    // Refresh map bookings to update room colors
                    if (typeof window.refreshMapBookings === 'function') {
                        window.refreshMapBookings();
                    }
                    // Refresh calendar bookings to update grid
                    if (typeof window.refreshCalendarBookings === 'function') {
                        window.refreshCalendarBookings();
                    }
                    // Clear form
                    const emailInput = getElement('email');
                    const purposeInput = getElement('purpose');
                    if (emailInput) emailInput.value = '';
                    if (purposeInput) purposeInput.value = '';
                } else {
                    // Handle different error types
                    const errorMsg = result.error || 'Failed to book room. Please try again.';
                    console.error('Booking failed:', errorMsg);
                    
                    // Special handling for overlap conflicts (409)
                    if (response.status === 409) {
                        alert('Booking Conflict:\n\n' + errorMsg + '\n\nPlease select a different time slot.');
                    } else {
                        alert('Error: ' + errorMsg);
                    }
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
