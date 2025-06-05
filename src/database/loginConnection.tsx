import { useState } from "react";
import { FaEye, FaEyeSlash } from "react-icons/fa";
import "../assets/css/Login.css"; // Login page styling
import { useNavigate } from 'react-router-dom'; // Router for navigation

// Props interface definition
// @role - Defines which user type this form is for (Admin/Corporate/Individual)
interface LoginProps {
    role: string;
}

// Main Login Component
const Login: React.FC<LoginProps> = ({ role }) => {
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
    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        // Basic validation
        if (!email || !password) {
            setError("Please fill in all fields");
            return;
        }

        try {
            // For demo purposes, accept any non-empty email/password
            // In a real application, you would validate against a backend
            if (email && password) {
                // Set authentication
                localStorage.setItem('isAuthenticated', 'true');
                localStorage.setItem('userEmail', email);

                // If remember me is checked, set a longer expiration
                if (rememberMe) {
                    localStorage.setItem('rememberMe', 'true');
                }

                // Navigate to dashboard
                navigate('/dashboard');
            } else {
                setError("Invalid credentials");
            }
        } catch (error) {
            console.error('Login failed:', error);
            setError("Login failed. Please try again.");
        }
    };

    return (
        <div className="login-page">
            <div className="login-container">
                {/* Left section containing branding and marketing text */}
                <div className="login-left">
                    <h1>Welcome Back</h1>
                    <p>Access your farmland management system</p>
                </div>

                {/* Right section containing login form */}
                <div className="login-right">
                    {/* Dynamic heading showing user role */}
                    <h2>LOGIN</h2>

                    {error && <div className="error-message">{error}</div>}

                    {/* Login Form */}
                    <form onSubmit={handleLogin}>
                        {/* Email Field */}
                        <label>Email</label>
                        <input
                            type="email"
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
