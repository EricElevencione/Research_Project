import { useState } from "react";
import Login from "./Login";
import "./assets/css/App.css";

const App = () => {
  // Holds the selected role: "admin" or "technician". Initially, it's null.
  const [role, setRole] = useState<string | null>(null);

  // If a role is selected, show the Login component with that role.
  if (role) {
    return <Login role={role} />;
  }

  // Otherwise, show the role selection screen.
  return (
    <div>
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
};

export default App;

