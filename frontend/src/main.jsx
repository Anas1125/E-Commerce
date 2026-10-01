import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "./index.css";
import App from "./App";
import AuthProvider from "./context/AuthContext";
import { SiteBrandingProvider } from "./context/site-branding";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <AuthProvider>
      <SiteBrandingProvider>
        <App />
      </SiteBrandingProvider>
    </AuthProvider>
  </StrictMode>,
);
