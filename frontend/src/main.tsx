import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { TooltipProvider } from "./components/ui/tooltip";
import App from "./App.tsx";
import "./index.css";

const basename = import.meta.env.PROD ? "/geminicli-desktop-advanced" : "";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter basename={basename}>
      <TooltipProvider>
        <App />
      </TooltipProvider>
    </BrowserRouter>
  </StrictMode>
);