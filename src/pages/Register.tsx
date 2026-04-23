import { useState } from "react";
import { FaEye, FaEyeSlash } from "react-icons/fa";
import "../assets/css/admin css/Login.css"; // reuse same styles for now
import { useNavigate, Link } from "react-router-dom";
import DaLogo from "../assets/images/Logo.png";
import { registerUser } from "../components/Registration/authRegistration"; // ✅ from auth.ts

const ROLES = ["admin", "technician", "jo"] as const;
type Role = (typeof ROLES)[number];

const Register: React.FC = () => {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    role: "" as Role | "",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const { email, password, confirmPassword, role } = formData;

    if (!email || !password || !confirmPassword || !role) {
      setError("Please fill in all fields.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);

    const { error: registerError } = await registerUser(email, password, role);

    setLoading(false);

    if (registerError) {
      setError(registerError.message);
      return;
    }

    setSubmitted(true);
  };

  // ✅ Success screen
  if (submitted) {
    return (
      <div className="login-page">
        <div className="login-container">
          <div className="login-left"></div>
          <div className="login-right">
            <img className="login-da-icon" src={DaLogo} alt="DA logo" />
            <h1>Check your email</h1>
            <p>
              A confirmation link was sent to <strong>{formData.email}</strong>.
              The user must click it before they can log in.
            </p>
            <button
              className="login-button"
              onClick={() => navigate("/dashboard")}
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-left"></div>

        <div className="login-right">
          <img className="login-da-icon" src={DaLogo} alt="DA logo" />
          <h1>Create Account</h1>
          <h3>REGISTER</h3>

          {error && <div className="error-message">{error}</div>}

          <form onSubmit={handleRegister}>
            {/* Role Selector */}
            <label>Role</label>
            <select
              name="role"
              value={formData.role}
              onChange={handleChange}
              required
            >
              <option value="" disabled>
                Select a role
              </option>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r.charAt(0).toUpperCase() + r.slice(1)}
                </option>
              ))}
            </select>

            {/* Email */}
            <label>Email</label>
            <input
              type="email"
              name="email"
              placeholder="Enter email"
              value={formData.email}
              onChange={handleChange}
              required
            />

            {/* Password */}
            <label>Password</label>
            <div className="password-container">
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                placeholder="Min. 6 characters"
                value={formData.password}
                onChange={handleChange}
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

            {/* Confirm Password */}
            <label>Confirm Password</label>
            <div className="password-container">
              <input
                type={showConfirm ? "text" : "password"}
                name="confirmPassword"
                placeholder="Repeat password"
                value={formData.confirmPassword}
                onChange={handleChange}
                required
              />
              <button
                type="button"
                className="toggle-password"
                onClick={() => setShowConfirm(!showConfirm)}
                aria-label="Toggle confirm password visibility"
              >
                {showConfirm ? <FaEyeSlash /> : <FaEye />}
              </button>
            </div>

            <button type="submit" className="login-button" disabled={loading}>
              {loading ? "Creating account…" : "Register"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Register;
