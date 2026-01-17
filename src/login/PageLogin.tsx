import { useState } from "react";
import { FaEye, FaEyeSlash } from "react-icons/fa";
import "../assets/css/admin css/Login.css"; // Login page styling
import { useNavigate } from 'react-router-dom'; // Router for navigation

// Main Login Component
const Login: React.FC = () => {
    // Navigation hook for client-side routing
    const navigate = useNavigate();

    // State Management
    // -----------------
    const [email, setEmail] = useState(""); // Stores email input
    const [password, setPassword] = useState(""); // Stores password input
    const [showPassword, setShowPassword] = useState(false); // Toggles password visibility
    const [rememberMe, setRememberMe] = useState(false); // Stores remember me preference
    const [error, setError] = useState("");

    // Form submission handler
    // Prevents default form behavior and navigates to dashboard
    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        if (!email || !password) {
            setError("Please fill in all fields");
            return;
        }

        const normalizedEmail = (email || '').toLowerCase().trim();
        let userRole = '';
        if (normalizedEmail === 'admin@gmail.com') {
            userRole = 'admin';
        } else if (normalizedEmail === 'technician@gmail.com') {
            userRole = 'technician';
        } else if (normalizedEmail === 'jo@gmail.com') {
            userRole = 'jo';
        } else if (normalizedEmail === 'brgychair@gmail.com') {
            userRole = 'brgychair';
        } else {
            setError("Invalid email for this role.");
            return;
        }

        // Set authentication
        localStorage.setItem('isAuthenticated', 'true');
        localStorage.setItem('userEmail', email);
        localStorage.setItem('userRole', userRole);
        if (rememberMe) {
            localStorage.setItem('rememberMe', 'true');
        }
        // Navigate based on role
        if (userRole === 'technician') {
            navigate('/technician-dashboard');
        } else if (userRole === 'admin') {
            navigate('/dashboard');
        } else if (userRole === 'jo') {
            navigate('/jo-dashboard');
        } else if (userRole === 'brgychair') {
            navigate('/brgy-chair-dashboard');
        }
    };

    return (
        <div className="login-page">
            <div className="login-container">
                {/* Left section containing branding and marketing text */}
                <div className="login-left">
                </div>

                {/* Right section containing login form */}
                <div className="login-right">
                    {/* Dynamic heading showing user role */}
                    <h1>Welcome back</h1>

                    <h3>LOGIN</h3>

                    {error && <div className="error-message">{error}</div>}

                    {/* Login Form */}
                    <form onSubmit={handleLogin}>
                        {/* Email Field */}
                        <label>Email</label>
                        <input
                            type="text"
                            placeholder="Enter your email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />

                        {/* Password Field with Toggle */}
                        <label>Password</label>
                        <div className="password-container">
                            <input
                                type={showPassword ? "text" : "password"}
                                placeholder="Enter your password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                            {/* Toggle visibility button */}
                            <button
                                type="button"
                                className="toggle-password"
                                onClick={() => setShowPassword(!showPassword)}
                                aria-label="Toggle password visibility"
                            >
                                {showPassword ? <FaEyeSlash /> : <FaEye />}
                            </button>
                        </div>

                        {/* Remember Me Checkbox */}
                        <div className="checkbox-container">
                            <input
                                type="checkbox"
                                id="remember"
                                checked={rememberMe}
                                onChange={() => setRememberMe(!rememberMe)}
                            />
                            <label htmlFor="remember" className="remember-label">Keep me logged in</label>
                        </div>

                        {/* Submit Button */}
                        <button type="submit" className="login-button">Log In</button>

                        {/* Forgotten Password Link */}
                        <p className="forgot-password">Forgot password?</p>
                    </form>
                </div>
            </div>
        </div>
    );
};

// Default Export
export default Login;
