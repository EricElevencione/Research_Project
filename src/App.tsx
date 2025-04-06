// Corrected App.tsx
import { Route, Routes } from "react-router-dom"; // Only import what's needed here
import { Dashboard } from "./assets/components/Dashboard";
import Login from "./assets/components/Login";

function App() {
  return (
    // No BrowserRouter here - it's already in main.tsx
    <div className="App">
      <h1>App Component Loaded</h1> {/* Let's keep this for testing */}
      <Routes> {/* Routes need to be direct children of the Router context (provided by main.tsx) */}
        <Route path="/" element={<Dashboard />} />
        <Route path="/Login" element={<Login role="default" />} />
      </Routes>
    </div>
  );
};
export default App;