import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

const RegisterPage: React.FC = () => {
    const navigate = useNavigate();
    const { role } = useParams();
    const [form, setForm] = useState({
        username: '',
        email: '',
        password: '',
        confirmPassword: ''
    });
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const validateUsername = (username: string) => {
        if (role === 'admin') return username.endsWith('.dev');
        if (role === 'technician') return username.endsWith('.tech');
        return false;
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setForm({ ...form, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        if (!validateUsername(form.username)) {
            setError(`Username must end with ${role === 'admin' ? '.dev' : '.tech'}`);
            return;
        }
        if (!form.email || !form.password || !form.confirmPassword) {
            setError('All fields are required.');
            return;
        }
        if (form.password !== form.confirmPassword) {
            setError('Passwords do not match.');
            return;
        }
        try {
            const res = await fetch('/api/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: form.username,
                    email: form.email,
                    password: form.password,
                    role
                })
            });
            if (res.ok) {
                setSuccess('Registration successful! Redirecting to login...');
                setTimeout(() => navigate(`/login/${role}`), 1500);
            } else {
                const data = await res.json();
                setError(data.message || 'Registration failed.');
            }
        } catch (err) {
            setError('Registration failed.');
        }
    };

    return (
        <div className="register-container">
            <h2>Register as {role === 'admin' ? 'Admin' : 'Technician'}</h2>
            <form onSubmit={handleSubmit} className="register-form">
                <label>Username</label>
                <input
                    type="text"
                    name="username"
                    value={form.username}
                    onChange={handleChange}
                    placeholder={role === 'admin' ? 'yourname.dev' : 'yourname.tech'}
                    required
                />
                <label>Email</label>
                <input
                    type="email"
                    name="email"
                    value={form.email}
                    onChange={handleChange}
                    required
                />
                <label>Password</label>
                <input
                    type="password"
                    name="password"
                    value={form.password}
                    onChange={handleChange}
                    required
                />
                <label>Confirm Password</label>
                <input
                    type="password"
                    name="confirmPassword"
                    value={form.confirmPassword}
                    onChange={handleChange}
                    required
                />
                {error && <div className="error-message">{error}</div>}
                {success && <div className="success-message">{success}</div>}
                <button type="submit">Register</button>
                <button type="button" onClick={() => navigate(-1)} style={{ marginLeft: '10px' }}>Cancel</button>
            </form>
        </div>
    );
};

export default RegisterPage; 