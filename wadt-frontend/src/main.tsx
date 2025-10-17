import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./ui/index.css";
import LandingPage from "./pages/LandingPage";

import router from "./routes.tsx";


//Until Routes are properly implemented, for testing,
//import the file you want to look at, then
//add the name of the file under <StrictMode>

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <LandingPage />
  </StrictMode>
);
