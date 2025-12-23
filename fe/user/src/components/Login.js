import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import './Login.css';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const result = await login(username, password);
    
    if (!result.success) {
      setError(result.message);
    }
    
    setLoading(false);
  };

  return (
    <div className="login-container">
      <div className="login-content">
        {/* Left Side: Login Form */}
        <div className="login-form-section">
          <div className="login-form-wrapper">
            {/* Logo Section */}
            <div className="logo-section">
              <div className="logo-icon">
                <svg className="logo-svg" fill="none" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                  <path d="M42.4379 44C42.4379 44 36.0744 33.9038 41.1692 24C46.8624 12.9336 42.2078 4 42.2078 4L7.01134 4C7.01134 4 11.6577 12.932 5.96912 23.9969C0.876273 33.9029 7.27094 44 7.27094 44L42.4379 44Z" fill="currentColor"></path>
                </svg>
              </div>
              <h2 className="logo-text">Smart Garden</h2>
            </div>

            {/* Header Text */}
            <div className="header-section">
              <h2 className="welcome-title">Welcome back</h2>
              <p className="welcome-subtitle">
                Please enter your credentials to access the management dashboard.
              </p>
            </div>

            {/* Form Section */}
            <div className="form-section">
              {error && (
                <div className="error-alert">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="login-form">
                {/* Username Field */}
                <div className="form-group">
                  <label htmlFor="username" className="form-label">
                    Username
                  </label>
                  <div className="input-wrapper">
                    <div className="input-icon-left">
                      <span className="material-symbols-outlined">person</span>
                    </div>
                    <input
                      id="username"
                      name="username"
                      type="text"
                      autoComplete="username"
                      required
                      className="form-input with-icon-left"
                      placeholder="Enter your username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      disabled={loading}
                    />
                  </div>
                </div>

                {/* Password Field */}
                <div className="form-group">
                  <label htmlFor="password" className="form-label">
                    Password
                  </label>
                  <div className="input-wrapper">
                    <div className="input-icon-left">
                      <span className="material-symbols-outlined">lock</span>
                    </div>
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      required
                      className="form-input with-icon-left with-icon-right"
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={loading}
                    />
                    <div 
                      className="password-toggle"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      <span className="material-symbols-outlined">
                        {showPassword ? 'visibility' : 'visibility_off'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Remember Me / Forgot Password */}
                <div className="form-options">
                  <div className="remember-me">
                    <input
                      id="remember-me"
                      name="remember-me"
                      type="checkbox"
                      className="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                    />
                    <label htmlFor="remember-me" className="checkbox-label">
                      Remember me
                    </label>
                  </div>
                  <div className="forgot-password">
                    <a href="#" className="forgot-link">Forgot password?</a>
                  </div>
                </div>

                {/* Submit Button */}
                <div className="submit-section">
                  <button
                    type="submit"
                    className="submit-button"
                    disabled={loading}
                  >
                    {loading ? 'Signing in...' : 'Sign in'}
                  </button>
                </div>
              </form>
            </div>

            {/* Footer */}
            <p className="footer-text">
              © 2024 Smart Garden Corp. System Access Only.
            </p>
          </div>
        </div>

        {/* Right Side: Hero Image */}
        <div className="hero-section">
          <img
            className="hero-image"
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuCGnj_PgFdf93xrg_s46LheieLMCOpiBOTPkXETejn8paNua1haYxNqlV7bWTa0fQpcbXIorsP6q5UR6JIKPRnr4LSQ2CTGLzuwt3DBSBGaRfRJt7lKGWL4P80HjCfNOKo1kErIMBljlJ31HmsfXcDACDY0MNeMwpiwuTJfyVrrLyPzQqqQ7YdkM1CKRGb0X9WjmVfCRMH0Gw1yq9s3iJIHn1x90XfPNY2P6gtaysJ0eT8mNH-w32ZC6XdAXO_xJJBbb4uj767VGH-k"
            alt="Futuristic greenhouse interior with glowing green lights and modern hydroponic plants"
          />
          {/* Overlay Gradients */}
          <div className="hero-overlay-gradient"></div>
          <div className="hero-overlay-primary"></div>
          
          {/* Hero Content */}
          <div className="hero-content">
            <div className="hero-text">
              <div className="version-badge">
                <span>v2.4.0 Stable</span>
              </div>
              <h1 className="hero-title">Cultivating the Future</h1>
              <p className="hero-description">
                Advanced monitoring and automation for your smart agricultural ecosystems.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
