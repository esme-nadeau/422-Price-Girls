// src/BookingForm.js
import React, { useState } from 'react';
import { addNewBooking } from './bookings';

function BookingForm() {
  const [roomId, setRoomId] = useState('');
  const [userId, setUserId] = useState('');
  const [email, setEmail] = useState('');
  const [purpose, setPurpose] = useState('');
  const [date, setDate] = useState('');         // <input type="date"> -> 'YYYY-MM-DD'
  const [startTime, setStartTime] = useState(''); // 'HH:MM' (24h)
  const [endTime, setEndTime] = useState('');     // 'HH:MM'
  const [status, setStatus] = useState('pending');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const [repetitionType, setRepetitionType] = useState('none');
  const [selectedDaysOfWeek, setSelectedDaysOfWeek] = useState([]);
  const [repeatUntilDate, setRepeatUntilDate] = useState('');

  const daysOfWeekOptions = [
    { name: 'Sunday', value: 0 }, { name: 'Monday', value: 1 },
    { name: 'Tuesday', value: 2 }, { name: 'Wednesday', value: 3 },
    { name: 'Thursday', value: 4 }, { name: 'Friday', value: 5 },
    { name: 'Saturday', value: 6 },
  ];

  const handleDayToggle = (dayValue) => {
    setSelectedDaysOfWeek((prevDays) =>
      prevDays.includes(dayValue)
        ? prevDays.filter((day) => day !== dayValue)
        : [...prevDays, dayValue]
    );
  };

  // Build a local JS Date from ISO date ('YYYY-MM-DD') and 'HH:MM'
  const makeLocalDateTime = (dateISO, hhmm) => {
    const [y, m, d] = dateISO.split('-').map(Number);
    const [hh, mm] = hhmm.split(':').map(Number);
    return new Date(y, (m || 1) - 1, d || 1, hh || 0, mm || 0, 0, 0);
  };

  const isValidISODate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value);
  const isValidHHMM = (value) => /^\d{2}:\d{2}$/.test(value);

  const sameYMD = (a, b) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      // --- Basic Client-Side Validations ---
      if (!roomId || !userId || !email || !purpose || !date || !startTime || !endTime) {
        throw new Error('Please fill in all required booking fields.');
      }
      if (repetitionType !== 'none' && !repeatUntilDate) {
        throw new Error('Please provide a repetition end date.');
      }
      if (repetitionType === 'weekly' && selectedDaysOfWeek.length === 0) {
        throw new Error('Please select at least one day for weekly repetition.');
      }
      if (!/\S+@\S+\.\S+/.test(email)) {
        throw new Error('Please enter a valid email address.');
      }

      // Date & time format checks aligned to input types
      if (!isValidISODate(date)) {
        throw new Error('Invalid date format detected. Please ensure date is YYYY-MM-DD.');
      }
      if (!isValidHHMM(startTime) || !isValidHHMM(endTime)) {
        throw new Error('Invalid time format detected. Ensure times are HH:MM (24-hour).');
      }

      // Construct Date objects (local time)
      const initialBookingStartDateTime = makeLocalDateTime(date, startTime);
      const initialBookingEndDateTime = makeLocalDateTime(date, endTime);

      if (isNaN(initialBookingStartDateTime.getTime()) || isNaN(initialBookingEndDateTime.getTime())) {
        throw new Error('Could not construct a valid date/time. Check your inputs.');
      }
      if (initialBookingStartDateTime >= initialBookingEndDateTime) {
        throw new Error('Start time must be before end time.');
      }

      // Prevent past dates (date-only)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const bookingDateOnly = makeLocalDateTime(date, '00:00');
      if (bookingDateOnly < today) {
        throw new Error('Booking date cannot be in the past.');
      }

      if (repetitionType !== 'none') {
        if (!isValidISODate(repeatUntilDate)) {
          throw new Error('Repeat-until date must be in YYYY-MM-DD format.');
        }
        const endRepeatDateCheck = makeLocalDateTime(repeatUntilDate, '23:59');
        if (endRepeatDateCheck < bookingDateOnly) {
          throw new Error('Repetition end date cannot be before the start date.');
        }
      }

      let bookingsCreatedCount = 0;

      if (repetitionType === 'none') {
        await addNewBooking({
          roomId,
          userId,
          email,
          purpose,
          startDateTime: initialBookingStartDateTime,
          endDateTime: initialBookingEndDateTime,
          status,
          dateISO: date,
        });
        bookingsCreatedCount = 1;
      } else {
        // Repeating bookings
        let currentDate = new Date(bookingDateOnly);
        const endRepeatDate = makeLocalDateTime(repeatUntilDate, '23:59');

        while (currentDate <= endRepeatDate) {
          const dayOfWeek = currentDate.getDay();
          let shouldBookThisDay = false;

          if (repetitionType === 'daily') {
            shouldBookThisDay = true;
          } else if (repetitionType === 'weekly') {
            if (selectedDaysOfWeek.includes(dayOfWeek)) {
              shouldBookThisDay = true;
            }
          }

          if (shouldBookThisDay) {
            const specificStart = new Date(
              currentDate.getFullYear(),
              currentDate.getMonth(),
              currentDate.getDate(),
              initialBookingStartDateTime.getHours(),
              initialBookingStartDateTime.getMinutes(),
              0,
              0
            );

            const specificEnd = new Date(
              currentDate.getFullYear(),
              currentDate.getMonth(),
              currentDate.getDate(),
              initialBookingEndDateTime.getHours(),
              initialBookingEndDateTime.getMinutes(),
              0,
              0
            );

            // Skip days where start >= end (shouldn't happen, but defensive)
            if (specificStart < specificEnd) {
              await addNewBooking({
                roomId,
                userId,
                email,
                purpose,
                startDateTime: specificStart,
                endDateTime: specificEnd,
                status,
                dateISO: `${currentDate.getFullYear()}-${String(
                  currentDate.getMonth() + 1
                ).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`,
              });
              bookingsCreatedCount++;
            }
          }

          // Advance one day
          currentDate.setDate(currentDate.getDate() + 1);

          // Safety guard to prevent infinite loops on DST anomalies:
          // if times drift, reset to midnight
          if (!sameYMD(currentDate, makeLocalDateTime(
            `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`,
            '00:00'
          ))) {
            currentDate = makeLocalDateTime(
              `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`,
              '00:00'
            );
          }
        }

        if (bookingsCreatedCount === 0) {
          throw new Error(
            'No bookings were created based on your repetition settings. Ensure the repetition range and selected days are valid.'
          );
        }
      }

      console.log(`Successfully created ${bookingsCreatedCount} booking(s).`);
      setSuccess(true);

      // Reset form
      setRoomId('');
      setUserId('');
      setEmail('');
      setPurpose('');
      setDate('');
      setStartTime('');
      setEndTime('');
      setStatus('pending');
      setRepetitionType('none');
      setSelectedDaysOfWeek([]);
      setRepeatUntilDate('');
    } catch (err) {
      console.error('Failed to create booking(s):', err);
      setError(err.message || 'An unknown error occurred while adding bookings.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <h2>Book a Room</h2>
      {error && <p style={{ color: 'red' }}>Error: {error}</p>}
      {success && <p style={{ color: 'green' }}>Booking successful!</p>}

      <label>
        Room ID:
        <input type="text" value={roomId} onChange={(e) => setRoomId(e.target.value)} required />
      </label>
      <label>
        User ID (for demo - in real app, get from auth):
        <input type="text" value={userId} onChange={(e) => setUserId(e.target.value)} required />
      </label>
      <label>
        Email:
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </label>
      <label>
        Purpose:
        <textarea value={purpose} onChange={(e) => setPurpose(e.target.value)} required />
      </label>

      <label>
        Date (first occurrence):
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
      </label>
      <label>
        Start Time:
        <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} required />
      </label>
      <label>
        End Time:
        <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} required />
      </label>
      <label>
        Status:
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="pending">Pending</option>
          <option value="confirmed">Confirmed</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </label>

      <h3>Repetition</h3>
      <label>
        Repeat:
        <select value={repetitionType} onChange={(e) => setRepetitionType(e.target.value)}>
          <option value="none">Does not repeat</option>
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
        </select>
      </label>

      {repetitionType !== 'none' && (
        <>
          <label>
            Repeat until:
            <input type="date" value={repeatUntilDate} onChange={(e) => setRepeatUntilDate(e.target.value)} required />
          </label>
        </>
      )}

      {repetitionType === 'weekly' && (
        <fieldset>
          <legend>Repeat on these days:</legend>
          {daysOfWeekOptions.map((day) => (
            <label key={day.value}>
              <input
                type="checkbox"
                value={day.value}
                checked={selectedDaysOfWeek.includes(day.value)}
                onChange={() => handleDayToggle(day.value)}
              />
              {day.name}
            </label>
          ))}
        </fieldset>
      )}

      <button type="submit" disabled={loading}>
        {loading ? 'Adding Booking(s)...' : 'Add Booking(s)'}
      </button>
    </form>
  );
}

export default BookingForm;
