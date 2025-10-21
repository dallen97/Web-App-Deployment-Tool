import { createBrowserRouter } from "react-router-dom";
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";

//Create routes for the website

const router = createBrowserRouter([
  {
    // Landing Page
    path: "/",
    element: <LandingPage />,
    children: [],
  },
  // Login Page
  {
    path: "/login",
    element: <LoginPage />
  }
]);

export default router;
