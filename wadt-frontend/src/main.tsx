import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom"; // new
import "./ui/index.css";
//import LandingPage from "./pages/LandingPage"; // Temp commenting this to see if routing works

import router from "./routes.tsx";


//Until Routes are properly implemented, for testing,
//import the file you want to look at, then
//add the name of the file under <StrictMode>

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>
);
