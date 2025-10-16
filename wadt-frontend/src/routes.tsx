import { createBrowserRouter } from "react-router-dom";
import LandingPage from "./pages/LandingPage";

//Create routes for the website

const router = createBrowserRouter([
  {
    // Landing Page
    path: "/",
    element: <LandingPage />,
    children: [],
  },
]);

export default router;
