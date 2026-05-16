import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "../../supabase";
import "./sidebarStyle.css";

// Assets
import LogoImage from "../../assets/images/Logo.png";
import HomeIcon from "../../assets/images/home.png";
import RSBSAIcon from "../../assets/images/rsbsa.png";
import ApproveIcon from "../../assets/images/approve.png";
import LogoutIcon from "../../assets/images/logout.png";
import IncentivesIcon from "../../assets/images/incentives.png";

interface TechSidebarProps {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}

const TechSidebar: React.FC<TechSidebarProps> = ({ sidebarOpen, setSidebarOpen }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [currentUser, setCurrentUser] = useState<{
    firstName: string;
    lastName: string;
  } | null>(null);

  const isActive = (path: string) => location.pathname === path;

  useEffect(() => {
    const fetchCurrentUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const firstName = user.user_metadata?.first_name || "";
        const lastName = user.user_metadata?.last_name || "";
        setCurrentUser({ firstName, lastName });
      }
    };
    fetchCurrentUser();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem("isAuthenticated");
    navigate("/login");
  };

  const navItems = [
    { path: "/technician-dashboard", label: "Dashboard", icon: HomeIcon },
    { path: "/technician-rsbsa", label: "RSBSA Registration", icon: RSBSAIcon },
    { path: "/technician-incentives", label: "Subsidy", icon: IncentivesIcon },
    { path: "/technician-masterlist", label: "Masterlist", icon: ApproveIcon },
    { path: "/technician-tenant-registry", label: "Tenant Registry", icon: ApproveIcon },
  ];

  return (
    <>
      <div className={`sidebar ${sidebarOpen ? "sidebar-open" : ""}`}>
        <nav className="sidebar-nav">
          <div className="sidebar-logo">
            <img src={LogoImage} alt="Logo" />
          </div>

          {navItems.map((item) => (
            <button
              key={item.path}
              className={`sidebar-nav-item ${isActive(item.path) ? "active" : ""}`}
              onClick={() => {
                navigate(item.path);
                setSidebarOpen(false);
              }}
            >
              <span className="nav-icon">
                <img src={item.icon} alt={item.label} />
              </span>
              <span className="nav-text">{item.label}</span>
            </button>
          ))}

          <button className="sidebar-nav-item logout" onClick={handleLogout}>
            <span className="nav-icon">
              <img src={LogoutIcon} alt="Logout" />
            </span>
            <span className="nav-text">Logout</span>
          </button>
        </nav>

        {currentUser && (
          <div className="sidebar-current-user">
            <div className="sidebar-current-user-avatar">
              {currentUser.firstName.charAt(0).toUpperCase()}
              {currentUser.lastName.charAt(0).toUpperCase()}
            </div>
            <div className="sidebar-current-user-info">
              <span className="sidebar-current-user-name">
                {currentUser.firstName} {currentUser.lastName}
              </span>
              <span className="sidebar-current-user-label">Logged in</span>
            </div>
          </div>
        )}
      </div>

      {/* Sidebar overlay for mobile */}
      <div
        className={`tech-incent-sidebar-overlay ${sidebarOpen ? "active" : ""}`}
        onClick={() => setSidebarOpen(false)}
      ></div>
    </>
  );
};

export default TechSidebar;
