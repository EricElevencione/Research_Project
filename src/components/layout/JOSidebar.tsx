import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import LogoImage from "../../assets/images/Logo.png";
import {
  FaHome,
  FaIdCard,
  FaGift,
  FaListAlt,
  FaMap,
  FaScroll,
  FaSignOutAlt,
  FaPersonBooth,
  FaClipboardList,
} from "react-icons/fa";
import { supabase } from "../../supabase";
import "./sidebarStyle.css";

interface JOSidebarProps {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}

const navItems = [
  { path: "/jo-dashboard", icon: <FaHome />, text: "Home" },
  { path: "/jo-rsbsapage", icon: <FaIdCard />, text: "Registration" },
  { path: "/jo-incentives", icon: <FaGift />, text: "Subsidy" },
  { path: "/jo-masterlist", icon: <FaListAlt />, text: "Masterlist" },
  { path: "/jo-farmer-registry", icon: <FaPersonBooth />, text: "Farmers" },
  {
    path: "/jo-landowner-registry",
    icon: <FaClipboardList />,
    text: "Land Owners",
  },
  { path: "/jo-land-registry", icon: <FaMap />, text: "Land Registry" },
  { path: "/jo-land-history-report", icon: <FaScroll />, text: "Land History" },
];

const JOSidebar: React.FC<JOSidebarProps> = ({
  sidebarOpen,
  setSidebarOpen,
}) => {
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

  const handleLogout = () => {
    localStorage.removeItem("isAuthenticated");
    navigate("/");
  };

  const handleNav = (path: string) => {
    navigate(path);
    setSidebarOpen(false);
  };

  return (
    <>
      <div className={`sidebar ${sidebarOpen ? "sidebar-open" : ""}`}>
        {/* Logo */}
        <div className="sidebar-logo">
          <img src={LogoImage} alt="DA Logo" />
          <span className="sidebar-logo-title">JO Portal</span>
        </div>

        {/* Navigation */}
        <nav className="sidebar-nav">
          <span className="sidebar-section-label">Navigation</span>

          {navItems.map((item) => (
            <button
              key={item.path}
              className={`sidebar-nav-item ${isActive(item.path) ? "active" : ""}`}
              onClick={() => handleNav(item.path)}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-text">{item.text}</span>
            </button>
          ))}

          <div className="sidebar-separator" />

          {/* Logout */}
          <button className="sidebar-nav-item logout" onClick={handleLogout}>
            <span className="nav-icon">
              <FaSignOutAlt />
            </span>
            <span className="nav-text">Logout</span>
          </button>
        </nav>

        {/* User card */}
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

      {/* Overlay (mobile) */}
      <div
        className={`tech-incent-sidebar-overlay ${sidebarOpen ? "active" : ""}`}
        onClick={() => setSidebarOpen(false)}
      />
    </>
  );
};

export default JOSidebar;
