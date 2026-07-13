import React from "react";
import { createRoot } from "react-dom/client";
import "./style.css";
import { ThemeProvider } from "@/components/theme-provider";
import App from "./App";

const container = document.getElementById("root");
if (!container) throw new Error("No se encontró el elemento #root");

const root = createRoot(container);

root.render(
    <React.StrictMode>
        <ThemeProvider>
            <App />
        </ThemeProvider>
    </React.StrictMode>,
);
