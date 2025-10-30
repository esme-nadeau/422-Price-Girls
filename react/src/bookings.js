// src/bookings.js
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { db } from './firebase'; // db should come from your Firebase config

/**
 * Add a new booking to Firestore.
 * Expects all times as JavaScript Date objects and the date-only string as ISO (YYYY-MM-DD).
 */
export async function addNewBooking({
  roomId,
  userId,
  startDateTime, // JS Date
  endDateTime,   // JS Date
  status,
  dateISO,       // 'YYYY-MM-DD' string for the calendar date
  purpose,
  email,
}) {
  try {
    const newBooking = {
      roomId,
      userId,
      date: dateISO, // keep a date-only string for easy filtering/grouping
      startTime: Timestamp.fromDate(startDateTime),
      endTime: Timestamp.fromDate(endDateTime),
      status,
      purpose,
      email,
    };

    const docRef = await addDoc(collection(db, 'bookings'), newBooking);
    console.log('Document written with ID: ', docRef.id);
    return docRef.id;
  } catch (e) {
    console.error('Error adding document: ', e);
    throw e;
  }
}
