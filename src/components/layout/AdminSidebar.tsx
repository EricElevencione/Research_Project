import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import LogoImage from "../../assets/images/Logo.png";
import HomeIcon from "../../assets/images/home.png";
import RSBSAIcon from "../../assets/images/rsbsa.png";
import ApproveIcon from "../../assets/images/approve.png";
import LogoutIcon from "../../assets/images/logout.png";
import IncentivesIcon from "../../assets/images/incentives.png";
import InventoryIcon from "../../assets/images/distribution.png";
import "./sidebarStyle.css";
import { supabase } from "../../supabase";

interface AdminSidebarProps {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}

const AdminSidebar: React.FC<AdminSidebarProps> = ({ sidebarOpen, setSidebarOpen }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  const handleLogout = () => {
    localStorage.removeItem("isAuthenticated");
    navigate("/");
  };

  const navItems = [
    { path: "/dashboard", icon: HomeIcon, text: "Home" },
    { path: "/rsbsa", icon: RSBSAIcon, text: "RSBSA" },
    { path: "/incentives", icon: IncentivesIcon, text: "Subsidy" },
    { path: "/inventory", icon: InventoryIcon, text: "Inventory" },
    { path: "/masterlist", icon: ApproveIcon, text: "Masterlist" },
    { path: "/audit-trail", icon: "📜", text: "Audit Trail" },
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
                {typeof item.icon === "string" && !item.icon.includes("/") && !item.icon.includes(".") ? (
                  <span style={{ fontSize: "20px" }}>{item.icon}</span>
                ) : (
                  <img src={item.icon as string} alt={item.text} />
                )}
              </span>
              <span className="nav-text">{item.text}</span>
            </button>
          ))}

          <button className="sidebar-nav-item logout" onClick={handleLogout}>
            <span className="nav-icon">
              <img src={LogoutIcon} alt="Logout" />
            </span>
            <span className="nav-text">Logout</span>
          </button>

        </nav>
      </div>
      <div
        className={`tech-incent-sidebar-overlay ${sidebarOpen ? "active" : ""}`}
        onClick={() => setSidebarOpen(false)}
      />
    </>
  );
};

export default AdminSidebar;
