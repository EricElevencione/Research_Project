import { useState } from "react";
import Login from "./Login";

import "../css/Dashboard.css"

export const Dashboard = () => {
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
            <img src="" alt="" />
            <ul>
                <li className="btn"><button>Home</button></li>
                <li className="btn"><button>Active Farmers</button></li>
                <li className="btn"><button>Lands</button></li>
                <li className="btn"><button>Submit Files</button></li>
                <li className="btn"><button>Transmit Map</button></li>
            </ul>
        </div>
    );
};
