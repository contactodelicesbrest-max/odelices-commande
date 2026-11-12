import { useCallback, useState } from "react";
import { StoreProvider, useStore } from "./lib/store.jsx";
import Kiosk from "./kiosk/Kiosk.jsx";
import Admin from "./admin/Admin.jsx";
import PinPad from "./admin/PinPad.jsx";

function Shell() {
  const { data } = useStore();
  const [mode, setMode] = useState("kiosk"); // kiosk | pin | admin
  const toKiosk = useCallback(() => setMode("kiosk"), []);
  const toAdmin = useCallback(() => setMode("admin"), []);
  if (mode === "admin") return <Admin onExit={toKiosk} />;
  return (
    <>
      <Kiosk onAdmin={() => setMode("pin")} />
      {mode === "pin" && <PinPad pin={data.settings.adminPin} onOk={toAdmin} onCancel={toKiosk} />}
    </>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  );
}
