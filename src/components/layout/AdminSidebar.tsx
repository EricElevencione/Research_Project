import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import LogoImage from "../../assets/images/Logo.png";
import HomeIcon from "../../assets/images/home.png";
import RSBSAIcon from "../../assets/images/rsbsa.png";
import ApproveIcon from "../../assets/images/approve.png";
import LogoutIcon from "../../assets/images/logout.png";
import IncentivesIcon from "../../assets/images/incentives.png";
import InventoryIcon from "../../assets/images/distribution.png";
import { supabase } from "../../supabase";
import "./sidebarStyle.css";

interface AdminSidebarProps {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}

const AdminSidebar: React.FC<AdminSidebarProps> = ({ sidebarOpen, setSidebarOpen }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [currentUser, setCurrentUser] = useState<{ firstName: string; lastName: string } | null>(null);

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
      <div
        className={`tech-incent-sidebar-overlay ${sidebarOpen ? "active" : ""}`}
        onClick={() => setSidebarOpen(false)}
      />
    </>
  );
};

export default AdminSidebar;
