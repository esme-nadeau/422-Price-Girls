import React, { useEffect } from "react";
import { analytics } from "./firebase";
import { createRoom } from "./rooms";
import BookingForm from "./BookingForm";

function App() {
  useEffect(() => {
    console.log("Firebase Analytics initialized:", analytics);
  }, []);

  return (
    <div style={{ textAlign: "center", marginTop: "2rem" }}>
      <h1>Firebase + React connected!</h1>

      <button
        style={{ marginTop: "1rem" }}
        onClick={() => createRoom("Room202")}
      >
        Create Test Room
      </button>

      {/* Render the BookingForm component here */}
      <div style={{ marginTop: "3rem", padding: "1rem", borderTop: "1px solid #eee" }}>
        <BookingForm />
        </div>
    </div>
  );
}

export default App;
