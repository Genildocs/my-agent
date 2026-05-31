import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "highlight.js/styles/github-dark.css"; // theme do syntax highlight
import "./globals.css";

const container = document.getElementById("root");
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}
