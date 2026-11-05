import { useState } from "react";
import Navbar from "./components/Navbar";
import ModuleMenu from "./components/ModuleMenu";
import Workspace from "./Workspace";
import { MODULES } from "./modules";

export default function App() {
  const [activeModule, setActiveModule] = useState(null);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      <Navbar activeModule={activeModule} onHome={() => setActiveModule(null)} />
      <div style={{ flex: 1, minHeight: 0 }}>
        {activeModule ? (
          <Workspace key={activeModule.id} config={activeModule} onBack={() => setActiveModule(null)} />
        ) : (
          <ModuleMenu modules={MODULES} onSelect={setActiveModule} />
        )}
      </div>
    </div>
  );
}
