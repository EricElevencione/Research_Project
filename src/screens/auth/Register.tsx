import { useState } from "react";
import { FaEye, FaEyeSlash, FaUser, FaEnvelope, FaLock, FaUserTag, FaCheckCircle, FaExclamationCircle } from "react-icons/fa";
import "../../assets/css/admin css/Login.css";
import "../../assets/css/admin css/Register.css";
import { useNavigate, Link } from "react-router-dom";
import { registerUser } from "../../components/Registration/authRegistration"; // ✅ from auth.ts

const ROLES = ["technician", "jo"] as const;
type Role = (typeof ROLES)[number];

/** Returns 0-3 strength score for the password bar */
function getPasswordStrength(pw: string): number {
  if (!pw) return 0;
  let score = 0;
  if (pw.length >= 6) score++;
  if (pw.length >= 10) score++;
  if (/[A-Z]/.test(pw) && /[0-9]/.test(pw)) score++;
  return score;
}

const Register: React.FC = () => {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
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

    const { email, password, confirmPassword, role, firstName, lastName } =
      formData;

    if (!email || !password || !confirmPassword || !role || !firstName || !lastName) {
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

    const { error: registerError } = await registerUser(
      email,
      password,
      role,
      firstName,
      lastName,
    );
    setLoading(false);

    if (registerError) {
      setError(registerError.message);
      return;
    }

    setSubmitted(true);
  };

  const strength = getPasswordStrength(formData.password);
  const strengthLabels = ["", "weak", "medium", "strong"];

  // ✅ Success screen
  if (submitted) {
    return (
      <div className="login-page">
        <div className="login-container">
          <div className="login-left"></div>
          <div className="register-right">
            <div className="register-success">
              <div className="register-success-icon">✅</div>
              <h2>Account Created!</h2>
              <p>
                A confirmation link was sent to{" "}
                <strong>{formData.email}</strong>. The user must click it
                before they can log in.
              </p>
              <button
                className="register-submit-btn"
                style={{ maxWidth: 220, marginTop: 8 }}
                onClick={() => navigate("/dashboard")}
              >
                Back to Dashboard
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="login-page">
      <div className="login-container">
        {/* Left decorative panel — unchanged */}
        <div className="login-left"></div>

        {/* ─────── Redesigned Right Panel ─────── */}
        <div className="register-right">

          {/* Header */}
          <div className="register-header">
            <span className="register-badge">
              <FaUserTag />
              New Account
            </span>
            <h1>Create your account</h1>
            <p>Fill in the details below to register a new user.</p>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="register-error">
              <FaExclamationCircle />
              {error}
            </div>
          )}

          <form className="register-form" onSubmit={handleRegister} noValidate>

            {/* Row: First Name + Last Name */}
            <div className="register-row">
              <div className="register-field">
                <label htmlFor="reg-firstName">First Name</label>
                <div className="register-input-wrapper">
                  <span className="register-input-icon"><FaUser /></span>
                  <input
                    id="reg-firstName"
                    type="text"
                    name="firstName"
                    placeholder="e.g. Juan"
                    value={formData.firstName}
                    onChange={handleChange}
                    required
                    autoComplete="given-name"
                  />
                </div>
              </div>

              <div className="register-field">
                <label htmlFor="reg-lastName">Last Name</label>
                <div className="register-input-wrapper">
                  <span className="register-input-icon"><FaUser /></span>
                  <input
                    id="reg-lastName"
                    type="text"
                    name="lastName"
                    placeholder="e.g. dela Cruz"
                    value={formData.lastName}
                    onChange={handleChange}
                    required
                    autoComplete="family-name"
                  />
                </div>
              </div>
            </div>

            {/* Role */}
            <div className="register-field">
              <label htmlFor="reg-role">Role</label>
              <div className="register-input-wrapper">
                <span className="register-input-icon"><FaUserTag /></span>
                <select
                  id="reg-role"
                  name="role"
                  value={formData.role}
                  onChange={handleChange}
                  required
                >
                  <option value="" disabled>Select a role…</option>
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r.charAt(0).toUpperCase() + r.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Email */}
            <div className="register-field">
              <label htmlFor="reg-email">Email Address</label>
              <div className="register-input-wrapper">
                <span className="register-input-icon"><FaEnvelope /></span>
                <input
                  id="reg-email"
                  type="email"
                  name="email"
                  placeholder="user@example.com"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  autoComplete="email"
                />
              </div>
            </div>

            {/* Password */}
            <div className="register-field">
              <label htmlFor="reg-password">Password</label>
              <div className="register-input-wrapper">
                <span className="register-input-icon"><FaLock /></span>
                <input
                  id="reg-password"
                  type={showPassword ? "text" : "password"}
                  name="password"
                  placeholder="Min. 6 characters"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  className="register-toggle-pw"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label="Toggle password visibility"
                >
                  {showPassword ? <FaEyeSlash /> : <FaEye />}
                </button>
              </div>
              {/* Strength bar */}
              {formData.password && (
                <div className="password-strength">
                  {[1, 2, 3].map((seg) => (
                    <div
                      key={seg}
                      className={`strength-segment ${strength >= seg ? strengthLabels[strength] : ""}`}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Confirm Password */}
            <div className="register-field">
              <label htmlFor="reg-confirmPassword">Confirm Password</label>
              <div className="register-input-wrapper">
                <span className="register-input-icon"><FaLock /></span>
                <input
                  id="reg-confirmPassword"
                  type={showConfirm ? "text" : "password"}
                  name="confirmPassword"
                  placeholder="Repeat your password"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  required
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  className="register-toggle-pw"
                  onClick={() => setShowConfirm(!showConfirm)}
                  aria-label="Toggle confirm password visibility"
                >
                  {showConfirm ? <FaEyeSlash /> : <FaEye />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              id="register-submit"
              type="submit"
              className="register-submit-btn"
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="btn-spinner" />
                  Creating account…
                </>
              ) : (
                <>
                  <FaCheckCircle />
                  Register Account
                </>
              )}
            </button>
          </form>

          {/* Footer */}
          <p className="register-footer-link">
            Already have an account?
            <Link to="/login">Sign in here</Link>
          </p>
        </div>
        {/* ─────── End Redesigned Right Panel ─────── */}
      </div>
    </div>
  );
};

export default Register;
