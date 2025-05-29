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

    // Form submission handler
    // Prevents default form behavior and navigates to dashboard
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        // Future Enhancement: Add actual authentication logic here
        navigate('/dashboard', { replace: true });
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
                    <h2>{role.toUpperCase()} LOGIN</h2>

                    {/* Login Form */}
                    <form onSubmit={handleSubmit}>
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
                                {showPassword ? <FaEyeSlash/> : <FaEye/>}
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
