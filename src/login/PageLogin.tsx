import { useState } from "react";
import { FaEye, FaEyeSlash } from "react-icons/fa";
import "../assets/css/admin css/Login.css";
import { useNavigate, Link } from "react-router-dom";
import DaLogo from "../assets/images/Logo.png";
import {
  loginUser,
  getUserRole,
} from "../components/Registration/authRegistration"; // ✅ from auth.ts

const Login: React.FC = () => {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email || !password) {
      setError("Please fill in all fields");
      return;
    }

    setLoading(true);

    const { data, error: loginError } = await loginUser(email, password);

    if (loginError) {
      setError(loginError.message);
      setLoading(false);
      return;
    }

    // Get role from Supabase user metadata
    const role = await getUserRole();

    if (rememberMe) {
      localStorage.setItem("rememberMe", "true");
    }

    // Navigate based on role
    if (role === "admin") {
      navigate("/dashboard");
    } else if (role === "technician") {
      navigate("/technician-dashboard");
    } else if (role === "jo") {
      navigate("/jo-dashboard");
    } else {
      setError("Role not recognized. Please contact your administrator.");
    }

    setLoading(false);
  };

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-left"></div>

        <div className="login-right">
          <img className="login-da-icon" src={DaLogo} alt="DA logo" />
          <h1>Welcome back</h1>
          <h3>LOGIN</h3>

          {error && <div className="error-message">{error}</div>}

          <form onSubmit={handleLogin}>
            <label>Email</label>
            <input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <label>Password</label>
            <div className="password-container">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                className="toggle-password"
                onClick={() => setShowPassword(!showPassword)}
                aria-label="Toggle password visibility"
              >
                {showPassword ? <FaEyeSlash /> : <FaEye />}
              </button>
            </div>

            <div className="checkbox-container">
              <input
                type="checkbox"
                id="remember"
                checked={rememberMe}
                onChange={() => setRememberMe(!rememberMe)}
              />
              <label htmlFor="remember" className="remember-label">
                Keep me logged in
              </label>
            </div>

            <button type="submit" className="login-button" disabled={loading}>
              {loading ? "Logging in…" : "Log In"}
            </button>

            <p className="forgot-password">
              Didn't have an account yet?{" "}
              <Link to="/register" className="register-link">
                Register here
              </Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;
