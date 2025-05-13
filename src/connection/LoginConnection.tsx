import { useState } from "react";
import "../assets/css/Login.css"; // Importing CSS for styles
import { useNavigate } from 'react-router-dom';

// Define the props interface so that Login expects a "role" prop of type string.
interface LoginProps {
    role: string;
}

const Login: React.FC<LoginProps> = ({ role }) => {
    const navigate = useNavigate();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [rememberMe, setRememberMe] = useState(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        navigate('/dashboard', { replace: true });
    };

    return (
        <div className="login-container">
            <div className="login-left">
                <h1>Fintechdb</h1>
                <p>Secure your financial future with us.</p>
            </div>
            <div className="login-right">
                {/* Display the role in the login header */}
                <h2>{role.toUpperCase()} LOGIN</h2>
                <form onSubmit={handleSubmit}>
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
                        >
                            {showPassword ? "🙈" : "👁️"}
                        </button>
                    </div>

                    <div className="checkbox-container">
                        <input
                            type="checkbox"
                            id="remember"
                            checked={rememberMe}
                            onChange={() => setRememberMe(!rememberMe)}
                        />
                        <label htmlFor="remember">Keep me logged in</label>
                    </div>

                    <button type="submit" className="login-button">Log In</button>
                    <p className="forgot-password">Forgot password?</p>
                </form>
            </div>
        </div>
    );
};

export default Login;
