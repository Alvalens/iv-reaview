import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles/globals.css";

// StrictMode disabled: double-mount breaks WebSocket sessions
// (first connection gets cleaned up, session marked COMPLETED before second connects)
createRoot(document.getElementById("root")!).render(<App />);
