import "../assets/css/Dashboard.css";

export const Dashboard = () => {
    return (
        <div>
            <h1>Dashboard</h1>
            <p>Welcome to the dashboard!</p>
            <img src="" alt="" />
            <ul>
                <li className="btn">
                    <button>Home</button>
                </li>
                <li className="btn">
                    <button>Active Farmers</button>
                </li>
                <li className="btn">
                    <button>Lands</button>
                </li>
                <li className="btn">
                    <button>Submit Files</button>
                </li>
                <li className="btn">
                    <button>Transmit Map</button>
                </li>
            </ul>
        </div>
    );
};