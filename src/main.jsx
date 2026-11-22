import React, { Suspense, lazy } from "react";
import ReactDOM from "react-dom/client";

// L'appli de pointage s'ouvre avec ?vue=pointage (site) ou automatiquement dans l'APK (build "pointage").
const params = new URLSearchParams(window.location.search);
const isPointage = import.meta.env.VITE_APP === "pointage" || params.get("vue") === "pointage";

const Root = lazy(() => (isPointage ? import("./pointage/Pointage.jsx") : import("./App.jsx")));

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Suspense fallback={null}>
      <Root />
    </Suspense>
  </React.StrictMode>
);
