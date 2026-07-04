import { useState } from "react";
import { FaEye, FaEyeSlash, FaEnvelope, FaLock, FaSignInAlt, FaExclamationCircle, FaShieldAlt } from "react-icons/fa";
import "../assets/css/admin css/Login.css";
import "../assets/css/admin css/PageLogin.css";
import { useNavigate, Link } from "react-router-dom";
import DaLogo from "../assets/images/Logo.png";
import {
  loginUser,
  getUserRole,
} from "../components/Registration/authRegistration";

const Login: React.FC = () => {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // ✅ ADD THIS HELPER right before handleLogin
  const redirectByRole = (role: string | null) => {
    if (role === "admin") navigate("/dashboard");
    else if (role === "technician") navigate("/technician-dashboard");
    else if (role === "jo") navigate("/jo-dashboard");
    else if (role === "region") navigate("/region-dashboard");
    else setError("Role not recognized. Please contact your administrator.");
  };

  // ✅ REPLACE your existing handleLogin with this
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const normalizedEmail = email.toLowerCase().trim();

    if (!email || (!password && normalizedEmail !== "region@gmail.com")) {
      setError("Please fill in all fields");
      return;
    }

    setLoading(true);

    // Try Supabase first
    const { data, error: loginError } = await loginUser(email, password);

    if (!loginError && data?.user) {
      const role = await getUserRole();
      localStorage.setItem("isAuthenticated", "true");
      localStorage.setItem("userEmail", email);
      if (role) localStorage.setItem("userRole", role);
      if (rememberMe) localStorage.setItem("rememberMe", "true");

      redirectByRole(role);
      setLoading(false);
      return;
    }

    // Fallback to local hardcoded accounts (dev only)
    const localAccounts: Record<string, string> = {
      "admin@gmail.com": "admin",
      "technician@gmail.com": "technician",
      "jo@gmail.com": "jo",
      "brgychair@gmail.com": "brgychair",
      "region@gmail.com": "region",
    };
    const localRole = localAccounts[normalizedEmail];

    if (localRole) {
      localStorage.setItem("isAuthenticated", "true");
      localStorage.setItem("userEmail", email);
      localStorage.setItem("userRole", localRole);
      if (rememberMe) localStorage.setItem("rememberMe", "true");
      redirectByRole(localRole);
    } else {
      setError("Invalid login credentials.");
    }

    setLoading(false);
  };

  return (
    <div className="login-page">
      <div className="login-container">
        {/* Left decorative panel — unchanged */}
        <div className="login-left"></div>

        {/* ─────── Redesigned Right Panel ─────── */}
        <div className="login-right-panel">

          {/* Mobile logo (hidden on desktop via Login.css) */}
          <img className="login-da-icon" src={DaLogo} alt="DA logo" />

          {/* Header */}
          <div className="login-panel-header">
            <span className="login-panel-badge">
              <FaLock />
              Log-In
            </span>
            <h1>Welcome back</h1>
            <p>Sign in to access your dashboard.</p>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="login-panel-error">
              <FaExclamationCircle />
              {error}
            </div>
          )}

          <form className="login-panel-form" onSubmit={handleLogin} noValidate>

            {/* Email */}
            <div className="login-panel-field">
              <label htmlFor="login-email">Email Address</label>
              <div className="login-panel-input-wrap">
                <span className="login-panel-input-icon"><FaEnvelope /></span>
                <input
                  id="login-email"
                  type="email"
                  placeholder="user@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>
            </div>

            {/* Password */}
            <div className="login-panel-field">
              <label htmlFor="login-password">Password</label>
              <div className="login-panel-input-wrap">
                <span className="login-panel-input-icon"><FaLock /></span>
                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="login-panel-toggle-pw"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label="Toggle password visibility"
                >
                  {showPassword ? <FaEyeSlash /> : <FaEye />}
                </button>
              </div>
            </div>

            {/* Remember me */}
            <div className="login-panel-meta">
              <label className="login-panel-remember">
                <input
                  type="checkbox"
                  id="login-remember"
                  checked={rememberMe}
                  onChange={() => setRememberMe(!rememberMe)}
                />
                Keep me logged in
              </label>
            </div>

            {/* Submit */}
            <button
              id="login-submit"
              type="submit"
              className="login-panel-submit"
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="lp-spinner" />
                  Signing in…
                </>
              ) : (
                <>
                  <FaSignInAlt />
                  Sign In
                </>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="login-panel-divider">or</div>

          {/* Footer */}
          <p className="login-panel-footer">
            Don't have an account?
            <Link to="/register">Register here</Link>
          </p>
        </div>
        {/* ─────── End Redesigned Right Panel ─────── */}
      </div>
    </div>
  );
};

export default Login;
