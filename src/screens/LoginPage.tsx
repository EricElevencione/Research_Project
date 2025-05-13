// Corrected App.tsx
import Login from "../connection/loginConnection";
import { useState } from "react";

function App() {
  const [role, setRole] = useState<string | null>(null);

  if (role) {
    return <Login role={role} />;
  }

  return (
    <div className="App">
      <h1>App Component Loaded</h1>
      <h1>Dashboard</h1>
      <p>Welcome back!</p>
      <div>
        <button onClick={() => setRole("admin")}>Admin Login</button>
      </div>
      <div>
        <button onClick={() => setRole("technician")}>Technician Login</button>
      </div>
    </div>
  );
}

export default App;
