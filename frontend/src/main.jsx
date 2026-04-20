import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles/index.css";

// Register service worker (handles push notifications + offline fallback)
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/push-sw.js", { scope: "/" }).catch(() => {});
  });
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
