import { db } from "./firebase";
// doc creates ref pointer, setdoc writes data to reference
import { doc, setDoc } from "firebase/firestore";
import { seedAllRooms } from "./rooms";

// function definition to call
export const createRoom = async (roomId) => {
    const timeslots = {}; // half-hour timeslots

    for (let hour = 8; hour < 20; hour++) { // 8:00am - 7:30pm (change as needed)
        for (let min of ["00", "30"]) { // loop populates timeslotes and initializes everything
            const time = `${hour.toString().padStart(2, "0")}:${min}`;
            timeslots[time] = {
                isBooked: false,
                user: null,
                email: null,
                purpose: null,
                repeats: false
            };
        }
    }
    await seedAllRooms();
    // KEY LINE: creates collection=rooms reference, writes object to firestore
    await setDoc(doc(db, "rooms", roomId), {
        name: roomId,
        calendar: timeslots
    });
};

// call as createRoom("roomname")
