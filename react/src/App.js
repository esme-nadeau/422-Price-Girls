import React, { useEffect } from "react";
import { analytics } from "./firebase";

function App() {
  useEffect(() => {
    console.log("Firebase Analytics initialized:", analytics);
  }, []);

  return (
    <div style={{ textAlign: "center", marginTop: "2rem" }}>
      <h1>Firebase + React connected!</h1>
    </div>
  );
}

export default App;
