
import { useEffect, useState } from "react";

function App() {
  const [message, setMessage] = useState("Connecting to backend...");
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    fetch("https://backend-rho-one-80.vercel.app/api/health")
      .then((response) => {
        if (!response.ok) {
          throw new Error("Backend request failed");
        }
        return response.json();
      })
      .then((data) => {
        setMessage(
          data.status === "OK"
            ? "Express Backend Connected!"
            : "Unexpected response"
        );
        setStatus("success");
      })
      .catch(() => {
        setMessage("Backend connect nahi ho raha");
        setStatus("error");
      });
  }, []);

  return (
    <main style={{
      fontFamily: "Arial, sans-serif",
      minHeight: "100vh",
      display: "grid",
      placeItems: "center",
      background: "#0b0e14",
      color: "white",
      textAlign: "center"
    }}>
      <div>
        <h1>SMIT Hackathon Starter</h1>
        <p>React + Express.js</p>
        <h2 style={{
          color: status === "success"
            ? "#4ade80"
            : status === "error"
            ? "#f87171"
            : "#facc15"
        }}>
          {message}
        </h2>
        <p>Full Stack Project Ready 🚀</p>
      </div>
    </main>
  );
}

export default App;
