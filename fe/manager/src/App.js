import React, { useState, useEffect } from 'react';
import './App.css';
import Reminders from './components/Reminders';

// API Base URL - change this to switch between environments
const API_BASE_URL = 'https://beiot.onrender.com';
// Helper to call API directly without CRA proxy
const apiFetch = (path, options = {}) => fetch(`${API_BASE_URL}${path}`, options);

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [stats, setStats] = useState({
    users: 0,
    devices: 0,
    plants: 0,
    onlineDevices: 0
  });

  // Check if user is already logged in
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      // Verify token and get user info
      fetchUserProfile(token);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchUserProfile = async (token) => {
    try {
      const response = await apiFetch('/api/auth/profile', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const userData = await response.json();
        // Cho phép cả manager và user đăng nhập
        if (userData.role === 'manager' || userData.role === 'user') {
          setUser(userData);
          setIsLoggedIn(true);
          fetchStats(token);
        } else {
          localStorage.removeItem('token');
        }
      } else {
        localStorage.removeItem('token');
      }
    } catch (error) {
      console.error('Failed to fetch profile:', error);
      localStorage.removeItem('token');
    }
  };

  const fetchStats = async (token) => {
    try {
      const [usersRes, devicesRes, plantsRes] = await Promise.all([
        apiFetch('/api/users/my-users', {
          headers: { 'Authorization': `Bearer ${token || localStorage.getItem('token')}` }
        }),
        apiFetch('/api/devices/stats/overview', {
          headers: { 'Authorization': `Bearer ${token || localStorage.getItem('token')}` }
        }),
        apiFetch('/api/plants/my-plants', {
          headers: { 'Authorization': `Bearer ${token || localStorage.getItem('token')}` }
        })
      ]);

      if (usersRes.ok && devicesRes.ok && plantsRes.ok) {
        const usersData = await usersRes.json();
        const devicesData = await devicesRes.json();
        const plantsData = await plantsRes.json();
        
        setStats({
          users: usersData.total || 0,
          devices: devicesData.totalDevices || 0,
          plants: plantsData.total || 0,
          onlineDevices: devicesData.onlineDevices || 0
        });
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await apiFetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (response.ok) {
        // Cho phép cả manager và user đăng nhập
        if (data.user.role === 'manager' || data.user.role === 'user') {
          setUser(data.user);
          setIsLoggedIn(true);
          localStorage.setItem('token', data.token);
          fetchStats(data.token);
        } else {
          setError('Tài khoản không có quyền truy cập');
        }
      } else {
        setError(data.message || 'Đăng nhập thất bại');
      }
    } catch (error) {
      setError('Lỗi kết nối server');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setUser(null);
    setCurrentPage('dashboard');
    localStorage.removeItem('token');
  };

  if (!isLoggedIn) {
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
              <p className="welcome-subtitle">Please enter your credentials to access the management dashboard.</p>
            </div>

            {/* Form Section */}
            <div className="form-section">
              {error && <div className="error-alert">{error}</div>}
              
              <form onSubmit={handleLogin} className="login-form">
                {/* Username Field */}
                <div className="form-group">
                  <label className="form-label" htmlFor="username">Username</label>
                  <div className="input-wrapper">
                    <div className="input-icon-left">
                      <span className="material-symbols-outlined">person</span>
                    </div>
                    <input
                      className="form-input with-icon-left"
                      id="username"
                      name="username"
                      type="text"
                      autoComplete="username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Enter your username"
                      required
                      disabled={loading}
                    />
                  </div>
                </div>

                {/* Password Field */}
                <div className="form-group">
                  <label className="form-label" htmlFor="password">Password</label>
                  <div className="input-wrapper">
                    <div className="input-icon-left">
                      <span className="material-symbols-outlined">lock</span>
                    </div>
                    <input
                      className="form-input with-icon-left with-icon-right"
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      required
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
                      className="checkbox"
                      id="remember-me"
                      name="remember-me"
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                    />
                    <label className="checkbox-label" htmlFor="remember-me">Remember me</label>
                  </div>
                  <div className="forgot-password">
                    <a className="forgot-link" href="#">Forgot password?</a>
                  </div>
                </div>

                {/* Submit Button */}
                <div className="submit-section">
                  <button className="submit-button" type="submit" disabled={loading}>
                    {loading ? 'Signing in...' : 'Sign in'}
                  </button>
                </div>
              </form>
            </div>

            {/* Footer */}
            <p className="footer-text">© 2024 Smart Garden Corp. System Access Only.</p>
          </div>
        </div>

        {/* Right Side: Hero Image */}
        <div className="hero-section">
          <img 
            className="hero-image" 
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuCGnj_PgFdf93xrg_s46LheieLMCOpiBOTPkXETejn8paNua1haYxNqlV7bWTa0fQpcbXIorsP6q5UR6JIKPRnr4LSQ2CTGLzuwt3DBSBGaRfRJt7lKGWL4P80HjCfNOKo1kErIMBljlJ31HmsfXcDACDY0MNeMwpiwuTJfyVrrLyPzQqqQ7YdkM1CKRGb0X9WjmVfCRMH0Gw1yq9s3iJIHn1x90XfPNY2P6gtaysJ0eT8mNH-w32ZC6XdAXO_xJJBbb4uj767VGH-k"
            alt="Futuristic greenhouse interior with glowing green lights and modern hydroponic plants"
          />
          {/* Overlay Gradient */}
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
  }

  return (
    <div className="dashboard">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-content">
          <div className="sidebar-top">
            {/* Brand */}
            <div className="brand-section">
              <div className="brand-icon">
                <span className="material-symbols-outlined icon-fill">eco</span>
              </div>
              <div className="brand-text">
                <h1 className="brand-title">Smart Garden</h1>
                <p className="brand-subtitle">{user?.role === 'manager' ? 'Manager View' : 'User View'}</p>
              </div>
            </div>

            {/* Navigation */}
            <nav className="navigation">
              <button 
                className={`nav-item ${currentPage === 'dashboard' ? 'nav-item-active' : ''}`}
                onClick={() => setCurrentPage('dashboard')}
              >
                <span className="material-symbols-outlined icon-fill">dashboard</span>
                <span className="nav-text">Dashboard</span>
              </button>
              {user?.role === 'manager' && (
                <button 
                  className={`nav-item ${currentPage === 'users' ? 'nav-item-active' : ''}`}
                  onClick={() => setCurrentPage('users')}
                >
                  <span className="material-symbols-outlined">group</span>
                  <span className="nav-text">Quản lý người dùng</span>
                </button>
              )}
              {user?.role === 'manager' && (
                <button 
                  className={`nav-item ${currentPage === 'devices' ? 'nav-item-active' : ''}`}
                  onClick={() => setCurrentPage('devices')}
                >
                  <span className="material-symbols-outlined">router</span>
                  <span className="nav-text">Quản lý thiết bị</span>
                </button>
              )}
              <button 
                className={`nav-item ${currentPage === 'plants' ? 'nav-item-active' : ''}`}
                onClick={() => setCurrentPage('plants')}
              >
                <span className="material-symbols-outlined">potted_plant</span>
                <span className="nav-text">Quản lý cây trồng</span>
              </button>
              <button 
                className={`nav-item ${currentPage === 'controls' ? 'nav-item-active' : ''}`}
                onClick={() => setCurrentPage('controls')}
              >
                <span className="material-symbols-outlined">tune</span>
                <span className="nav-text">Điều khiển</span>
              </button>
              <button 
                className={`nav-item ${currentPage === 'reminders' ? 'nav-item-active' : ''}`}
                onClick={() => setCurrentPage('reminders')}
              >
                <span className="material-symbols-outlined">notifications</span>
                <span className="nav-text">Nhắc nhở</span>
              </button>
              <button 
                className={`nav-item ${currentPage === 'garden' ? 'nav-item-active' : ''}`}
                onClick={() => setCurrentPage('garden')}
              >
                <span className="material-symbols-outlined">park</span>
                <span className="nav-text">Xem vườn</span>
              </button>
              <button 
                className={`nav-item ${currentPage === 'info' ? 'nav-item-active' : ''}`}
                onClick={() => setCurrentPage('info')}
              >
                <span className="material-symbols-outlined">info</span>
                <span className="nav-text">Thông tin</span>
              </button>
            </nav>
          </div>

          {/* User Profile Summary at bottom */}
          <div className="user-profile">
            <div className="user-avatar">
              {user?.fullName ? user.fullName.charAt(0).toUpperCase() : 'U'}
            </div>
            <div className="user-info">
              <p className="user-name">{user?.fullName || user?.username}</p>
              <p className="user-role">{user?.role === 'manager' ? 'Manager' : 'User'}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        {/* Top Header - Modern Design */}
        <header className="top-header-modern">
          {/* Left: Page Info */}
          <div className="header-left">
            <div className="page-info">
              <h1 className="page-title">
                {currentPage === 'dashboard' && 'Dashboard'}
                {currentPage === 'users' && 'Quản lý người dùng'}
                {currentPage === 'devices' && 'Quản lý thiết bị'}
                {currentPage === 'plants' && 'Quản lý cây trồng'}
                {currentPage === 'controls' && 'Điều khiển'}
                {currentPage === 'reminders' && 'Nhắc nhở'}
                {currentPage === 'garden' && 'Xem vườn'}
                {currentPage === 'info' && 'Thông tin'}
              </h1>
              <div className="breadcrumb">
                <span className="breadcrumb-item">
                  <span className="material-symbols-outlined">home</span>
                </span>
                <span className="breadcrumb-separator">/</span>
                <span className="breadcrumb-item active">
                  {currentPage === 'dashboard' && 'Tổng quan'}
                  {currentPage === 'users' && 'Người dùng'}
                  {currentPage === 'devices' && 'Thiết bị'}
                  {currentPage === 'plants' && 'Cây trồng'}
                  {currentPage === 'controls' && 'Điều khiển'}
                  {currentPage === 'reminders' && 'Nhắc nhở'}
                  {currentPage === 'garden' && 'Vườn'}
                  {currentPage === 'info' && 'Thông tin'}
                </span>
              </div>
            </div>
          </div>

          {/* Center: Search */}
          <div className="header-center">
            <div className="search-box">
              <span className="material-symbols-outlined search-icon">search</span>
              <input 
                className="search-input" 
                placeholder="Tìm kiếm..." 
                type="text"
              />
              <kbd className="search-shortcut">⌘K</kbd>
            </div>
          </div>

          {/* Right: Actions & User */}
          <div className="header-right">
            <button className="header-icon-btn" title="Thông báo">
              <span className="material-symbols-outlined">notifications</span>
              <span className="notification-badge">3</span>
            </button>
            <button className="header-icon-btn" title="Cài đặt">
              <span className="material-symbols-outlined">settings</span>
            </button>
            
            <div className="header-divider"></div>
            
            <div className="user-menu">
              <div className="user-menu-avatar">
                {user?.fullName ? user.fullName.charAt(0).toUpperCase() : 'U'}
              </div>
              <div className="user-menu-info">
                <span className="user-menu-name">{user?.fullName || user?.username}</span>
                <span className="user-menu-role">{user?.role === 'manager' ? 'Manager' : 'User'}</span>
              </div>
              <button className="logout-btn" onClick={handleLogout} title="Đăng xuất">
                <span className="material-symbols-outlined">logout</span>
              </button>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="page-content">
          {currentPage === 'dashboard' && <DashboardPage stats={stats} user={user} />}
          {currentPage === 'users' && <UsersPage />}
          {currentPage === 'devices' && <DevicesPage />}
          {currentPage === 'plants' && <PlantsPage />}
          {currentPage === 'controls' && <ControlsPage />}
          {currentPage === 'reminders' && <RemindersPage />}
          {currentPage === 'garden' && <GardenPage />}
          {currentPage === 'info' && <InfoPage user={user} />}
        </div>
      </main>
    </div>
  );
}

// Dashboard Page Component
function DashboardPage({ stats, user }) {
  const [harvestPlants, setHarvestPlants] = useState([]);
  const [devices, setDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [sensorData, setSensorData] = useState({
    temperature: { value: null, unit: '°C' },
    humidity: { value: null, unit: '%' },
    light: { value: null, unit: 'lux' },
    soil_moisture: { value: null, unit: '%' },
    wind: { value: null, unit: 'km/h' },
    loading: true
  });
  const [isConnected, setIsConnected] = useState(false);
  const [weatherForecast, setWeatherForecast] = useState({
    current: null,
    daily: [],
    loading: true,
    location: 'Hà Nội'
  });
  const socketRef = React.useRef(null);

  // Helper to update sensor data without losing existing values
  const updateSensorData = (newData) => {
    setSensorData(prev => ({
      temperature: { value: newData.temperature ?? prev.temperature?.value, unit: '°C' },
      humidity: { value: newData.humidity ?? prev.humidity?.value, unit: '%' },
      light: { value: newData.light ?? prev.light?.value, unit: 'lux' },
      soil_moisture: { value: newData.soil_moisture ?? prev.soil_moisture?.value, unit: '%' },
      wind: { value: newData.wind ?? prev.wind?.value, unit: 'km/h' },
      timestamp: newData.timestamp || prev.timestamp,
      source: newData.source || prev.source,
      deviceName: newData.deviceName || prev.deviceName,
      loading: false
    }));
  };

  // Fetch sensor data for selected device
  const fetchDeviceSensorData = async (deviceId) => {
    if (!deviceId) return;
    
    try {
      const token = localStorage.getItem('token');
      const response = await apiFetch(`/api/thingsboard/device/${deviceId}/sensors`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.available) {
          updateSensorData({
            temperature: data.temperature?.value,
            humidity: data.humidity?.value,
            light: data.light?.value,
            soil_moisture: data.soil_moisture?.value,
            wind: data.wind?.value,
            timestamp: data.timestamp,
            source: data.source,
            deviceName: data.deviceName
          });
        } else {
          setSensorData(prev => ({ 
            ...prev, 
            loading: false,
            deviceName: data.deviceName,
            temperature: { value: null, unit: '°C' },
            humidity: { value: null, unit: '%' },
            light: { value: null, unit: 'lux' },
            soil_moisture: { value: null, unit: '%' },
            wind: { value: null, unit: 'km/h' }
          }));
        }
      }
    } catch (error) {
      console.error('Failed to fetch device sensor data:', error);
    }
  };

  // When selected device changes, fetch its sensor data
  useEffect(() => {
    if (selectedDevice) {
      fetchDeviceSensorData(selectedDevice._id);
    }
  }, [selectedDevice]);

  // Polling for sensor data updates (every 5 seconds)
  useEffect(() => {
    if (!selectedDevice) return;
    
    const interval = setInterval(() => {
      fetchDeviceSensorData(selectedDevice._id);
    }, 5000);

    return () => clearInterval(interval);
  }, [selectedDevice]);

  // WebSocket connection for realtime updates
  useEffect(() => {
    // Dynamic import socket.io-client
    import('socket.io-client').then(({ io }) => {
      const socket = io(API_BASE_URL, {
        transports: ['websocket', 'polling']
      });
      socketRef.current = socket;

      socket.on('connect', () => {
        console.log('✅ WebSocket connected');
        setIsConnected(true);
        // Join user room
        if (user?._id) {
          socket.emit('join-user-room', user._id);
        }
      });

      socket.on('disconnect', () => {
        console.log('❌ WebSocket disconnected');
        setIsConnected(false);
      });

      return () => {
        socket.disconnect();
      };
    });
  }, [user]);

  // Fetch weather forecast from Open-Meteo API
  const fetchWeatherForecast = async () => {
    try {
      // Hà Nội coordinates: 21.0285, 105.8542
      const lat = 21.0285;
      const lon = 105.8542;
      const response = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=Asia%2FBangkok&forecast_days=5`
      );
      
      if (response.ok) {
        const data = await response.json();
        setWeatherForecast({
          current: {
            temperature: data.current?.temperature_2m,
            humidity: data.current?.relative_humidity_2m,
            weatherCode: data.current?.weather_code,
            windSpeed: data.current?.wind_speed_10m
          },
          daily: data.daily?.time?.map((date, i) => ({
            date,
            tempMax: data.daily.temperature_2m_max[i],
            tempMin: data.daily.temperature_2m_min[i],
            weatherCode: data.daily.weather_code[i],
            precipProb: data.daily.precipitation_probability_max[i]
          })) || [],
          loading: false,
          location: 'Hà Nội'
        });
      }
    } catch (error) {
      console.error('Failed to fetch weather forecast:', error);
      setWeatherForecast(prev => ({ ...prev, loading: false }));
    }
  };

  // Weather code to icon mapping
  const getWeatherIcon = (code) => {
    if (code === 0) return 'sunny';
    if (code <= 3) return 'partly_cloudy_day';
    if (code <= 49) return 'foggy';
    if (code <= 69) return 'rainy';
    if (code <= 79) return 'weather_snowy';
    if (code <= 99) return 'thunderstorm';
    return 'cloud';
  };

  const getWeatherDescription = (code) => {
    if (code === 0) return 'Trời quang';
    if (code <= 3) return 'Ít mây';
    if (code <= 49) return 'Sương mù';
    if (code <= 69) return 'Mưa';
    if (code <= 79) return 'Tuyết';
    if (code <= 99) return 'Giông bão';
    return 'Có mây';
  };

  // Initial data fetch
  useEffect(() => {
    fetchDashboardData();
    fetchWeatherForecast();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = { 'Authorization': `Bearer ${token}` };

      const [plantsRes, devicesRes] = await Promise.all([
        apiFetch('/api/plants/harvest/upcoming?threshold=60', { headers }),
        apiFetch('/api/devices', { headers })
      ]);

      if (plantsRes.ok) {
        const plantsData = await plantsRes.json();
        setHarvestPlants(plantsData.slice(0, 5));
      }

      if (devicesRes.ok) {
        const devicesData = await devicesRes.json();
        const deviceList = devicesData.devices || [];
        setDevices(deviceList);
        
        // Set first device as default selected
        if (deviceList.length > 0 && !selectedDevice) {
          setSelectedDevice(deviceList[0]);
        } else if (deviceList.length === 0) {
          setSensorData(prev => ({ ...prev, loading: false }));
        }
      }
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
      setSensorData(prev => ({ ...prev, loading: false }));
    }
  };

  const getDaysUntilHarvest = (plant) => {
    if (!plant.expectedHarvestDate) return null;
    const now = new Date();
    const harvest = new Date(plant.expectedHarvestDate);
    return Math.ceil((harvest - now) / (1000 * 60 * 60 * 24));
  };

  const getPlantIcon = (type) => {
    const icons = { vegetable: 'nutrition', herb: 'grass', fruit: 'psychiatry' };
    return icons[type] || 'eco';
  };

  const getPlantColor = (type) => {
    const colors = {
      vegetable: { bg: '#dcfce7', icon: '#16a34a' },
      herb: { bg: '#d1fae5', icon: '#059669' },
      fruit: { bg: '#fee2e2', icon: '#dc2626' }
    };
    return colors[type] || { bg: '#f1f5f9', icon: '#64748b' };
  };

  const formatDate = () => {
    const days = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
    const now = new Date();
    return `${days[now.getDay()]}, ${now.getDate()} tháng ${now.getMonth() + 1}`;
  };

  return (
    <div>
      {/* Heading Section */}
      <div className="dashboard-header">
        <div className="header-text">
          <h2 className="dashboard-title">Xin chào, {user?.fullName || 'Manager'}</h2>
          <p className="dashboard-subtitle">
            {formatDate()} - Tổng quan vườn
            <span style={{ 
              marginLeft: '1rem', 
              padding: '0.25rem 0.5rem', 
              borderRadius: '9999px',
              fontSize: '0.75rem',
              fontWeight: '600',
              backgroundColor: isConnected ? '#dcfce7' : '#fee2e2',
              color: isConnected ? '#16a34a' : '#dc2626'
            }}>
              {isConnected ? '● Realtime' : '○ Offline'}
            </span>
          </p>
        </div>
      </div>

      {/* Bento Grid Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.5rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1.5rem' }}>
          
          {/* LEFT COLUMN: Weather & Quick Stats */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            
            {/* Main Weather Card */}
            <div style={{
              borderRadius: '0.75rem',
              backgroundColor: 'white',
              padding: '1.25rem',
              boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
              border: '1px solid #e2e8f0',
              position: 'relative',
              overflow: 'hidden'
            }}>
              {/* Background Decoration */}
              <div style={{
                position: 'absolute',
                right: '-2.5rem',
                top: '-2.5rem',
                height: '10rem',
                width: '10rem',
                borderRadius: '50%',
                backgroundColor: 'rgba(76, 190, 0, 0.1)',
                filter: 'blur(3rem)',
                transition: 'all 0.2s'
              }}></div>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem', position: 'relative', zIndex: 10 }}>
                <div>
                  <h3 style={{ fontSize: '1.125rem', fontWeight: '700', color: '#0f172a', margin: '0 0 0.25rem 0' }}>Dữ liệu cảm biến</h3>
                  <p style={{ fontSize: '0.75rem', color: '#64748b', margin: 0 }}>
                    {selectedDevice ? selectedDevice.name : 'Chưa chọn thiết bị'}
                  </p>
                </div>
                <span className="material-symbols-outlined icon-fill" style={{ fontSize: '2.5rem', color: '#fbbf24' }}>sunny</span>
              </div>

              {/* Device Selector */}
              <div style={{ marginBottom: '1rem', position: 'relative', zIndex: 10 }}>
                <select
                  value={selectedDevice?._id || ''}
                  onChange={(e) => {
                    const device = devices.find(d => d._id === e.target.value);
                    setSelectedDevice(device);
                  }}
                  style={{
                    width: '100%',
                    padding: '0.5rem 0.75rem',
                    borderRadius: '0.5rem',
                    border: '1px solid #e2e8f0',
                    backgroundColor: '#f8fafc',
                    fontSize: '0.875rem',
                    color: '#0f172a',
                    cursor: 'pointer'
                  }}
                >
                  {devices.length === 0 ? (
                    <option value="">Chưa có thiết bị</option>
                  ) : (
                    devices.map(device => (
                      <option key={device._id} value={device._id}>
                        {device.name} ({device.deviceId})
                      </option>
                    ))
                  )}
                </select>
              </div>
              
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginBottom: '1.5rem', position: 'relative', zIndex: 10 }}>
                <span style={{ fontSize: '3rem', fontWeight: '800', color: '#0f172a' }}>
                  {sensorData.loading ? '...' : (
                    sensorData.temperature?.value != null ? Math.round(sensorData.temperature.value) : '--'
                  )}°
                </span>
                <span style={{ fontSize: '1.25rem', fontWeight: '500', color: '#64748b' }}>C</span>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', marginBottom: '1.5rem', position: 'relative', zIndex: 10 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', padding: '0.75rem', borderRadius: '0.5rem', backgroundColor: '#f8fafc' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#64748b' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '0.875rem' }}>water_drop</span>
                    <span style={{ fontSize: '0.75rem', fontWeight: '600', textTransform: 'uppercase' }}>Độ ẩm</span>
                  </div>
                  <span style={{ fontSize: '1.125rem', fontWeight: '700', color: '#0f172a' }}>
                    {sensorData.humidity?.value != null ? Math.round(sensorData.humidity.value) : '--'}%
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', padding: '0.75rem', borderRadius: '0.5rem', backgroundColor: '#f8fafc' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#64748b' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '0.875rem' }}>air</span>
                    <span style={{ fontSize: '0.75rem', fontWeight: '600', textTransform: 'uppercase' }}>Gió</span>
                  </div>
                  <span style={{ fontSize: '1.125rem', fontWeight: '700', color: '#0f172a' }}>
                    {sensorData.wind?.value != null ? Math.round(sensorData.wind.value) : '--'} km/h
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', padding: '0.75rem', borderRadius: '0.5rem', backgroundColor: '#f8fafc' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#64748b' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '0.875rem' }}>light_mode</span>
                    <span style={{ fontSize: '0.75rem', fontWeight: '600', textTransform: 'uppercase' }}>Ánh sáng</span>
                  </div>
                  <span style={{ fontSize: '1.125rem', fontWeight: '700', color: '#0f172a' }}>
                    {sensorData.light?.value != null ? Math.round(sensorData.light.value) : '--'} lx
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', padding: '0.75rem', borderRadius: '0.5rem', backgroundColor: '#f8fafc' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#64748b' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '0.875rem' }}>grass</span>
                    <span style={{ fontSize: '0.75rem', fontWeight: '600', textTransform: 'uppercase' }}>Độ ẩm đất</span>
                  </div>
                  <span style={{ fontSize: '1.125rem', fontWeight: '700', color: '#0f172a' }}>
                    {sensorData.soil_moisture?.value != null ? Math.round(sensorData.soil_moisture.value) : '--'}%
                  </span>
                </div>
              </div>
              
              {/* Device Status Mini */}
              <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid #f1f5f9', position: 'relative', zIndex: 10 }}>
                <h4 style={{ fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', color: '#94a3b8', margin: '0 0 0.75rem 0' }}>Trạng thái thiết bị</h4>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
                    <span style={{ color: '#64748b' }}>Online</span>
                    <span className="material-symbols-outlined icon-fill" style={{ color: '#4cbe00' }}>check_circle</span>
                    <span style={{ fontWeight: '700', color: '#0f172a' }}>{stats.onlineDevices}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
                    <span style={{ color: '#64748b' }}>Offline</span>
                    <span className="material-symbols-outlined" style={{ color: '#ef4444' }}>cancel</span>
                    <span style={{ fontWeight: '700', color: '#0f172a' }}>{stats.devices - stats.onlineDevices}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
                    <span style={{ color: '#64748b' }}>Tổng</span>
                    <span className="material-symbols-outlined" style={{ color: '#3b82f6' }}>devices</span>
                    <span style={{ fontWeight: '700', color: '#0f172a' }}>{stats.devices}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Harvest Readiness List */}
            <div style={{
              flex: 1,
              borderRadius: '0.75rem',
              backgroundColor: 'white',
              padding: '1.25rem',
              boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
              border: '1px solid #e2e8f0'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ fontSize: '1.125rem', fontWeight: '700', color: '#0f172a', margin: 0 }}>Sắp thu hoạch</h3>
                <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#4cbe00' }}>{harvestPlants.length} cây</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {harvestPlants.length === 0 ? (
                  <p style={{ color: '#64748b', fontSize: '0.875rem', textAlign: 'center', padding: '1rem 0' }}>
                    Chưa có cây nào sắp thu hoạch
                  </p>
                ) : (
                  harvestPlants.map((plant, index) => {
                    const days = getDaysUntilHarvest(plant);
                    const colors = getPlantColor(plant.type);
                    return (
                      <div key={plant._id || index} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <div style={{ backgroundColor: colors.bg, padding: '0.5rem', borderRadius: '0.5rem' }}>
                              <span className="material-symbols-outlined icon-fill" style={{ color: colors.icon }}>
                                {getPlantIcon(plant.type)}
                              </span>
                            </div>
                            <div>
                              <p style={{ fontWeight: '700', color: '#0f172a', margin: 0 }}>{plant.name}</p>
                              <p style={{ fontSize: '0.75rem', color: '#64748b', margin: 0 }}>
                                {plant.location?.zone || plant.deviceId?.name || 'N/A'}
                              </p>
                            </div>
                          </div>
                          <span style={{ fontSize: '0.875rem', fontWeight: '700', color: days <= 3 ? '#4cbe00' : '#64748b' }}>
                            {days !== null ? (days <= 0 ? 'Sẵn sàng' : `${days} ngày nữa`) : 'N/A'}
                          </span>
                        </div>
                        <div style={{ position: 'relative', height: '0.5rem', width: '100%', borderRadius: '9999px', backgroundColor: '#f1f5f9' }}>
                          <div style={{ 
                            position: 'absolute', top: 0, left: 0, height: '100%', borderRadius: '9999px', 
                            backgroundColor: '#4cbe00', width: `${plant.growthProgress || 0}%` 
                          }}></div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: Device Status & Activity */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            
            {/* Weather Forecast Card - từ API công khai */}
            <div style={{
              borderRadius: '0.75rem',
              backgroundColor: 'white',
              padding: '1.25rem',
              boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
              border: '1px solid #e2e8f0',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                <div>
                  <h3 style={{ fontSize: '1.125rem', fontWeight: '700', margin: '0 0 0.25rem 0' }}>Dự báo thời tiết</h3>
                  <p style={{ fontSize: '0.75rem', opacity: 0.8, margin: 0 }}>
                    📍 {weatherForecast.location} • Open-Meteo API
                  </p>
                </div>
                <span className="material-symbols-outlined icon-fill" style={{ fontSize: '2.5rem', opacity: 0.9 }}>
                  {weatherForecast.loading ? 'cloud' : getWeatherIcon(weatherForecast.current?.weatherCode)}
                </span>
              </div>
              
              {weatherForecast.loading ? (
                <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                  <span style={{ opacity: 0.8 }}>Đang tải...</span>
                </div>
              ) : (
                <>
                  {/* Current Weather */}
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <span style={{ fontSize: '2.5rem', fontWeight: '800' }}>
                      {weatherForecast.current?.temperature != null ? Math.round(weatherForecast.current.temperature) : '--'}°
                    </span>
                    <span style={{ fontSize: '1rem', fontWeight: '500', opacity: 0.8 }}>C</span>
                    <span style={{ marginLeft: '0.5rem', fontSize: '0.875rem', opacity: 0.9 }}>
                      {getWeatherDescription(weatherForecast.current?.weatherCode)}
                    </span>
                  </div>
                  
                  <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '1rem', fontSize: '0.875rem', opacity: 0.9 }}>
                    <span>💧 {weatherForecast.current?.humidity}%</span>
                    <span>💨 {Math.round(weatherForecast.current?.windSpeed || 0)} km/h</span>
                  </div>
                  
                  {/* 5-day Forecast */}
                  <div style={{ 
                    display: 'flex', 
                    gap: '0.5rem', 
                    paddingTop: '1rem', 
                    borderTop: '1px solid rgba(255,255,255,0.2)',
                    overflowX: 'auto'
                  }}>
                    {weatherForecast.daily.slice(0, 5).map((day, i) => {
                      const date = new Date(day.date);
                      const dayName = i === 0 ? 'Hôm nay' : ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'][date.getDay()];
                      return (
                        <div key={i} style={{ 
                          flex: '1', 
                          textAlign: 'center', 
                          padding: '0.5rem',
                          backgroundColor: i === 0 ? 'rgba(255,255,255,0.15)' : 'transparent',
                          borderRadius: '0.5rem',
                          minWidth: '60px'
                        }}>
                          <p style={{ fontSize: '0.75rem', margin: '0 0 0.25rem 0', opacity: 0.8 }}>{dayName}</p>
                          <span className="material-symbols-outlined" style={{ fontSize: '1.25rem' }}>
                            {getWeatherIcon(day.weatherCode)}
                          </span>
                          <p style={{ fontSize: '0.75rem', margin: '0.25rem 0 0 0', fontWeight: '600' }}>
                            {Math.round(day.tempMax)}° / {Math.round(day.tempMin)}°
                          </p>
                          {day.precipProb > 0 && (
                            <p style={{ fontSize: '0.625rem', margin: '0.125rem 0 0 0', opacity: 0.7 }}>
                              🌧 {day.precipProb}%
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
            
            {/* Device Status Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
              {/* Status Card 1 */}
              <div className="stat-card">
                <div className="stat-card-header">
                  <div className="stat-card-icon primary">
                    <span className="material-symbols-outlined icon-fill">memory</span>
                  </div>
                  <span className="stat-card-badge online">Online</span>
                </div>
                <div className="stat-card-content">
                  <p className="stat-card-value">{stats.onlineDevices}/{stats.devices}</p>
                  <p className="stat-card-label">Thiết bị đang hoạt động</p>
                </div>
              </div>
              
              {/* Status Card 2 */}
              <div className="stat-card">
                <div className="stat-card-header">
                  <div className="stat-card-icon blue">
                    <span className="material-symbols-outlined icon-fill">potted_plant</span>
                  </div>
                  <span className="stat-card-badge active">Active</span>
                </div>
                <div className="stat-card-content">
                  <p className="stat-card-value">{stats.plants}</p>
                  <p className="stat-card-label">Cây trồng đang theo dõi</p>
                </div>
              </div>
              
              {/* Status Card 3 */}
              <div className="stat-card">
                <div className="stat-card-header">
                  <div className="stat-card-icon yellow">
                    <span className="material-symbols-outlined icon-fill">{user?.role === 'manager' ? 'group' : 'eco'}</span>
                  </div>
                  <span className="stat-card-badge warning">{user?.role === 'manager' ? 'Users' : 'Harvest'}</span>
                </div>
                <div className="stat-card-content">
                  <p className="stat-card-value">{user?.role === 'manager' ? stats.users : harvestPlants.length}</p>
                  <p className="stat-card-label">{user?.role === 'manager' ? 'Người dùng' : 'Sắp thu hoạch'}</p>
                </div>
              </div>
            </div>

            {/* Devices List */}
            <div style={{
              borderRadius: '0.75rem',
              backgroundColor: 'white',
              boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
              border: '1px solid #e2e8f0',
              overflow: 'hidden'
            }}>
              <div style={{ padding: '1.25rem 1.25rem 1rem', borderBottom: '1px solid #f1f5f9' }}>
                <h3 style={{ fontSize: '0.875rem', fontWeight: '700', color: '#0f172a', margin: 0 }}>Danh sách thiết bị</h3>
              </div>
              <table style={{ width: '100%', fontSize: '0.875rem', textAlign: 'left' }}>
                <thead style={{ backgroundColor: '#f8fafc', color: '#64748b', fontWeight: '500' }}>
                  <tr>
                    <th style={{ padding: '0.75rem 1.25rem' }}>Tên thiết bị</th>
                    <th style={{ padding: '0.75rem 1.25rem' }}>Mã thiết bị</th>
                    <th style={{ padding: '0.75rem 1.25rem' }}>Vị trí</th>
                    <th style={{ padding: '0.75rem 1.25rem', textAlign: 'right' }}>Trạng thái</th>
                  </tr>
                </thead>
                <tbody style={{ borderTop: '1px solid #f1f5f9' }}>
                  {devices.length === 0 ? (
                    <tr>
                      <td colSpan="4" style={{ padding: '1.5rem', textAlign: 'center', color: '#64748b' }}>
                        Chưa có thiết bị nào
                      </td>
                    </tr>
                  ) : (
                    devices.slice(0, 5).map((device, index) => (
                      <tr key={device._id || index} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '0.75rem 1.25rem', fontWeight: '500', color: '#0f172a' }}>{device.name}</td>
                        <td style={{ padding: '0.75rem 1.25rem', color: '#64748b' }}>{device.deviceId}</td>
                        <td style={{ padding: '0.75rem 1.25rem', color: '#64748b' }}>{device.location?.address || 'N/A'}</td>
                        <td style={{ padding: '0.75rem 1.25rem', textAlign: 'right' }}>
                          <span style={{ color: device.status === 'online' ? '#4cbe00' : '#ef4444', fontWeight: '700' }}>
                            {device.status === 'online' ? 'Online' : 'Offline'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Users Management Page
function UsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newUser, setNewUser] = useState({
    username: '',
    email: '',
    password: '',
    fullName: '',
    phone: '',
    address: ''
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await apiFetch('/api/users/my-users', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setUsers(data.users || []);
      }
    } catch (error) {
      console.error('Failed to fetch users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    try {
      const response = await apiFetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ ...newUser, role: 'user' })
      });

      if (response.ok) {
        setShowCreateForm(false);
        setNewUser({
          username: '',
          email: '',
          password: '',
          fullName: '',
          phone: '',
          address: ''
        });
        fetchUsers();
      } else {
        const error = await response.json();
        alert(error.message || 'Tạo tài khoản thất bại');
      }
    } catch (error) {
      console.error('Create user error:', error);
      alert('Lỗi kết nối server');
    }
  };

  const toggleUserStatus = async (userId, currentStatus) => {
    try {
      const response = await apiFetch(`/api/users/${userId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ isActive: !currentStatus })
      });

      if (response.ok) {
        fetchUsers();
      }
    } catch (error) {
      console.error('Toggle user status error:', error);
    }
  };

  if (loading) {
    return (
      <div className="loading">
        <div className="loading-spinner"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="dashboard-header">
        <div className="header-text">
          <h2 className="dashboard-title">Quản lý người dùng</h2>
          <p className="dashboard-subtitle">Tạo và quản lý tài khoản người dùng</p>
        </div>
        <button 
          className="btn-modern primary"
          onClick={() => setShowCreateForm(true)}
        >
          <span className="material-symbols-outlined">person_add</span>
          Thêm người dùng
        </button>
      </div>

      {showCreateForm && (
        <div className="modal-overlay" onClick={() => setShowCreateForm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>
                <span className="material-symbols-outlined">person_add</span>
                Tạo tài khoản người dùng
              </h2>
              <button className="modal-close" onClick={() => setShowCreateForm(false)}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <form onSubmit={handleCreateUser}>
              <div className="modal-body">
                <div className="modern-form">
                  <div className="form-grid">
                    <div className="input-group">
                      <label className="input-label">
                        Tên đăng nhập <span className="required">*</span>
                      </label>
                      <div className="modern-input with-icon">
                        <input
                          type="text"
                          placeholder="Nhập tên đăng nhập"
                          value={newUser.username}
                          onChange={(e) => setNewUser({...newUser, username: e.target.value})}
                          required
                        />
                        <span className="material-symbols-outlined input-icon">person</span>
                      </div>
                    </div>
                    <div className="input-group">
                      <label className="input-label">
                        Email <span className="required">*</span>
                      </label>
                      <div className="modern-input with-icon">
                        <input
                          type="email"
                          placeholder="example@email.com"
                          value={newUser.email}
                          onChange={(e) => setNewUser({...newUser, email: e.target.value})}
                          required
                        />
                        <span className="material-symbols-outlined input-icon">mail</span>
                      </div>
                    </div>
                  </div>
                  <div className="form-grid">
                    <div className="input-group">
                      <label className="input-label">
                        Mật khẩu <span className="required">*</span>
                      </label>
                      <div className="modern-input with-icon">
                        <input
                          type="password"
                          placeholder="Nhập mật khẩu"
                          value={newUser.password}
                          onChange={(e) => setNewUser({...newUser, password: e.target.value})}
                          required
                        />
                        <span className="material-symbols-outlined input-icon">lock</span>
                      </div>
                    </div>
                    <div className="input-group">
                      <label className="input-label">
                        Họ tên <span className="required">*</span>
                      </label>
                      <div className="modern-input with-icon">
                        <input
                          type="text"
                          placeholder="Nhập họ và tên"
                          value={newUser.fullName}
                          onChange={(e) => setNewUser({...newUser, fullName: e.target.value})}
                          required
                        />
                        <span className="material-symbols-outlined input-icon">badge</span>
                      </div>
                    </div>
                  </div>
                  <div className="form-grid">
                    <div className="input-group">
                      <label className="input-label">
                        Số điện thoại <span className="optional">(tùy chọn)</span>
                      </label>
                      <div className="modern-input with-icon">
                        <input
                          type="tel"
                          placeholder="0123 456 789"
                          value={newUser.phone}
                          onChange={(e) => setNewUser({...newUser, phone: e.target.value})}
                        />
                        <span className="material-symbols-outlined input-icon">phone</span>
                      </div>
                    </div>
                    <div className="input-group">
                      <label className="input-label">
                        Địa chỉ <span className="optional">(tùy chọn)</span>
                      </label>
                      <div className="modern-input with-icon">
                        <input
                          type="text"
                          placeholder="Nhập địa chỉ"
                          value={newUser.address}
                          onChange={(e) => setNewUser({...newUser, address: e.target.value})}
                        />
                        <span className="material-symbols-outlined input-icon">location_on</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button 
                  type="button" 
                  className="btn-modern secondary"
                  onClick={() => setShowCreateForm(false)}
                >
                  Hủy
                </button>
                <button type="submit" className="btn-modern primary">
                  <span className="material-symbols-outlined">check</span>
                  Tạo tài khoản
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      <div className="users-list">
        {users.length === 0 ? (
          <div className="empty-state">
            <span className="material-symbols-outlined">group_off</span>
            <h3>Chưa có người dùng nào</h3>
            <p>Nhấn "Thêm người dùng" để tạo tài khoản cho người dùng đầu tiên</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Tên đăng nhập</th>
                <th>Họ tên</th>
                <th>Email</th>
                <th>Số điện thoại</th>
                <th>Trạng thái</th>
                <th>Thiết bị</th>
                <th>Ngày tạo</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {users.map(user => (
                <tr key={user._id}>
                  <td><code>{user.username}</code></td>
                  <td>{user.fullName}</td>
                  <td>{user.email}</td>
                  <td>{user.phone || 'Chưa có'}</td>
                  <td>
                    <span className={`status ${user.isActive ? 'active' : 'inactive'}`}>
                      {user.isActive ? 'Hoạt động' : 'Tạm khóa'}
                    </span>
                  </td>
                  <td>{user.deviceIds?.length || 0} thiết bị</td>
                  <td>{new Date(user.createdAt).toLocaleDateString('vi-VN')}</td>
                  <td>
                    <button
                      className={`btn ${user.isActive ? 'btn-danger' : 'btn-primary'}`}
                      onClick={() => toggleUserStatus(user._id, user.isActive)}
                      style={{ fontSize: '0.8rem', padding: '0.5rem 1rem' }}
                    >
                      {user.isActive ? 'Khóa' : 'Mở khóa'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// Devices Management Page
function DevicesPage() {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [users, setUsers] = useState([]);
  const [showAssignModal, setShowAssignModal] = useState(false);

  useEffect(() => {
    fetchDevices();
    fetchUsers();
  }, []);

  const fetchDevices = async () => {
    try {
      const response = await apiFetch('/api/devices', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setDevices(data.devices || []);
      }
    } catch (error) {
      console.error('Failed to fetch devices:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await apiFetch('/api/users/my-users', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setUsers(data.users || []);
      }
    } catch (error) {
      console.error('Failed to fetch users:', error);
    }
  };

  const handleAssignDevice = (device) => {
    setSelectedDevice(device);
    setShowAssignModal(true);
  };

  const assignDeviceToUsers = async (userIds) => {
    try {
      const response = await apiFetch(`/api/devices/${selectedDevice._id}/assign-users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ userIds })
      });

      if (response.ok) {
        setShowAssignModal(false);
        setSelectedDevice(null);
        fetchDevices();
        alert('Gán thiết bị thành công!');
      } else {
        const error = await response.json();
        alert(error.message || 'Gán thiết bị thất bại');
      }
    } catch (error) {
      console.error('Assign device error:', error);
      alert('Lỗi kết nối server');
    }
  };

  if (loading) {
    return (
      <div className="loading">
        <div className="loading-spinner"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="dashboard-header">
        <div className="header-text">
          <h2 className="dashboard-title">Quản lý thiết bị ESP32</h2>
          <p className="dashboard-subtitle">Danh sách thiết bị thuộc sở hữu của bạn và gán cho người dùng</p>
        </div>
      </div>
      
      <div className="devices-list">
        {devices.length === 0 ? (
          <div className="empty-state">
            <span className="material-symbols-outlined">router_off</span>
            <h3>Chưa có thiết bị nào</h3>
            <p>Liên hệ SuperAdmin để được cấp thiết bị ESP32</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Device ID</th>
                <th>Tên thiết bị</th>
                <th>Loại</th>
                <th>Vị trí</th>
                <th>Trạng thái</th>
                <th>Người dùng sử dụng</th>
                <th>Lần cuối online</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {devices.map(device => (
                <tr key={device._id}>
                  <td><code>{device.deviceId}</code></td>
                  <td>{device.name}</td>
                  <td>{device.type.toUpperCase()}</td>
                  <td>{device.location.address}</td>
                  <td>
                    <span className={`status ${device.status}`}>
                      {device.status === 'online' ? 'Trực tuyến' : 
                       device.status === 'offline' ? 'Ngoại tuyến' : 'Bảo trì'}
                    </span>
                  </td>
                  <td>
                    {device.assignedUsers?.length > 0 ? (
                      <div>
                        {device.assignedUsers.map(user => (
                          <div key={user._id} style={{ fontSize: '0.85rem', color: '#666' }}>
                            {user.fullName} ({user.username})
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span style={{ color: '#999', fontStyle: 'italic' }}>Chưa gán</span>
                    )}
                  </td>
                  <td>{device.lastSeen ? new Date(device.lastSeen).toLocaleString('vi-VN') : 'Chưa có'}</td>
                  <td>
                    <button
                      className="btn-modern primary sm"
                      onClick={() => handleAssignDevice(device)}
                    >
                      <span className="material-symbols-outlined">assignment_ind</span>
                      Gán
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Assign Device Modal */}
      {showAssignModal && selectedDevice && (
        <AssignDeviceModal
          device={selectedDevice}
          users={users}
          onAssign={assignDeviceToUsers}
          onClose={() => {
            setShowAssignModal(false);
            setSelectedDevice(null);
          }}
        />
      )}
    </div>
  );
}

// Assign Device Modal Component
function AssignDeviceModal({ device, users, onAssign, onClose }) {
  const [selectedUsers, setSelectedUsers] = useState(
    device.assignedUsers?.map(u => u._id) || []
  );

  const handleUserToggle = (userId) => {
    setSelectedUsers(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onAssign(selectedUsers);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>
            <span className="material-symbols-outlined">assignment_ind</span>
            Gán thiết bị cho người dùng
          </h2>
          <button className="modal-close" onClick={onClose}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {/* Device Info Card */}
            <div style={{
              background: 'linear-gradient(135deg, #4cbe00 0%, #3da600 100%)',
              borderRadius: '0.75rem',
              padding: '1rem 1.25rem',
              marginBottom: '1.5rem',
              color: 'white'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{
                  width: '3rem',
                  height: '3rem',
                  borderRadius: '0.5rem',
                  backgroundColor: 'rgba(255,255,255,0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '1.5rem' }}>memory</span>
                </div>
                <div>
                  <p style={{ margin: 0, fontWeight: '700', fontSize: '1.125rem' }}>{device.name}</p>
                  <p style={{ margin: 0, opacity: 0.9, fontSize: '0.875rem' }}>
                    <code style={{ background: 'rgba(255,255,255,0.2)', padding: '0.125rem 0.375rem', borderRadius: '0.25rem' }}>
                      {device.deviceId}
                    </code>
                  </p>
                </div>
              </div>
            </div>

            {/* User Selection */}
            <div className="input-group">
              <label className="input-label" style={{ marginBottom: '0.75rem' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '1.125rem', verticalAlign: 'middle', marginRight: '0.25rem' }}>group</span>
                Chọn người dùng được phép sử dụng thiết bị
              </label>
              
              {users.length === 0 ? (
                <div className="empty-state" style={{ padding: '2rem', background: '#f8fafc', borderRadius: '0.75rem' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '2.5rem', color: '#94a3b8' }}>group_off</span>
                  <p style={{ margin: '0.5rem 0 0', color: '#64748b' }}>Chưa có người dùng nào</p>
                  <p style={{ margin: '0.25rem 0 0', fontSize: '0.875rem', color: '#94a3b8' }}>Tạo người dùng trước khi gán thiết bị</p>
                </div>
              ) : (
                <div style={{ 
                  maxHeight: '280px', 
                  overflow: 'auto', 
                  border: '2px solid #e5e7eb', 
                  borderRadius: '0.75rem',
                  backgroundColor: 'white'
                }}>
                  {users.map((user, index) => (
                    <label 
                      key={user._id} 
                      className="checkbox-modern"
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        padding: '1rem 1.25rem', 
                        cursor: 'pointer',
                        borderBottom: index < users.length - 1 ? '1px solid #f1f5f9' : 'none',
                        transition: 'background-color 0.2s',
                        backgroundColor: selectedUsers.includes(user._id) ? 'rgba(76, 190, 0, 0.05)' : 'transparent'
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={selectedUsers.includes(user._id)}
                        onChange={() => handleUserToggle(user._id)}
                        style={{ display: 'none' }}
                      />
                      <div className="checkmark" style={{
                        width: '1.5rem',
                        height: '1.5rem',
                        borderRadius: '0.375rem',
                        border: selectedUsers.includes(user._id) ? '2px solid #4cbe00' : '2px solid #d1d5db',
                        backgroundColor: selectedUsers.includes(user._id) ? '#4cbe00' : 'white',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginRight: '1rem',
                        transition: 'all 0.2s',
                        flexShrink: 0
                      }}>
                        {selectedUsers.includes(user._id) && (
                          <span className="material-symbols-outlined" style={{ fontSize: '1rem', color: 'white' }}>check</span>
                        )}
                      </div>
                      <div style={{
                        width: '2.5rem',
                        height: '2.5rem',
                        borderRadius: '50%',
                        backgroundColor: '#4cbe00',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        fontWeight: '700',
                        marginRight: '0.75rem',
                        flexShrink: 0
                      }}>
                        {user.fullName?.charAt(0).toUpperCase() || 'U'}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: '600', color: '#0f172a', marginBottom: '0.125rem' }}>{user.fullName}</div>
                        <div style={{ fontSize: '0.8125rem', color: '#64748b' }}>
                          @{user.username} • {user.email}
                        </div>
                      </div>
                      {selectedUsers.includes(user._id) && (
                        <span className="badge badge-success" style={{ marginLeft: '0.5rem' }}>
                          Đã chọn
                        </span>
                      )}
                    </label>
                  ))}
                </div>
              )}
              
              {users.length > 0 && (
                <p className="input-help" style={{ marginTop: '0.75rem' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '0.875rem', verticalAlign: 'middle', marginRight: '0.25rem' }}>info</span>
                  Đã chọn {selectedUsers.length}/{users.length} người dùng
                </p>
              )}
            </div>
          </div>
          
          <div className="modal-footer">
            <button type="button" className="btn-modern secondary" onClick={onClose}>
              Hủy
            </button>
            <button type="submit" className="btn-modern primary" disabled={users.length === 0}>
              <span className="material-symbols-outlined">check</span>
              Xác nhận gán ({selectedUsers.length})
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Plants Management Page
function PlantsPage() {
  const [plants, setPlants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [devices, setDevices] = useState([]);
  const [newPlant, setNewPlant] = useState({
    name: '',
    type: '',
    variety: '',
    deviceId: '',
    plantedDate: new Date().toISOString().split('T')[0],
    expectedHarvestDate: '',
    location: '',
    optimalConditions: {
      temperature: { min: 20, max: 30 },
      humidity: { min: 60, max: 80 },
      light: { min: 40, max: 80 }
    }
  });

  useEffect(() => {
    fetchPlants();
    fetchDevices();
  }, []);

  const fetchPlants = async () => {
    try {
      const response = await apiFetch('/api/plants/my-plants', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setPlants(data.plants || []);
      }
    } catch (error) {
      console.error('Failed to fetch plants:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDevices = async () => {
    try {
      const response = await apiFetch('/api/devices', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setDevices(data.devices || []);
      }
    } catch (error) {
      console.error('Failed to fetch devices:', error);
    }
  };

  const handleCreatePlant = async (e) => {
    e.preventDefault();
    try {
      const response = await apiFetch('/api/plants', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(newPlant)
      });

      if (response.ok) {
        setShowCreateForm(false);
        setNewPlant({
          name: '',
          type: '',
          variety: '',
          deviceId: '',
          plantedDate: new Date().toISOString().split('T')[0],
          expectedHarvestDate: '',
          location: '',
          optimalConditions: {
            temperature: { min: 20, max: 30 },
            humidity: { min: 60, max: 80 },
            light: { min: 40, max: 80 }
          }
        });
        fetchPlants();
      } else {
        const error = await response.json();
        alert(error.message || 'Thêm cây trồng thất bại');
      }
    } catch (error) {
      console.error('Create plant error:', error);
      alert('Lỗi kết nối server');
    }
  };

  const calculateGrowthProgress = (plantedDate, expectedHarvestDate) => {
    if (!expectedHarvestDate) return 0;
    
    const planted = new Date(plantedDate);
    const expected = new Date(expectedHarvestDate);
    const now = new Date();
    
    const totalDays = Math.ceil((expected - planted) / (1000 * 60 * 60 * 24));
    const daysPassed = Math.ceil((now - planted) / (1000 * 60 * 60 * 24));
    
    const progress = Math.min(Math.max((daysPassed / totalDays) * 100, 0), 100);
    return Math.round(progress);
  };

  const getGrowthStage = (progress) => {
    if (progress < 10) return { stage: 'Hạt giống', color: '#8d6e63' };
    if (progress < 25) return { stage: 'Nảy mầm', color: '#689f38' };
    if (progress < 50) return { stage: 'Cây con', color: '#4caf50' };
    if (progress < 75) return { stage: 'Phát triển', color: '#2e7d32' };
    if (progress < 90) return { stage: 'Ra hoa', color: '#ff9800' };
    if (progress < 100) return { stage: 'Kết quả', color: '#f57c00' };
    return { stage: 'Thu hoạch', color: '#d32f2f' };
  };

  if (loading) return <div className="loading"><div className="loading-spinner"></div></div>;

  return (
    <div>
      <div className="dashboard-header">
        <div className="header-text">
          <h2 className="dashboard-title">Quản lý cây trồng</h2>
          <p className="dashboard-subtitle">Theo dõi và quản lý các cây trồng trong vườn</p>
        </div>
        <button 
          className="btn-modern primary"
          onClick={() => setShowCreateForm(true)}
        >
          <span className="material-symbols-outlined">add_circle</span>
          Thêm cây trồng
        </button>
      </div>

      {showCreateForm && (
        <div className="modal-overlay" onClick={() => setShowCreateForm(false)}>
          <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>
                <span className="material-symbols-outlined">eco</span>
                Thêm cây trồng mới
              </h2>
              <button className="modal-close" onClick={() => setShowCreateForm(false)}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <form onSubmit={handleCreatePlant}>
              <div className="modal-body">
                <div className="modern-form">
                  <div className="form-grid">
                    <div className="input-group">
                      <label className="input-label">
                        Tên cây <span className="required">*</span>
                      </label>
                      <div className="modern-input with-icon">
                        <input
                          type="text"
                          placeholder="VD: Cà chua bi"
                          value={newPlant.name}
                          onChange={(e) => setNewPlant({...newPlant, name: e.target.value})}
                          required
                        />
                        <span className="material-symbols-outlined input-icon">eco</span>
                      </div>
                    </div>
                    <div className="input-group">
                      <label className="input-label">
                        Loại cây <span className="required">*</span>
                      </label>
                      <div className="modern-input">
                        <select
                          value={newPlant.type}
                          onChange={(e) => setNewPlant({...newPlant, type: e.target.value})}
                          required
                        >
                          <option value="">Chọn loại cây</option>
                          <option value="vegetable">🥬 Rau củ</option>
                          <option value="fruit">🍎 Trái cây</option>
                          <option value="herb">🌿 Thảo mộc</option>
                          <option value="flower">🌸 Hoa</option>
                        </select>
                      </div>
                    </div>
                  </div>
                  <div className="form-grid">
                    <div className="input-group">
                      <label className="input-label">
                        Giống <span className="optional">(tùy chọn)</span>
                      </label>
                      <div className="modern-input with-icon">
                        <input
                          type="text"
                          placeholder="VD: Cherry, Roma, ..."
                          value={newPlant.variety}
                          onChange={(e) => setNewPlant({...newPlant, variety: e.target.value})}
                        />
                        <span className="material-symbols-outlined input-icon">category</span>
                      </div>
                    </div>
                    <div className="input-group">
                      <label className="input-label">
                        Thiết bị <span className="required">*</span>
                      </label>
                      <div className="modern-input">
                        <select
                          value={newPlant.deviceId}
                          onChange={(e) => setNewPlant({...newPlant, deviceId: e.target.value})}
                          required
                        >
                          <option value="">Chọn thiết bị</option>
                          {devices.map(device => (
                            <option key={device._id} value={device._id}>
                              📟 {device.name} ({device.deviceId})
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                  
                  <div className="form-divider"><span>Thời gian</span></div>
                  
                  <div className="form-grid">
                    <div className="input-group">
                      <label className="input-label">
                        Ngày trồng <span className="required">*</span>
                      </label>
                      <div className="modern-input with-icon">
                        <input
                          type="date"
                          value={newPlant.plantedDate}
                          onChange={(e) => setNewPlant({...newPlant, plantedDate: e.target.value})}
                          required
                        />
                        <span className="material-symbols-outlined input-icon">event</span>
                      </div>
                    </div>
                    <div className="input-group">
                      <label className="input-label">
                        Dự kiến thu hoạch <span className="required">*</span>
                      </label>
                      <div className="modern-input with-icon">
                        <input
                          type="date"
                          value={newPlant.expectedHarvestDate}
                          onChange={(e) => setNewPlant({...newPlant, expectedHarvestDate: e.target.value})}
                          required
                        />
                        <span className="material-symbols-outlined input-icon">calendar_month</span>
                      </div>
                    </div>
                  </div>
                  <div className="input-group full-width">
                    <label className="input-label">
                      Vị trí <span className="optional">(tùy chọn)</span>
                    </label>
                    <div className="modern-input with-icon">
                      <input
                        type="text"
                        placeholder="VD: Khu A, Hàng 1, Vị trí 3"
                        value={newPlant.location}
                        onChange={(e) => setNewPlant({...newPlant, location: e.target.value})}
                      />
                      <span className="material-symbols-outlined input-icon">location_on</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button 
                  type="button" 
                  className="btn-modern secondary"
                  onClick={() => setShowCreateForm(false)}
                >
                  Hủy
                </button>
                <button type="submit" className="btn-modern primary">
                  <span className="material-symbols-outlined">check</span>
                  Thêm cây trồng
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="plants-list">
        {plants.length === 0 ? (
          <div className="empty-state">
            <span className="material-symbols-outlined" style={{ fontSize: '3rem', color: '#4cbe00' }}>potted_plant</span>
            <h3>Chưa có cây trồng nào</h3>
            <p>Nhấn "Thêm cây trồng" để bắt đầu theo dõi cây trồng đầu tiên</p>
          </div>
        ) : (
          <>
            {/* Plants nearing harvest */}
            {plants.filter(plant => {
              const progress = calculateGrowthProgress(plant.plantedDate, plant.expectedHarvestDate);
              return progress >= 80 && progress < 100;
            }).length > 0 && (
              <div style={{ marginBottom: '2rem' }}>
                <h3 style={{ color: '#f57c00', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span className="material-symbols-outlined">timer</span>
                  Cây sắp thu hoạch (≥80%)
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
                  {plants.filter(plant => {
                    const progress = calculateGrowthProgress(plant.plantedDate, plant.expectedHarvestDate);
                    return progress >= 80 && progress < 100;
                  }).map(plant => {
                    const progress = calculateGrowthProgress(plant.plantedDate, plant.expectedHarvestDate);
                    const stage = getGrowthStage(progress);
                    return (
                      <div key={plant._id} style={{
                        background: 'white',
                        padding: '1.5rem',
                        borderRadius: '0.75rem',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                        border: '2px solid #f57c00'
                      }}>
                        <h4 style={{ color: '#2e7d32', marginBottom: '0.5rem' }}>{plant.name}</h4>
                        <p style={{ color: '#666', fontSize: '0.9rem', marginBottom: '1rem' }}>
                          {plant.type} - {plant.variety}
                        </p>
                        <div style={{ marginBottom: '1rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                            <span style={{ color: stage.color, fontWeight: '500' }}>{stage.stage}</span>
                            <span style={{ fontWeight: 'bold', color: '#f57c00' }}>{progress}%</span>
                          </div>
                          <div style={{ 
                            width: '100%', 
                            height: '8px', 
                            backgroundColor: '#e0e0e0', 
                            borderRadius: '4px',
                            overflow: 'hidden'
                          }}>
                            <div style={{
                              width: `${progress}%`,
                              height: '100%',
                              backgroundColor: stage.color,
                              transition: 'width 0.3s ease'
                            }}></div>
                          </div>
                        </div>
                        <p style={{ fontSize: '0.85rem', color: '#666' }}>
                          Dự kiến: {new Date(plant.expectedHarvestDate).toLocaleDateString('vi-VN')}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <table className="data-table">
              <thead>
                <tr>
                  <th>Tên cây</th>
                  <th>Loại</th>
                  <th>Thiết bị</th>
                  <th>Tiến độ</th>
                  <th>Giai đoạn</th>
                  <th>Ngày trồng</th>
                  <th>Dự kiến thu hoạch</th>
                  <th>Vị trí</th>
                </tr>
              </thead>
              <tbody>
                {plants.map(plant => {
                  const progress = calculateGrowthProgress(plant.plantedDate, plant.expectedHarvestDate);
                  const stage = getGrowthStage(progress);
                  return (
                    <tr key={plant._id}>
                      <td>
                        <div>
                          <div style={{ fontWeight: '500' }}>{plant.name}</div>
                          <div style={{ fontSize: '0.85rem', color: '#666' }}>{plant.variety}</div>
                        </div>
                      </td>
                      <td>{plant.type}</td>
                      <td>
                        <div>
                          <div>{plant.deviceId?.name}</div>
                          <div style={{ fontSize: '0.8rem', color: '#666' }}>
                            <code>{plant.deviceId?.deviceId}</code>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <div style={{ 
                            width: '60px', 
                            height: '6px', 
                            backgroundColor: '#e0e0e0', 
                            borderRadius: '3px',
                            overflow: 'hidden'
                          }}>
                            <div style={{
                              width: `${progress}%`,
                              height: '100%',
                              backgroundColor: stage.color,
                              transition: 'width 0.3s ease'
                            }}></div>
                          </div>
                          <span style={{ fontWeight: 'bold', color: stage.color }}>{progress}%</span>
                        </div>
                      </td>
                      <td>
                        <span style={{ color: stage.color, fontWeight: '500' }}>
                          {stage.stage}
                        </span>
                      </td>
                      <td>{new Date(plant.plantedDate).toLocaleDateString('vi-VN')}</td>
                      <td>{new Date(plant.expectedHarvestDate).toLocaleDateString('vi-VN')}</td>
                      <td>{plant.location ? (typeof plant.location === 'object' ? `${plant.location.zone || ''} ${plant.location.row || ''} ${plant.location.column || ''}`.trim() : plant.location) : 'Chưa có'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </>
        )}
      </div>
    </div>
  );
}

// Controls Page
function ControlsPage() {
  const [devices, setDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [controls, setControls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('control');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [reminderType, setReminderType] = useState('time'); // 'time' hoặc 'sensor'
  const [reminders, setReminders] = useState([]);
  const [sensorAlerts, setSensorAlerts] = useState([]);
  const [automations, setAutomations] = useState([]);
  const [newReminder, setNewReminder] = useState({ title: '', message: '', time: '08:00', days: ['monday'], enabled: true });
  const [newSensorAlert, setNewSensorAlert] = useState({ 
    name: '', 
    sensor: 'light', 
    conditionType: 'range', // 'range', 'above', 'below'
    minValue: 10, 
    maxValue: 90, 
    message: '', 
    enabled: true 
  });
  const [newAutomation, setNewAutomation] = useState({ name: '', trigger: 'temperature', condition: 'above', value: 30, action: 'fan', actionValue: 100, enabled: true });
  const [automationType, setAutomationType] = useState('sensor'); // 'sensor' hoặc 'schedule'
  const [schedules, setSchedules] = useState([]);
  const [newSchedule, setNewSchedule] = useState({ 
    name: '', 
    time: '05:00', 
    days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'], 
    action: 'water', 
    actionValue: 100, 
    duration: 10,
    enabled: true 
  });
  
  // Preset controls - các điều khiển có sẵn
  const [presetControls, setPresetControls] = useState([
    { id: 'light', name: 'Đèn chiếu sáng', icon: 'lightbulb', color: '#fbbf24', enabled: false, intensity: 100 },
    { id: 'fan', name: 'Quạt thông gió', icon: 'mode_fan', color: '#3b82f6', enabled: false, intensity: 100 },
    { id: 'pump', name: 'Máy bơm nước', icon: 'water_pump', color: '#06b6d4', enabled: false, intensity: 100 },
    { id: 'watering', name: 'Tưới cây', icon: 'grass', color: '#22c55e', enabled: false, intensity: 100 },
    { id: 'heater', name: 'Sưởi ấm', icon: 'local_fire_department', color: '#ef4444', enabled: false, intensity: 100 },
    { id: 'cooler', name: 'Làm mát', icon: 'ac_unit', color: '#8b5cf6', enabled: false, intensity: 100 },
    { id: 'mist', name: 'Phun sương', icon: 'water_drop', color: '#10b981', enabled: false, intensity: 100 }
  ]);

  useEffect(() => {
    fetchDevices();
  }, []);

  useEffect(() => {
    if (selectedDevice) {
      fetchControls(selectedDevice._id);
      fetchAutomations(selectedDevice._id);
      fetchControlStates(selectedDevice._id);
    }
  }, [selectedDevice]);

  const fetchDevices = async () => {
    try {
      const response = await apiFetch('/api/devices', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setDevices(data.devices || []);
        if (data.devices?.length > 0) {
          setSelectedDevice(data.devices[0]);
        }
      }
    } catch (error) {
      console.error('Failed to fetch devices:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchControls = async (deviceId) => {
    try {
      const response = await apiFetch(`/api/controls/device/${deviceId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setControls(data || []);
      }
    } catch (error) {
      console.error('Failed to fetch controls:', error);
    }
  };

  // Fetch control states from ThingsBoard
  const fetchControlStates = async (deviceId) => {
    try {
      const response = await apiFetch(`/api/thingsboard/device/${deviceId}/controls`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.available && data.controls) {
          // Update preset controls with ThingsBoard states
          setPresetControls(prev => prev.map(control => {
            const tbState = data.controls[control.id];
            if (tbState) {
              return {
                ...control,
                enabled: tbState.enabled || false,
                intensity: tbState.intensity || 100
              };
            }
            return control;
          }));
          console.log('Loaded control states from ThingsBoard:', data.controls);
        }
      }
    } catch (error) {
      console.error('Failed to fetch control states:', error);
    }
  };

  const fetchAutomations = async (deviceId) => {
    try {
      const response = await apiFetch(`/api/controls/automation/${deviceId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.schedules) setSchedules(data.schedules.map((s, i) => ({ ...s, id: s.id || Date.now() + i })));
        if (data.automations) setAutomations(data.automations.map((a, i) => ({ ...a, id: a.id || Date.now() + i })));
        if (data.alerts) setSensorAlerts(data.alerts.map((a, i) => ({ ...a, id: a.id || Date.now() + i })));
      }
    } catch (error) {
      console.error('Failed to fetch automations:', error);
    }
  };


  const handleControlAction = async (controlId, action, params = {}) => {
    try {
      const response = await apiFetch(`/api/controls/${controlId}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify(params)
      });
      if (response.ok) fetchControls(selectedDevice._id);
    } catch (error) {
      console.error(`Control ${action} error:`, error);
    }
  };

  // Toggle preset control (bật/tắt điều khiển có sẵn)
  const togglePresetControl = async (controlId) => {
    const control = presetControls.find(c => c.id === controlId);
    if (!control || !selectedDevice) return;
    
    const newEnabled = !control.enabled;
    
    // Update local state immediately for responsiveness
    setPresetControls(prev => prev.map(c => 
      c.id === controlId ? { ...c, enabled: newEnabled } : c
    ));
    
    try {
      // Send control command to backend
      const response = await apiFetch('/api/controls/command', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          deviceId: selectedDevice._id,
          controlType: controlId,
          action: newEnabled ? 'on' : 'off',
          intensity: control.intensity
        })
      });
      
      if (!response.ok) {
        // Revert on error
        setPresetControls(prev => prev.map(c => 
          c.id === controlId ? { ...c, enabled: !newEnabled } : c
        ));
        console.error('Failed to send control command');
      }
    } catch (error) {
      // Revert on error
      setPresetControls(prev => prev.map(c => 
        c.id === controlId ? { ...c, enabled: !newEnabled } : c
      ));
      console.error('Control command error:', error);
    }
  };

  // Thay đổi cường độ điều khiển
  const updatePresetIntensity = async (controlId, intensity) => {
    setPresetControls(prev => prev.map(c => 
      c.id === controlId ? { ...c, intensity } : c
    ));
    
    const control = presetControls.find(c => c.id === controlId);
    if (!control?.enabled || !selectedDevice) return;
    
    // Send intensity update if control is enabled
    try {
      await apiFetch('/api/controls/command', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          deviceId: selectedDevice._id,
          controlType: controlId,
          action: 'intensity',
          intensity: intensity
        })
      });
    } catch (error) {
      console.error('Intensity update error:', error);
    }
  };

  const addReminder = async () => {
    if (!newReminder.title || !selectedDevice) return;
    const reminder = { ...newReminder, id: Date.now() };
    setReminders([...reminders, reminder]);
    setNewReminder({ title: '', message: '', time: '08:00', days: ['monday'], enabled: true });
    setShowCreateForm(false);
    
    // Save to backend (optional - reminders can be local)
    try {
      await apiFetch('/api/controls/automation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          deviceId: selectedDevice._id,
          type: 'reminder',
          settings: reminder
        })
      });
    } catch (error) {
      console.error('Save reminder error:', error);
    }
  };

  const addSensorAlert = async () => {
    if (!newSensorAlert.name || !selectedDevice) return;
    const alert = { ...newSensorAlert, id: Date.now() };
    setSensorAlerts([...sensorAlerts, alert]);
    setNewSensorAlert({ name: '', sensor: 'light', conditionType: 'range', minValue: 10, maxValue: 90, message: '', enabled: true });
    setShowCreateForm(false);
    
    // Save to backend
    try {
      await apiFetch('/api/controls/automation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          deviceId: selectedDevice._id,
          type: 'alert',
          settings: alert
        })
      });
    } catch (error) {
      console.error('Save sensor alert error:', error);
    }
  };

  const addAutomation = async () => {
    if (!newAutomation.name || !selectedDevice) return;
    const automation = { ...newAutomation, id: Date.now() };
    setAutomations([...automations, automation]);
    setNewAutomation({ name: '', trigger: 'temperature', condition: 'above', value: 30, action: 'fan', actionValue: 100, enabled: true });
    setShowCreateForm(false);
    
    // Save to backend
    try {
      await apiFetch('/api/controls/automation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          deviceId: selectedDevice._id,
          type: 'sensor',
          settings: automation
        })
      });
    } catch (error) {
      console.error('Save automation error:', error);
    }
  };

  const toggleReminder = (id) => setReminders(reminders.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r));
  const toggleSensorAlert = (id) => setSensorAlerts(sensorAlerts.map(a => a.id === id ? { ...a, enabled: !a.enabled } : a));
  const toggleAutomation = (id) => setAutomations(automations.map(a => a.id === id ? { ...a, enabled: !a.enabled } : a));
  const deleteReminder = (id) => setReminders(reminders.filter(r => r.id !== id));
  const deleteSensorAlert = (id) => setSensorAlerts(sensorAlerts.filter(a => a.id !== id));
  const deleteAutomation = (id) => setAutomations(automations.filter(a => a.id !== id));

  // Schedule functions
  const addSchedule = async () => {
    if (!newSchedule.name || !selectedDevice) return;
    const schedule = { ...newSchedule, id: Date.now() };
    setSchedules([...schedules, schedule]);
    setNewSchedule({ name: '', time: '05:00', days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'], action: 'water', actionValue: 100, duration: 10, enabled: true });
    setShowCreateForm(false);
    
    // Save to backend
    try {
      await apiFetch('/api/controls/automation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          deviceId: selectedDevice._id,
          type: 'schedule',
          settings: schedule
        })
      });
    } catch (error) {
      console.error('Save schedule error:', error);
    }
  };
  const toggleSchedule = (id) => setSchedules(schedules.map(s => s.id === id ? { ...s, enabled: !s.enabled } : s));
  const deleteSchedule = (id) => setSchedules(schedules.filter(s => s.id !== id));

  // Sensor options for alerts
  const sensorOptions = [
    { id: 'light', name: 'Ánh sáng', icon: 'light_mode', unit: 'lux', color: '#fbbf24' },
    { id: 'temperature', name: 'Nhiệt độ', icon: 'thermostat', unit: '°C', color: '#ef4444' },
    { id: 'humidity', name: 'Độ ẩm không khí', icon: 'humidity_percentage', unit: '%', color: '#3b82f6' },
    { id: 'soil_moisture', name: 'Độ ẩm đất', icon: 'water_drop', unit: '%', color: '#22c55e' },
    { id: 'water_level', name: 'Mực nước bể', icon: 'water', unit: '%', color: '#06b6d4' },
    { id: 'ph', name: 'Độ pH', icon: 'science', unit: 'pH', color: '#8b5cf6' }
  ];

  const getConditionText = (alert) => {
    const sensor = sensorOptions.find(s => s.id === alert.sensor);
    if (alert.conditionType === 'range') {
      return `${alert.minValue} - ${alert.maxValue} ${sensor?.unit || ''}`;
    } else if (alert.conditionType === 'above') {
      return `> ${alert.minValue} ${sensor?.unit || ''}`;
    } else {
      return `< ${alert.maxValue} ${sensor?.unit || ''}`;
    }
  };

  const dayLabels = { monday: 'T2', tuesday: 'T3', wednesday: 'T4', thursday: 'T5', friday: 'T6', saturday: 'T7', sunday: 'CN' };
  const tabs = [{ id: 'control', label: 'Điều khiển', icon: 'tune' }, { id: 'reminder', label: 'Nhắc nhở', icon: 'notifications' }, { id: 'auto', label: 'Tự động', icon: 'smart_toy' }];

  if (loading) return <div className="loading"><div className="loading-spinner"></div></div>;

  if (devices.length === 0) {
    return (
      <div>
        <div className="dashboard-header">
          <div className="header-text">
            <h2 className="dashboard-title">Điều khiển thiết bị</h2>
            <p className="dashboard-subtitle">Quản lý điều khiển, nhắc nhở và tự động hóa</p>
          </div>
        </div>
        <div className="empty-state" style={{ padding: '3rem', background: 'white', borderRadius: '0.75rem' }}>
          <span className="material-symbols-outlined" style={{ fontSize: '3rem', color: '#94a3b8' }}>router</span>
          <h3>Chưa có thiết bị nào</h3>
          <p>Bạn cần có thiết bị ESP32 để sử dụng tính năng điều khiển</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="dashboard-header">
        <div className="header-text">
          <h2 className="dashboard-title">Điều khiển thiết bị</h2>
          <p className="dashboard-subtitle">Quản lý điều khiển, nhắc nhở và tự động hóa</p>
        </div>
        <div className="modern-input" style={{ width: '250px' }}>
          <select value={selectedDevice?._id || ''} onChange={(e) => setSelectedDevice(devices.find(d => d._id === e.target.value))}>
            {devices.map(device => (<option key={device._id} value={device._id}>{device.name} ({device.deviceId})</option>))}
          </select>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', background: '#f1f5f9', padding: '0.375rem', borderRadius: '0.75rem', width: 'fit-content' }}>
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => { setActiveTab(tab.id); setShowCreateForm(false); }}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.625rem 1.25rem', borderRadius: '0.5rem', border: 'none', cursor: 'pointer', fontWeight: '600', fontSize: '0.875rem', transition: 'all 0.2s',
              background: activeTab === tab.id ? 'white' : 'transparent', color: activeTab === tab.id ? '#4cbe00' : '#64748b', boxShadow: activeTab === tab.id ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '1.125rem' }}>{tab.icon}</span>{tab.label}
          </button>
        ))}
      </div>

      {/* Device Info */}
      {selectedDevice && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem 1.25rem', background: 'white', borderRadius: '0.75rem', marginBottom: '1.5rem', border: '1px solid #e2e8f0' }}>
          <div style={{ width: '3rem', height: '3rem', borderRadius: '0.75rem', background: 'linear-gradient(135deg, #4cbe00 0%, #3da600 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span className="material-symbols-outlined" style={{ color: 'white', fontSize: '1.5rem' }}>memory</span>
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontWeight: '700', color: '#0f172a' }}>{selectedDevice.name}</p>
            <p style={{ margin: 0, fontSize: '0.875rem', color: '#64748b' }}><code style={{ background: '#f1f5f9', padding: '0.125rem 0.375rem', borderRadius: '0.25rem' }}>{selectedDevice.deviceId}</code></p>
          </div>
          <span className={`badge ${selectedDevice.status === 'online' ? 'badge-success' : 'badge-danger'}`}>{selectedDevice.status === 'online' ? '● Online' : '○ Offline'}</span>
        </div>
      )}

      {/* Tab: Điều khiển */}
      {activeTab === 'control' && (
        <div>
          {/* Preset Controls Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
            {presetControls.map(control => (
              <div key={control.id} style={{
                background: 'white',
                borderRadius: '1rem',
                padding: '1.5rem',
                border: control.enabled ? `2px solid ${control.color}` : '1px solid #e2e8f0',
                boxShadow: control.enabled ? `0 4px 20px ${control.color}30` : '0 1px 3px rgba(0,0,0,0.1)',
                transition: 'all 0.3s ease'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{
                      width: '3rem', height: '3rem', borderRadius: '0.75rem',
                      background: control.enabled ? control.color : '#f1f5f9',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'all 0.3s ease'
                    }}>
                      <span className="material-symbols-outlined icon-fill" style={{ 
                        color: control.enabled ? 'white' : '#94a3b8', 
                        fontSize: '1.5rem' 
                      }}>{control.icon}</span>
                    </div>
                    <div>
                      <p style={{ margin: 0, fontWeight: '700', color: '#0f172a', fontSize: '1rem' }}>{control.name}</p>
                      <p style={{ margin: 0, fontSize: '0.8125rem', color: control.enabled ? control.color : '#94a3b8', fontWeight: '600' }}>
                        {control.enabled ? 'Đang bật' : 'Đang tắt'}
                      </p>
                    </div>
                  </div>
                  <label className="toggle-switch">
                    <input type="checkbox" checked={control.enabled} onChange={() => togglePresetControl(control.id)} />
                    <span className="toggle-track" style={{ background: control.enabled ? control.color : '#d1d5db' }}></span>
                  </label>
                </div>
                
                {/* Intensity Slider */}
                <div style={{ marginTop: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span style={{ fontSize: '0.8125rem', color: '#64748b' }}>Cường độ</span>
                    <span style={{ fontSize: '0.875rem', fontWeight: '700', color: control.enabled ? control.color : '#64748b' }}>{control.intensity}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={control.intensity}
                    onChange={(e) => updatePresetIntensity(control.id, parseInt(e.target.value))}
                    style={{
                      width: '100%',
                      height: '6px',
                      borderRadius: '3px',
                      appearance: 'none',
                      background: `linear-gradient(to right, ${control.color} 0%, ${control.color} ${control.intensity}%, #e2e8f0 ${control.intensity}%, #e2e8f0 100%)`,
                      cursor: 'pointer'
                    }}
                  />
                </div>
                
                {/* Quick Actions */}
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                  <button 
                    onClick={() => updatePresetIntensity(control.id, 25)}
                    style={{
                      flex: 1, padding: '0.5rem', borderRadius: '0.5rem', border: 'none',
                      background: control.intensity === 25 ? control.color : '#f1f5f9',
                      color: control.intensity === 25 ? 'white' : '#64748b',
                      fontWeight: '600', fontSize: '0.75rem', cursor: 'pointer'
                    }}>25%</button>
                  <button 
                    onClick={() => updatePresetIntensity(control.id, 50)}
                    style={{
                      flex: 1, padding: '0.5rem', borderRadius: '0.5rem', border: 'none',
                      background: control.intensity === 50 ? control.color : '#f1f5f9',
                      color: control.intensity === 50 ? 'white' : '#64748b',
                      fontWeight: '600', fontSize: '0.75rem', cursor: 'pointer'
                    }}>50%</button>
                  <button 
                    onClick={() => updatePresetIntensity(control.id, 75)}
                    style={{
                      flex: 1, padding: '0.5rem', borderRadius: '0.5rem', border: 'none',
                      background: control.intensity === 75 ? control.color : '#f1f5f9',
                      color: control.intensity === 75 ? 'white' : '#64748b',
                      fontWeight: '600', fontSize: '0.75rem', cursor: 'pointer'
                    }}>75%</button>
                  <button 
                    onClick={() => updatePresetIntensity(control.id, 100)}
                    style={{
                      flex: 1, padding: '0.5rem', borderRadius: '0.5rem', border: 'none',
                      background: control.intensity === 100 ? control.color : '#f1f5f9',
                      color: control.intensity === 100 ? 'white' : '#64748b',
                      fontWeight: '600', fontSize: '0.75rem', cursor: 'pointer'
                    }}>100%</button>
                </div>
              </div>
            ))}
          </div>
          
          {/* Active Controls Summary */}
          <div style={{ 
            marginTop: '1.5rem', 
            padding: '1rem 1.25rem', 
            background: '#f8fafc', 
            borderRadius: '0.75rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span className="material-symbols-outlined" style={{ color: '#4cbe00' }}>check_circle</span>
              <span style={{ color: '#64748b' }}>
                <strong style={{ color: '#0f172a' }}>{presetControls.filter(c => c.enabled).length}</strong> thiết bị đang hoạt động
              </span>
            </div>
            <button 
              onClick={() => setPresetControls(prev => prev.map(c => ({ ...c, enabled: false })))}
              className="btn-modern secondary sm"
              style={{ padding: '0.5rem 1rem' }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>power_settings_new</span>
              Tắt tất cả
            </button>
          </div>
        </div>
      )}

      {/* Tab: Nhắc nhở */}
      {activeTab === 'reminder' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
            <button className="btn-modern primary" onClick={() => setShowCreateForm(true)}><span className="material-symbols-outlined">add_alert</span>Thêm nhắc nhở</button>
          </div>
          
          {showCreateForm && (
            <div className="modal-overlay" onClick={() => setShowCreateForm(false)}>
              <div className="modal" style={{ maxWidth: '550px' }} onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                  <h2><span className="material-symbols-outlined">sensors</span> Thêm nhắc nhở theo cảm biến</h2>
                  <button className="modal-close" onClick={() => setShowCreateForm(false)}><span className="material-symbols-outlined">close</span></button>
                </div>
                <div className="modal-body">

                  {/* Form theo cảm biến */}
                    <div className="modern-form">
                      <div className="input-group">
                        <label className="input-label">Tên nhắc nhở <span className="required">*</span></label>
                        <div className="modern-input">
                          <input type="text" placeholder="VD: Ánh sáng yếu" value={newSensorAlert.name} onChange={(e) => setNewSensorAlert({...newSensorAlert, name: e.target.value})} />
                        </div>
                      </div>
                      
                      <div className="input-group">
                        <label className="input-label">Chọn cảm biến</label>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
                          {sensorOptions.map(sensor => (
                            <button key={sensor.id} type="button" onClick={() => setNewSensorAlert({...newSensorAlert, sensor: sensor.id})}
                              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.375rem', padding: '0.75rem', borderRadius: '0.75rem', border: newSensorAlert.sensor === sensor.id ? `2px solid ${sensor.color}` : '1px solid #e2e8f0', cursor: 'pointer', background: newSensorAlert.sensor === sensor.id ? `${sensor.color}15` : 'white', transition: 'all 0.2s' }}>
                              <span className="material-symbols-outlined" style={{ fontSize: '1.5rem', color: sensor.color }}>{sensor.icon}</span>
                              <span style={{ fontSize: '0.75rem', fontWeight: '600', color: newSensorAlert.sensor === sensor.id ? sensor.color : '#64748b' }}>{sensor.name}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="input-group">
                        <label className="input-label">Điều kiện nhắc nhở</label>
                        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
                          <button type="button" onClick={() => setNewSensorAlert({...newSensorAlert, conditionType: 'range'})}
                            style={{ flex: 1, padding: '0.625rem', borderRadius: '0.5rem', border: 'none', cursor: 'pointer', fontWeight: '600', fontSize: '0.8125rem', background: newSensorAlert.conditionType === 'range' ? '#4cbe00' : '#f1f5f9', color: newSensorAlert.conditionType === 'range' ? 'white' : '#64748b' }}>
                            Ngoài khoảng
                          </button>
                          <button type="button" onClick={() => setNewSensorAlert({...newSensorAlert, conditionType: 'below'})}
                            style={{ flex: 1, padding: '0.625rem', borderRadius: '0.5rem', border: 'none', cursor: 'pointer', fontWeight: '600', fontSize: '0.8125rem', background: newSensorAlert.conditionType === 'below' ? '#4cbe00' : '#f1f5f9', color: newSensorAlert.conditionType === 'below' ? 'white' : '#64748b' }}>
                            Nhỏ hơn
                          </button>
                          <button type="button" onClick={() => setNewSensorAlert({...newSensorAlert, conditionType: 'above'})}
                            style={{ flex: 1, padding: '0.625rem', borderRadius: '0.5rem', border: 'none', cursor: 'pointer', fontWeight: '600', fontSize: '0.8125rem', background: newSensorAlert.conditionType === 'above' ? '#4cbe00' : '#f1f5f9', color: newSensorAlert.conditionType === 'above' ? 'white' : '#64748b' }}>
                            Lớn hơn
                          </button>
                        </div>
                        
                        {/* Input giá trị */}
                        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                          {(newSensorAlert.conditionType === 'range' || newSensorAlert.conditionType === 'above') && (
                            <div style={{ flex: 1 }}>
                              <label style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.25rem', display: 'block' }}>
                                {newSensorAlert.conditionType === 'range' ? 'Giá trị tối thiểu' : 'Lớn hơn'}
                              </label>
                              <div className="modern-input">
                                <input type="number" value={newSensorAlert.minValue} onChange={(e) => setNewSensorAlert({...newSensorAlert, minValue: parseFloat(e.target.value)})} />
                              </div>
                            </div>
                          )}
                          {newSensorAlert.conditionType === 'range' && (
                            <span style={{ color: '#94a3b8', fontWeight: '600' }}>—</span>
                          )}
                          {(newSensorAlert.conditionType === 'range' || newSensorAlert.conditionType === 'below') && (
                            <div style={{ flex: 1 }}>
                              <label style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.25rem', display: 'block' }}>
                                {newSensorAlert.conditionType === 'range' ? 'Giá trị tối đa' : 'Nhỏ hơn'}
                              </label>
                              <div className="modern-input">
                                <input type="number" value={newSensorAlert.maxValue} onChange={(e) => setNewSensorAlert({...newSensorAlert, maxValue: parseFloat(e.target.value)})} />
                              </div>
                            </div>
                          )}
                        </div>
                        
                        {/* Mô tả điều kiện */}
                        <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: '#fef3c7', borderRadius: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span className="material-symbols-outlined" style={{ color: '#d97706', fontSize: '1.125rem' }}>info</span>
                          <span style={{ fontSize: '0.8125rem', color: '#92400e' }}>
                            {newSensorAlert.conditionType === 'range' && `Nhắc nhở khi ${sensorOptions.find(s => s.id === newSensorAlert.sensor)?.name} < ${newSensorAlert.minValue} hoặc > ${newSensorAlert.maxValue} ${sensorOptions.find(s => s.id === newSensorAlert.sensor)?.unit}`}
                            {newSensorAlert.conditionType === 'below' && `Nhắc nhở khi ${sensorOptions.find(s => s.id === newSensorAlert.sensor)?.name} < ${newSensorAlert.maxValue} ${sensorOptions.find(s => s.id === newSensorAlert.sensor)?.unit}`}
                            {newSensorAlert.conditionType === 'above' && `Nhắc nhở khi ${sensorOptions.find(s => s.id === newSensorAlert.sensor)?.name} > ${newSensorAlert.minValue} ${sensorOptions.find(s => s.id === newSensorAlert.sensor)?.unit}`}
                          </span>
                        </div>
                      </div>

                      <div className="input-group">
                        <label className="input-label">Nội dung nhắc nhở</label>
                        <div className="modern-input">
                          <textarea placeholder="VD: Cần bật đèn bổ sung cho cây..." value={newSensorAlert.message} onChange={(e) => setNewSensorAlert({...newSensorAlert, message: e.target.value})} />
                        </div>
                      </div>
                    </div>
                </div>
                <div className="modal-footer">
                  <button className="btn-modern secondary" onClick={() => setShowCreateForm(false)}>Hủy</button>
                  <button className="btn-modern primary" onClick={addSensorAlert}>
                    <span className="material-symbols-outlined">check</span> Thêm
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Danh sách nhắc nhở theo cảm biến */}
          {sensorAlerts.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '0.75rem' }}>
              {sensorAlerts.map(alert => {
                const sensor = sensorOptions.find(s => s.id === alert.sensor);
                  return (
                    <div key={alert.id} style={{ 
                      padding: '1rem 1.25rem', 
                      background: 'white', 
                      borderRadius: '0.75rem', 
                      border: alert.enabled ? `2px solid ${sensor?.color}` : '1px solid #e2e8f0',
                      boxShadow: alert.enabled ? `0 4px 12px ${sensor?.color}20` : 'none'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                        <div style={{ 
                          width: '2.75rem', height: '2.75rem', borderRadius: '0.75rem', 
                          background: alert.enabled ? sensor?.color : '#f1f5f9', 
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          flexShrink: 0
                        }}>
                          <span className="material-symbols-outlined" style={{ color: alert.enabled ? 'white' : '#94a3b8', fontSize: '1.25rem' }}>{sensor?.icon}</span>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ margin: 0, fontWeight: '700', color: '#0f172a', fontSize: '0.9375rem' }}>{alert.name}</p>
                          <p style={{ margin: '0.25rem 0 0', fontSize: '0.8125rem', color: '#64748b' }}>{sensor?.name}</p>
                          <div style={{ marginTop: '0.5rem', display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
                            <span style={{ 
                              padding: '0.25rem 0.5rem', 
                              borderRadius: '0.375rem', 
                              fontSize: '0.75rem', 
                              fontWeight: '600',
                              background: alert.conditionType === 'range' ? '#fef3c7' : alert.conditionType === 'below' ? '#dbeafe' : '#fee2e2',
                              color: alert.conditionType === 'range' ? '#92400e' : alert.conditionType === 'below' ? '#1e40af' : '#991b1b'
                            }}>
                              {alert.conditionType === 'range' && `Ngoài ${alert.minValue} - ${alert.maxValue} ${sensor?.unit}`}
                              {alert.conditionType === 'below' && `< ${alert.maxValue} ${sensor?.unit}`}
                              {alert.conditionType === 'above' && `> ${alert.minValue} ${sensor?.unit}`}
                            </span>
                          </div>
                          {alert.message && <p style={{ margin: '0.5rem 0 0', fontSize: '0.8125rem', color: '#94a3b8', fontStyle: 'italic' }}>"{alert.message}"</p>}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'flex-end' }}>
                          <label className="toggle-switch" style={{ transform: 'scale(0.85)' }}>
                            <input type="checkbox" checked={alert.enabled} onChange={() => toggleSensorAlert(alert.id)} />
                            <span className="toggle-track" style={{ background: alert.enabled ? sensor?.color : '#d1d5db' }}></span>
                          </label>
                          <button className="btn-icon danger" style={{ padding: '0.375rem' }} onClick={() => deleteSensorAlert(alert.id)}>
                            <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>delete</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
          ) : (
            <div className="empty-state" style={{ padding: '3rem', background: 'white', borderRadius: '0.75rem' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '3rem', color: '#94a3b8' }}>sensors_off</span>
              <h3>Chưa có nhắc nhở nào</h3>
              <p>Tạo nhắc nhở dựa trên ngưỡng cảm biến để được thông báo khi điều kiện vượt ngưỡng</p>
              <div style={{ marginTop: '1rem', padding: '1rem', background: '#f8fafc', borderRadius: '0.5rem', textAlign: 'left' }}>
                <p style={{ margin: '0 0 0.5rem', fontWeight: '600', color: '#0f172a', fontSize: '0.875rem' }}>Ví dụ:</p>
                <ul style={{ margin: 0, paddingLeft: '1.25rem', color: '#64748b', fontSize: '0.8125rem' }}>
                  <li>Ánh sáng ngoài khoảng 10-90 lux → Nhắc bật/tắt đèn</li>
                  <li>Mực nước bể &lt; 20% → Nhắc bổ sung nước</li>
                  <li>Độ ẩm đất &lt; 30% → Nhắc tưới cây</li>
                  <li>Nhiệt độ &gt; 35°C → Nhắc bật quạt/làm mát</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab: Tự động */}
      {activeTab === 'auto' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
            <button className="btn-modern primary" onClick={() => setShowCreateForm(true)}><span className="material-symbols-outlined">add</span>Thêm tự động</button>
          </div>
          {showCreateForm && (
            <div className="modal-overlay" onClick={() => setShowCreateForm(false)}>
              <div className="modal" style={{ maxWidth: '550px' }} onClick={(e) => e.stopPropagation()}>
                <div className="modal-header"><h2><span className="material-symbols-outlined">smart_toy</span> Thêm tự động hóa</h2><button className="modal-close" onClick={() => setShowCreateForm(false)}><span className="material-symbols-outlined">close</span></button></div>
                <div className="modal-body">
                  {/* Tab chọn loại tự động */}
                  <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', background: '#f1f5f9', padding: '0.375rem', borderRadius: '0.75rem' }}>
                    <button onClick={() => setAutomationType('sensor')} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '0.75rem', borderRadius: '0.5rem', border: 'none', cursor: 'pointer', fontWeight: '600', fontSize: '0.875rem', background: automationType === 'sensor' ? 'white' : 'transparent', color: automationType === 'sensor' ? '#4cbe00' : '#64748b', boxShadow: automationType === 'sensor' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '1.125rem' }}>sensors</span>Theo cảm biến
                    </button>
                    <button onClick={() => setAutomationType('schedule')} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '0.75rem', borderRadius: '0.5rem', border: 'none', cursor: 'pointer', fontWeight: '600', fontSize: '0.875rem', background: automationType === 'schedule' ? 'white' : 'transparent', color: automationType === 'schedule' ? '#4cbe00' : '#64748b', boxShadow: automationType === 'schedule' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '1.125rem' }}>schedule</span>Hẹn giờ
                    </button>
                  </div>

                  {/* Form theo cảm biến */}
                  {automationType === 'sensor' && (
                    <div className="modern-form">
                      <div className="input-group"><label className="input-label">Tên quy tắc <span className="required">*</span></label><div className="modern-input"><input type="text" placeholder="VD: Bật quạt khi nóng" value={newAutomation.name} onChange={(e) => setNewAutomation({...newAutomation, name: e.target.value})} /></div></div>
                      <div className="form-divider"><span>Điều kiện kích hoạt</span></div>
                      <div className="form-grid">
                        <div className="input-group"><label className="input-label">Cảm biến</label><div className="modern-input"><select value={newAutomation.trigger} onChange={(e) => setNewAutomation({...newAutomation, trigger: e.target.value})}><option value="temperature">🌡️ Nhiệt độ</option><option value="humidity">💧 Độ ẩm</option><option value="soil_moisture">🌱 Độ ẩm đất</option><option value="light">☀️ Ánh sáng</option></select></div></div>
                        <div className="input-group"><label className="input-label">Điều kiện</label><div className="modern-input"><select value={newAutomation.condition} onChange={(e) => setNewAutomation({...newAutomation, condition: e.target.value})}><option value="above">Lớn hơn</option><option value="below">Nhỏ hơn</option></select></div></div>
                      </div>
                      <div className="input-group"><label className="input-label">Giá trị ngưỡng</label><div className="modern-input"><input type="number" value={newAutomation.value} onChange={(e) => setNewAutomation({...newAutomation, value: parseInt(e.target.value)})} /></div></div>
                      <div className="form-divider"><span>Hành động</span></div>
                      <div className="form-grid">
                        <div className="input-group"><label className="input-label">Thiết bị</label><div className="modern-input"><select value={newAutomation.action} onChange={(e) => setNewAutomation({...newAutomation, action: e.target.value})}><option value="fan">🌀 Quạt</option><option value="water">💧 Tưới nước</option><option value="light">💡 Đèn</option><option value="heater">🔥 Sưởi</option><option value="cooler">❄️ Làm mát</option><option value="mist">💦 Phun sương</option></select></div></div>
                        <div className="input-group"><label className="input-label">Cường độ (%)</label><div className="modern-input"><input type="number" min="0" max="100" value={newAutomation.actionValue} onChange={(e) => setNewAutomation({...newAutomation, actionValue: parseInt(e.target.value)})} /></div></div>
                      </div>
                    </div>
                  )}

                  {/* Form hẹn giờ */}
                  {automationType === 'schedule' && (
                    <div className="modern-form">
                      <div className="input-group"><label className="input-label">Tên lịch <span className="required">*</span></label><div className="modern-input"><input type="text" placeholder="VD: Tưới cây buổi sáng" value={newSchedule.name} onChange={(e) => setNewSchedule({...newSchedule, name: e.target.value})} /></div></div>
                      <div className="form-grid">
                        <div className="input-group"><label className="input-label">Thời gian</label><div className="modern-input"><input type="time" value={newSchedule.time} onChange={(e) => setNewSchedule({...newSchedule, time: e.target.value})} /></div></div>
                        <div className="input-group"><label className="input-label">Thời lượng (phút)</label><div className="modern-input"><input type="number" min="1" max="120" value={newSchedule.duration} onChange={(e) => setNewSchedule({...newSchedule, duration: parseInt(e.target.value)})} /></div></div>
                      </div>
                      <div className="input-group"><label className="input-label">Ngày trong tuần</label>
                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                          {Object.entries(dayLabels).map(([day, label]) => (
                            <button key={day} type="button" onClick={() => { const days = newSchedule.days.includes(day) ? newSchedule.days.filter(d => d !== day) : [...newSchedule.days, day]; setNewSchedule({...newSchedule, days}); }}
                              style={{ padding: '0.5rem 0.75rem', borderRadius: '0.5rem', border: 'none', cursor: 'pointer', background: newSchedule.days.includes(day) ? '#4cbe00' : '#f1f5f9', color: newSchedule.days.includes(day) ? 'white' : '#64748b', fontWeight: '600' }}>{label}</button>
                          ))}
                        </div>
                      </div>
                      <div className="form-divider"><span>Hành động</span></div>
                      <div className="form-grid">
                        <div className="input-group"><label className="input-label">Thiết bị</label><div className="modern-input"><select value={newSchedule.action} onChange={(e) => setNewSchedule({...newSchedule, action: e.target.value})}><option value="water">💧 Tưới nước</option><option value="light">💡 Đèn</option><option value="fan">🌀 Quạt</option><option value="heater">🔥 Sưởi</option><option value="cooler">❄️ Làm mát</option><option value="mist">💦 Phun sương</option></select></div></div>
                        <div className="input-group"><label className="input-label">Cường độ (%)</label><div className="modern-input"><input type="number" min="0" max="100" value={newSchedule.actionValue} onChange={(e) => setNewSchedule({...newSchedule, actionValue: parseInt(e.target.value)})} /></div></div>
                      </div>
                    </div>
                  )}
                </div>
                <div className="modal-footer">
                  <button className="btn-modern secondary" onClick={() => setShowCreateForm(false)}>Hủy</button>
                  <button className="btn-modern primary" onClick={automationType === 'sensor' ? addAutomation : addSchedule}><span className="material-symbols-outlined">check</span> Thêm</button>
                </div>
              </div>
            </div>
          )}

          {/* Danh sách hẹn giờ */}
          {schedules.length > 0 && (
            <div style={{ marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '0.875rem', fontWeight: '700', color: '#64748b', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>schedule</span>
                Hẹn giờ ({schedules.length})
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '0.75rem' }}>
                {schedules.map(schedule => {
                  const actionIcons = { water: '💧', light: '💡', fan: '🌀', heater: '🔥', cooler: '❄️', mist: '💦' };
                  const actionNames = { water: 'Tưới nước', light: 'Đèn', fan: 'Quạt', heater: 'Sưởi', cooler: 'Làm mát', mist: 'Phun sương' };
                  return (
                    <div key={schedule.id} style={{ 
                      padding: '1rem 1.25rem', 
                      background: 'white', 
                      borderRadius: '0.75rem', 
                      border: schedule.enabled ? '2px solid #4cbe00' : '1px solid #e2e8f0',
                      boxShadow: schedule.enabled ? '0 4px 12px rgba(76, 190, 0, 0.15)' : 'none'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                        <div style={{ 
                          width: '2.75rem', height: '2.75rem', borderRadius: '0.75rem', 
                          background: schedule.enabled ? '#4cbe00' : '#f1f5f9', 
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          flexShrink: 0
                        }}>
                          <span className="material-symbols-outlined" style={{ color: schedule.enabled ? 'white' : '#94a3b8', fontSize: '1.25rem' }}>alarm</span>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ margin: 0, fontWeight: '700', color: '#0f172a', fontSize: '0.9375rem' }}>{schedule.name}</p>
                          <p style={{ margin: '0.25rem 0 0', fontSize: '1.25rem', fontWeight: '800', color: schedule.enabled ? '#4cbe00' : '#64748b' }}>{schedule.time}</p>
                          <p style={{ margin: '0.25rem 0 0', fontSize: '0.75rem', color: '#94a3b8' }}>{schedule.days.map(d => dayLabels[d]).join(', ')}</p>
                          <div style={{ marginTop: '0.5rem', display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
                            <span style={{ padding: '0.25rem 0.5rem', borderRadius: '0.375rem', fontSize: '0.75rem', fontWeight: '600', background: '#dbeafe', color: '#1e40af' }}>
                              {actionIcons[schedule.action]} {actionNames[schedule.action]} {schedule.actionValue}%
                            </span>
                            <span style={{ padding: '0.25rem 0.5rem', borderRadius: '0.375rem', fontSize: '0.75rem', fontWeight: '600', background: '#fef3c7', color: '#92400e' }}>
                              ⏱️ {schedule.duration} phút
                            </span>
                          </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'flex-end' }}>
                          <label className="toggle-switch" style={{ transform: 'scale(0.85)' }}>
                            <input type="checkbox" checked={schedule.enabled} onChange={() => toggleSchedule(schedule.id)} />
                            <span className="toggle-track"></span>
                          </label>
                          <button className="btn-icon danger" style={{ padding: '0.375rem' }} onClick={() => deleteSchedule(schedule.id)}>
                            <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>delete</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Danh sách tự động theo cảm biến */}
          {automations.length > 0 && (
            <div>
              <h3 style={{ fontSize: '0.875rem', fontWeight: '700', color: '#64748b', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>sensors</span>
                Tự động theo cảm biến ({automations.length})
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {automations.map(auto => (
                  <div key={auto.id} style={{ padding: '1.25rem', background: 'white', borderRadius: '0.75rem', border: auto.enabled ? '2px solid #4cbe00' : '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.75rem' }}>
                      <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: '0.5rem', background: auto.enabled ? 'rgba(76, 190, 0, 0.15)' : '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span className="material-symbols-outlined" style={{ color: auto.enabled ? '#4cbe00' : '#94a3b8' }}>smart_toy</span>
                      </div>
                      <div style={{ flex: 1 }}><p style={{ margin: 0, fontWeight: '600', color: '#0f172a' }}>{auto.name}</p></div>
                      <label className="toggle-switch"><input type="checkbox" checked={auto.enabled} onChange={() => toggleAutomation(auto.id)} /><span className="toggle-track"></span></label>
                      <button className="btn-icon danger" onClick={() => deleteAutomation(auto.id)}><span className="material-symbols-outlined">delete</span></button>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem', background: '#f8fafc', borderRadius: '0.5rem', fontSize: '0.875rem', color: '#64748b' }}>
                      <span>Khi</span><span className="badge badge-info">{auto.trigger}</span><span>{auto.condition === 'above' ? '>' : '<'}</span><span className="badge badge-warning">{auto.value}</span><span>→</span><span className="badge badge-success">{auto.action} {auto.actionValue}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty state */}
          {automations.length === 0 && schedules.length === 0 && (
            <div className="empty-state" style={{ padding: '3rem', background: 'white', borderRadius: '0.75rem' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '3rem', color: '#94a3b8' }}>smart_toy</span>
              <h3>Chưa có quy tắc tự động nào</h3>
              <p>Tạo quy tắc để hệ thống tự động điều khiển thiết bị</p>
              <div style={{ marginTop: '1rem', padding: '1rem', background: '#f8fafc', borderRadius: '0.5rem', textAlign: 'left' }}>
                <p style={{ margin: '0 0 0.5rem', fontWeight: '600', color: '#0f172a', fontSize: '0.875rem' }}>Ví dụ:</p>
                <ul style={{ margin: 0, paddingLeft: '1.25rem', color: '#64748b', fontSize: '0.8125rem' }}>
                  <li><strong>Hẹn giờ:</strong> 5h sáng tưới cây 10 phút</li>
                  <li><strong>Hẹn giờ:</strong> 18h bật đèn chiếu sáng</li>
                  <li><strong>Cảm biến:</strong> Nhiệt độ &gt; 35°C → Bật quạt</li>
                  <li><strong>Cảm biến:</strong> Độ ẩm đất &lt; 30% → Tưới nước</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Control Card Component
function ControlCard({ control, onAction }) {
  const getControlIcon = (type) => {
    switch (type) {
      case 'light': return '💡';
      case 'water': return '💧';
      case 'fan': return '🌀';
      case 'heater': return '🔥';
      case 'cooler': return '❄️';
      default: return '🔧';
    }
  };

  const getModeIcon = (mode) => {
    switch (mode) {
      case 'manual': return '🔧';
      case 'scheduled': return '⏰';
      case 'auto': return '🤖';
      case 'threshold': return '⚠️';
      default: return '🔧';
    }
  };

  const getModeDescription = (control) => {
    switch (control.mode) {
      case 'manual':
        return `Cường độ: ${control.manualSettings?.intensity || 0}% | Thời gian: ${control.manualSettings?.duration || 0} phút`;
      case 'auto':
        return `Mục tiêu: ${control.autoSettings?.targetValue || 0} ± ${control.autoSettings?.tolerance || 0}`;
      case 'threshold':
        return `${control.thresholdSettings?.condition === 'above' ? 'Trên' : 'Dưới'} ${control.thresholdSettings?.value || 0}`;
      case 'scheduled':
        return 'Theo lịch đã đặt';
      default:
        return 'Chưa cấu hình';
    }
  };

  return (
    <div className="control-section" style={{ position: 'relative' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
        <h3>
          {getControlIcon(control.controlType)} {control.controlType.toUpperCase()}
        </h3>
        <span className={`status ${control.status}`}>
          {control.status === 'active' ? 'Đang hoạt động' : 'Tắt'}
        </span>
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <p style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
          {getModeIcon(control.mode)} <strong>{control.mode.toUpperCase()}</strong>
        </p>
        <p style={{ fontSize: '0.9rem', color: '#666' }}>
          {getModeDescription(control)}
        </p>
      </div>

      {control.currentState && (
        <div style={{ marginBottom: '1rem', fontSize: '0.85rem', color: '#666' }}>
          <p>Cường độ hiện tại: {control.currentState.intensity || 0}%</p>
          {control.currentState.lastActivated && (
            <p>Lần cuối hoạt động: {new Date(control.currentState.lastActivated).toLocaleString('vi-VN')}</p>
          )}
        </div>
      )}

      <div className="action-buttons" style={{ marginTop: '1rem' }}>
        {control.status === 'active' ? (
          <button
            className="btn btn-danger"
            onClick={() => onAction(control._id, 'deactivate')}
            style={{ fontSize: '0.85rem' }}
          >
            ⏹️ Tắt
          </button>
        ) : (
          <button
            className="btn btn-primary"
            onClick={() => onAction(control._id, 'activate', {
              intensity: control.manualSettings?.intensity || 50,
              duration: control.manualSettings?.duration || 0
            })}
            style={{ fontSize: '0.85rem' }}
          >
            ▶️ Bật
          </button>
        )}
      </div>
    </div>
  );
}

// Reminders Page - Import from component
function RemindersPage() {
  return <Reminders />;
}

// Garden View Page - Canvas-based drag-drop layout
function GardenPage() {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('map');
  const canvasRef = React.useRef(null);
  
  // Zone templates for sidebar
  const zoneTemplates = [
    { type: 'vegetable', name: 'Khu trồng rau', icon: '🥬', color: '#22c55e' },
    { type: 'rice', name: 'Khu trồng lúa', icon: '🌾', color: '#eab308' },
    { type: 'fruit', name: 'Cây ăn quả', icon: '🍊', color: '#f97316' },
    { type: 'flower', name: 'Khu trồng hoa', icon: '🌸', color: '#ec4899' },
    { type: 'fish', name: 'Ao cá', icon: '🐟', color: '#3b82f6' },
    { type: 'herb', name: 'Thảo mộc', icon: '🌿', color: '#10b981' },
    { type: 'greenhouse', name: 'Nhà kính', icon: '🏠', color: '#8b5cf6' },
    { type: 'storage', name: 'Kho chứa', icon: '📦', color: '#64748b' },
  ];
  
  // Placed zones on canvas (with absolute positioning)
  const [placedZones, setPlacedZones] = useState([]);
  
  const [selectedZone, setSelectedZone] = useState(null);
  const [draggingZone, setDraggingZone] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [resizingZone, setResizingZone] = useState(null);
  const [draggedTemplate, setDraggedTemplate] = useState(null);

  // Camera state
  const [cameraUrl, setCameraUrl] = useState('');
  const [devices, setDevices] = useState([]);
  const [selectedCameraDevice, setSelectedCameraDevice] = useState(null);
  const [cameraFrame, setCameraFrame] = useState(null);
  const [cameraError, setCameraError] = useState(null);
  const [cameraSource, setCameraSource] = useState('webrtc'); // 'url', 'device', or 'webrtc'
  const socketRef = React.useRef(null);
  const cameraImgRef = React.useRef(null);
  const webrtcVideoRef = React.useRef(null);
  const peerConnectionRef = React.useRef(null);
  const pendingStreamRef = React.useRef(null);
  const [webrtcConnected, setWebrtcConnected] = useState(false);
  const [webrtcStatus, setWebrtcStatus] = useState('disconnected'); // 'disconnected', 'connecting', 'connected'
  const [socketConnected, setSocketConnected] = useState(false);

  // Function to set video stream - defined outside useEffect so it can be called from multiple places
  const setVideoStream = React.useCallback((stream) => {
    console.log('🎥 setVideoStream called, stream:', !!stream, 'videoRef:', !!webrtcVideoRef.current);
    if (stream) {
      pendingStreamRef.current = stream;
    }
    if (webrtcVideoRef.current && pendingStreamRef.current) {
      const video = webrtcVideoRef.current;
      const currentStream = pendingStreamRef.current;
      
      // Only set srcObject if it's different
      if (video.srcObject !== currentStream) {
        video.srcObject = currentStream;
        video.muted = true;
        console.log('🎥 Video srcObject set! Stream tracks:', currentStream.getTracks().map(t => `${t.kind}:${t.readyState}:muted=${t.muted}`));
      }
      
      // Always try to play
      video.play().then(() => {
        console.log('🎥 Video playing! Dimensions:', video.videoWidth, 'x', video.videoHeight);
      }).catch(err => {
        // Ignore AbortError from interrupted play requests
        if (err.name !== 'AbortError') {
          console.log('🎥 Play error:', err.message);
        }
      });
      
      setWebrtcConnected(true);
      setWebrtcStatus('connected');
      setCameraError(null);
    }
  }, []);

  // WebRTC config
  const rtcConfig = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      { urls: 'stun:stun4.l.google.com:19302' }
    ],
    iceCandidatePoolSize: 10
  };

  // Load garden settings from API
  useEffect(() => {
    fetchGardenSettings();
    fetchDevices();
    
    // Connect to WebSocket
    import('socket.io-client').then(({ io }) => {
      const socket = io(API_BASE_URL, {
        transports: ['websocket', 'polling']
      });
      socketRef.current = socket;
      
      socket.on('connect', () => {
        console.log('📷 WebSocket connected:', socket.id);
        setSocketConnected(true);
      });
      
      // Base64 frame streaming (fallback)
      socket.on('camera-frame', (data) => {
        if (cameraSource === 'device' && cameraImgRef.current && data.frame) {
          if (selectedCameraDevice && data.deviceId === selectedCameraDevice.deviceId) {
            cameraImgRef.current.src = `data:image/jpeg;base64,${data.frame}`;
            setCameraError(null);
            if (!cameraFrame) setCameraFrame('connected');
          }
        }
      });

      // WebRTC: Receive offer from broadcaster
      socket.on('webrtc-offer', async (data) => {
        console.log('🎥 Received WebRTC offer from broadcaster');
        setWebrtcStatus('connecting');
        try {
          // Close existing peer connection if any
          if (peerConnectionRef.current) {
            peerConnectionRef.current.close();
          }
          
          const pc = new RTCPeerConnection(rtcConfig);
          peerConnectionRef.current = pc;
          
          pc.ontrack = (event) => {
            console.log('🎥 Received video track!', event.streams, event.track);
            const track = event.track;
            console.log('🎥 Track details - muted:', track.muted, 'enabled:', track.enabled, 'readyState:', track.readyState);
            
            // Listen for track unmute (when actual media data arrives)
            track.onunmute = () => {
              console.log('🎥 Track UNMUTED - media data is flowing!');
              if (event.streams[0]) {
                setVideoStream(event.streams[0]);
              }
            };
            
            if (event.streams[0]) {
              console.log('🎥 Stream received, tracks:', event.streams[0].getTracks().map(t => `${t.kind}:${t.readyState}:${t.enabled}:muted=${t.muted}`));
              // Store in ref and try to set video immediately
              pendingStreamRef.current = event.streams[0];
              setVideoStream(event.streams[0]);
            }
          };

          pc.onicecandidate = (event) => {
            if (event.candidate) {
              console.log('🧊 Sending ICE candidate');
              socket.emit('webrtc-ice-candidate', {
                deviceId: data.deviceId,
                candidate: event.candidate
              });
            }
          };

          pc.onicegatheringstatechange = () => {
            console.log('🧊 ICE gathering state:', pc.iceGatheringState);
          };

          pc.oniceconnectionstatechange = () => {
            console.log('🧊 ICE connection state:', pc.iceConnectionState);
            // When ICE is connected, the stream should already be set from ontrack
            if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
              console.log('🎥 ICE connected');
              // Try to play video if we have a pending stream
              if (pendingStreamRef.current && webrtcVideoRef.current) {
                webrtcVideoRef.current.play().catch(() => {});
              }
            }
          };

          pc.onconnectionstatechange = () => {
            console.log('WebRTC state:', pc.connectionState);
            if (pc.connectionState === 'connected') {
              setWebrtcConnected(true);
              setWebrtcStatus('connected');
            } else if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
              setWebrtcConnected(false);
              setWebrtcStatus('disconnected');
            }
          };

          await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);

          socket.emit('webrtc-answer', {
            deviceId: data.deviceId,
            answer: answer
          });
          console.log('🎥 Sent WebRTC answer');
        } catch (err) {
          console.error('WebRTC error:', err);
          setCameraError('Lỗi WebRTC: ' + err.message);
          setWebrtcStatus('disconnected');
        }
      });

      socket.on('webrtc-ice-candidate', async (data) => {
        console.log('🧊 Received ICE candidate from broadcaster');
        if (peerConnectionRef.current && data.candidate) {
          try {
            await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
            console.log('🧊 ICE candidate added successfully');
          } catch (err) {
            console.error('ICE error:', err);
          }
        }
      });
      
      socket.on('disconnect', () => {
        console.log('📷 WebSocket disconnected');
        setWebrtcConnected(false);
        setWebrtcStatus('disconnected');
        setSocketConnected(false);
        pendingStreamRef.current = null;
        if (webrtcVideoRef.current) {
          webrtcVideoRef.current.srcObject = null;
        }
      });
    });
    
    return () => {
      if (socketRef.current) socketRef.current.disconnect();
      if (peerConnectionRef.current) peerConnectionRef.current.close();
    };
  }, [setVideoStream]);

  // Join WebRTC room when device selected and using WebRTC mode
  useEffect(() => {
    if (socketRef.current && socketConnected && selectedCameraDevice && cameraSource === 'webrtc') {
      const deviceId = selectedCameraDevice.deviceId;
      console.log('🎥 Joining WebRTC room:', deviceId, 'Socket connected:', socketRef.current.connected);
      setWebrtcStatus('connecting');
      // Close existing peer connection before joining new room
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
      }
      pendingStreamRef.current = null;
      if (webrtcVideoRef.current) {
        webrtcVideoRef.current.srcObject = null;
      }
      socketRef.current.emit('webrtc-join-stream', { deviceId, viewerId: socketRef.current.id });
      setCameraError('Đang chờ stream từ simulator...');
    } else if (cameraSource === 'device' && selectedCameraDevice) {
      // For base64 mode, just fetch cached frame
      fetchCameraFrame(selectedCameraDevice.deviceId);
    } else if (cameraSource === 'webrtc' && selectedCameraDevice && !socketConnected) {
      console.log('🎥 Socket not ready yet, waiting...');
      setCameraError('Đang kết nối WebSocket...');
    }
    
    return () => {
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
        setWebrtcConnected(false);
        setWebrtcStatus('disconnected');
      }
    };
  }, [cameraSource, selectedCameraDevice, socketConnected]);

  // Fetch devices for camera selection
  const fetchDevices = async () => {
    try {
      const response = await apiFetch('/api/devices', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (response.ok) {
        const data = await response.json();
        setDevices(data.devices || []);
      }
    } catch (error) {
      console.error('Failed to fetch devices:', error);
    }
  };

  // Fetch camera frame from API (for initial load)
  const fetchCameraFrame = async (deviceId) => {
    try {
      const response = await apiFetch(`/api/camera/frame/${deviceId}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (response.ok) {
        const data = await response.json();
        if (data.available && data.frame) {
          setCameraFrame(`data:image/jpeg;base64,${data.frame}`);
          setCameraError(null);
        } else {
          setCameraFrame(null);
          setCameraError(data.message || 'Đang chờ frame từ thiết bị...');
        }
      } else {
        setCameraFrame(null);
        setCameraError('Lỗi kết nối API');
      }
    } catch (error) {
      console.error('Failed to fetch camera frame:', error);
      setCameraFrame(null);
      setCameraError('Lỗi kết nối');
    }
  };

  const fetchGardenSettings = async () => {
    try {
      const response = await apiFetch('/api/garden/settings', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.zones?.length > 0) {
          setPlacedZones(data.zones);
        }
        if (data.cameraUrl) {
          setCameraUrl(data.cameraUrl);
        }
      }
    } catch (error) {
      console.error('Failed to fetch garden settings:', error);
    } finally {
      setLoading(false);
    }
  };

  // Save zones to API (debounced)
  const saveZones = async (zones) => {
    try {
      await apiFetch('/api/garden/zones', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ zones })
      });
    } catch (error) {
      console.error('Failed to save zones:', error);
    }
  };

  // Save camera URL to API
  const saveCameraUrl = async (url) => {
    try {
      await apiFetch('/api/garden/camera', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ cameraUrl: url })
      });
    } catch (error) {
      console.error('Failed to save camera URL:', error);
    }
  };

  // Handle camera URL change with auto-save
  const handleCameraUrlChange = (url) => {
    setCameraUrl(url);
    // Debounce save
    clearTimeout(window.cameraUrlTimeout);
    window.cameraUrlTimeout = setTimeout(() => saveCameraUrl(url), 1000);
  };

  // Handle template drag start
  const handleTemplateDragStart = (e, template) => {
    setDraggedTemplate(template);
    e.dataTransfer.effectAllowed = 'copy';
  };

  // Handle canvas drag over
  const handleCanvasDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  // Handle drop on canvas (create new zone)
  const handleCanvasDrop = (e) => {
    e.preventDefault();
    if (!draggedTemplate || !canvasRef.current) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left - 75; // Center the zone
    const y = e.clientY - rect.top - 50;
    
    const newId = Math.max(...placedZones.map(z => z.id), 0) + 1;
    const newZone = {
      id: newId,
      type: draggedTemplate.type,
      name: draggedTemplate.name,
      icon: draggedTemplate.icon,
      color: draggedTemplate.color,
      x: Math.max(0, Math.min(x, 550)),
      y: Math.max(0, Math.min(y, 350)),
      width: 150,
      height: 100
    };
    
    setPlacedZones(prev => {
      const newZones = [...prev, newZone];
      saveZones(newZones);
      return newZones;
    });
    setDraggedTemplate(null);
    setSelectedZone(newZone);
  };

  // Handle zone mouse down (start dragging)
  const handleZoneMouseDown = (e, zone) => {
    if (e.target.classList.contains('resize-handle')) return;
    e.stopPropagation();
    setSelectedZone(zone);
    setDraggingZone(zone.id);
    const rect = e.currentTarget.getBoundingClientRect();
    setDragOffset({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  // Handle mouse move (dragging zone)
  const handleCanvasMouseMove = (e) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    
    if (draggingZone) {
      const newX = e.clientX - rect.left - dragOffset.x;
      const newY = e.clientY - rect.top - dragOffset.y;
      
      setPlacedZones(prev => prev.map(z => {
        if (z.id === draggingZone) {
          return {
            ...z,
            x: Math.max(0, Math.min(newX, 700 - z.width)),
            y: Math.max(0, Math.min(newY, 450 - z.height))
          };
        }
        return z;
      }));
    }
    
    if (resizingZone) {
      const zone = placedZones.find(z => z.id === resizingZone);
      if (zone) {
        const newWidth = Math.max(80, e.clientX - rect.left - zone.x);
        const newHeight = Math.max(60, e.clientY - rect.top - zone.y);
        
        setPlacedZones(prev => prev.map(z => {
          if (z.id === resizingZone) {
            return {
              ...z,
              width: Math.min(newWidth, 700 - z.x),
              height: Math.min(newHeight, 450 - z.y)
            };
          }
          return z;
        }));
      }
    }
  };

  // Handle mouse up (stop dragging/resizing)
  const handleCanvasMouseUp = () => {
    if (draggingZone || resizingZone) {
      // Save zones after drag/resize ends
      saveZones(placedZones);
    }
    setDraggingZone(null);
    setResizingZone(null);
  };

  // Handle resize start
  const handleResizeStart = (e, zoneId) => {
    e.stopPropagation();
    setResizingZone(zoneId);
  };

  // Delete zone
  const deleteZone = (zoneId) => {
    setPlacedZones(prev => {
      const newZones = prev.filter(z => z.id !== zoneId);
      saveZones(newZones);
      return newZones;
    });
    if (selectedZone?.id === zoneId) setSelectedZone(null);
  };

  // Update zone name
  const updateZoneName = (zoneId, newName) => {
    setPlacedZones(prev => {
      const newZones = prev.map(z => z.id === zoneId ? { ...z, name: newName } : z);
      // Debounce save for name changes
      clearTimeout(window.zoneNameTimeout);
      window.zoneNameTimeout = setTimeout(() => saveZones(newZones), 500);
      return newZones;
    });
    if (selectedZone?.id === zoneId) {
      setSelectedZone(prev => ({ ...prev, name: newName }));
    }
  };

  if (loading) return <div className="loading"><div className="loading-spinner"></div></div>;

  const tabs = [{ id: 'map', label: 'Sơ đồ vườn', icon: 'grid_view' }, { id: 'camera', label: 'Camera', icon: 'videocam' }];

  return (
    <div>
      <div className="dashboard-header">
        <div className="header-text">
          <h2 className="dashboard-title">Xem vườn</h2>
          <p className="dashboard-subtitle">Quản lý sơ đồ vườn và camera giám sát</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', background: '#f1f5f9', padding: '0.375rem', borderRadius: '0.75rem', width: 'fit-content' }}>
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.625rem 1.25rem', borderRadius: '0.5rem', border: 'none', cursor: 'pointer', fontWeight: '600', fontSize: '0.875rem', transition: 'all 0.2s', background: activeTab === tab.id ? 'white' : 'transparent', color: activeTab === tab.id ? '#4cbe00' : '#64748b', boxShadow: activeTab === tab.id ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '1.125rem' }}>{tab.icon}</span>{tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'map' && (
        <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr 280px', gap: '1.5rem' }}>
          {/* Left Sidebar - Zone Templates */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ background: 'white', borderRadius: '0.75rem', padding: '1rem', border: '1px solid #e2e8f0' }}>
              <h4 style={{ margin: '0 0 0.75rem', fontSize: '0.875rem', fontWeight: '700', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '1rem', color: '#4cbe00' }}>widgets</span>
                Loại khu vực
              </h4>
              <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '0 0 0.75rem' }}>Kéo thả vào sơ đồ vườn</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {zoneTemplates.map(template => (
                  <div
                    key={template.type}
                    draggable
                    onDragStart={(e) => handleTemplateDragStart(e, template)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.625rem',
                      padding: '0.625rem 0.75rem',
                      background: `${template.color}10`,
                      borderRadius: '0.5rem',
                      cursor: 'grab',
                      border: `1px solid ${template.color}30`,
                      transition: 'all 0.2s'
                    }}
                  >
                    <span style={{ fontSize: '1.25rem' }}>{template.icon}</span>
                    <span style={{ fontSize: '0.8125rem', fontWeight: '600', color: '#0f172a', flex: 1 }}>{template.name}</span>
                    <span className="material-symbols-outlined" style={{ fontSize: '0.875rem', color: '#94a3b8' }}>drag_indicator</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Center - Canvas */}
          <div style={{ background: 'white', borderRadius: '0.75rem', padding: '1rem', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '700', color: '#0f172a' }}>Sơ đồ khu vườn</h3>
              <p style={{ margin: 0, fontSize: '0.75rem', color: '#94a3b8' }}>Kéo thả để di chuyển • Kéo góc để thay đổi kích thước</p>
            </div>
            
            {/* Canvas Area */}
            <div
              ref={canvasRef}
              onDragOver={handleCanvasDragOver}
              onDrop={handleCanvasDrop}
              onMouseMove={handleCanvasMouseMove}
              onMouseUp={handleCanvasMouseUp}
              onMouseLeave={handleCanvasMouseUp}
              onClick={() => setSelectedZone(null)}
              style={{
                position: 'relative',
                width: '100%',
                height: '450px',
                background: 'linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)',
                borderRadius: '0.75rem',
                border: '2px dashed #86efac',
                overflow: 'hidden',
                cursor: draggingZone ? 'grabbing' : 'default'
              }}
            >
              {/* Grid pattern overlay */}
              <div style={{
                position: 'absolute',
                inset: 0,
                backgroundImage: 'radial-gradient(circle, #22c55e20 1px, transparent 1px)',
                backgroundSize: '20px 20px',
                pointerEvents: 'none'
              }} />
              
              {/* Placed Zones */}
              {placedZones.map(zone => (
                <div
                  key={zone.id}
                  onMouseDown={(e) => handleZoneMouseDown(e, zone)}
                  onClick={(e) => { e.stopPropagation(); setSelectedZone(zone); }}
                  style={{
                    position: 'absolute',
                    left: zone.x,
                    top: zone.y,
                    width: zone.width,
                    height: zone.height,
                    background: `${zone.color}20`,
                    border: selectedZone?.id === zone.id ? `2px solid ${zone.color}` : `1px solid ${zone.color}60`,
                    borderRadius: '0.5rem',
                    cursor: draggingZone === zone.id ? 'grabbing' : 'grab',
                    display: 'flex',
                    flexDirection: 'column',
                    padding: '0.5rem',
                    boxShadow: selectedZone?.id === zone.id ? `0 0 0 3px ${zone.color}30` : 'none',
                    transition: draggingZone === zone.id ? 'none' : 'box-shadow 0.2s',
                    userSelect: 'none'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginBottom: '0.25rem' }}>
                    <span style={{ fontSize: '1rem' }}>{zone.icon}</span>
                    <span style={{ fontSize: '0.75rem', fontWeight: '700', color: zone.color, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{zone.name}</span>
                  </div>
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.5 }}>
                    <span style={{ fontSize: '0.625rem', color: '#64748b' }}>{Math.round(zone.width)}x{Math.round(zone.height)}</span>
                  </div>
                  
                  {/* Resize handle */}
                  <div
                    className="resize-handle"
                    onMouseDown={(e) => handleResizeStart(e, zone.id)}
                    style={{
                      position: 'absolute',
                      right: 0,
                      bottom: 0,
                      width: '16px',
                      height: '16px',
                      cursor: 'se-resize',
                      background: `linear-gradient(135deg, transparent 50%, ${zone.color} 50%)`,
                      borderRadius: '0 0 0.375rem 0'
                    }}
                  />
                </div>
              ))}
              
              {/* Empty state */}
              {placedZones.length === 0 && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>add_location_alt</span>
                  <p style={{ margin: 0, fontSize: '0.875rem' }}>Kéo thả khu vực từ bên trái vào đây</p>
                </div>
              )}
            </div>
          </div>

          {/* Right Sidebar - Zone Details */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {selectedZone ? (
              <div style={{ background: 'white', borderRadius: '0.75rem', padding: '1rem', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                  <h4 style={{ margin: 0, fontSize: '0.875rem', fontWeight: '700', color: '#0f172a' }}>Chi tiết khu vực</h4>
                  <button
                    onClick={() => deleteZone(selectedZone.id)}
                    style={{ background: '#fee2e2', border: 'none', borderRadius: '0.375rem', padding: '0.375rem', cursor: 'pointer' }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '1rem', color: '#ef4444' }}>delete</span>
                  </button>
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', background: `${selectedZone.color}10`, borderRadius: '0.5rem', marginBottom: '1rem' }}>
                  <span style={{ fontSize: '2rem' }}>{selectedZone.icon}</span>
                  <div>
                    <p style={{ margin: 0, fontWeight: '700', color: selectedZone.color }}>{selectedZone.name}</p>
                    <p style={{ margin: '0.125rem 0 0', fontSize: '0.75rem', color: '#64748b' }}>{zoneTemplates.find(t => t.type === selectedZone.type)?.name}</p>
                  </div>
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>Tên khu vực</label>
                    <input
                      type="text"
                      value={selectedZone.name}
                      onChange={(e) => updateZoneName(selectedZone.id, e.target.value)}
                      style={{ width: '100%', padding: '0.5rem 0.75rem', border: '1px solid #e2e8f0', borderRadius: '0.375rem', fontSize: '0.875rem' }}
                    />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                    <div>
                      <label style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>Vị trí X</label>
                      <p style={{ margin: 0, fontWeight: '600', color: '#0f172a', fontSize: '0.875rem' }}>{Math.round(selectedZone.x)}px</p>
                    </div>
                    <div>
                      <label style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>Vị trí Y</label>
                      <p style={{ margin: 0, fontWeight: '600', color: '#0f172a', fontSize: '0.875rem' }}>{Math.round(selectedZone.y)}px</p>
                    </div>
                    <div>
                      <label style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>Chiều rộng</label>
                      <p style={{ margin: 0, fontWeight: '600', color: '#0f172a', fontSize: '0.875rem' }}>{Math.round(selectedZone.width)}px</p>
                    </div>
                    <div>
                      <label style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>Chiều cao</label>
                      <p style={{ margin: 0, fontWeight: '600', color: '#0f172a', fontSize: '0.875rem' }}>{Math.round(selectedZone.height)}px</p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ background: 'white', borderRadius: '0.75rem', padding: '1.5rem', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '2.5rem', color: '#94a3b8', marginBottom: '0.5rem' }}>touch_app</span>
                <p style={{ margin: 0, fontSize: '0.875rem', color: '#64748b' }}>Chọn một khu vực để xem chi tiết</p>
              </div>
            )}
            
            {/* Zone List */}
            <div style={{ background: 'white', borderRadius: '0.75rem', padding: '1rem', border: '1px solid #e2e8f0' }}>
              <h4 style={{ margin: '0 0 0.75rem', fontSize: '0.875rem', fontWeight: '700', color: '#0f172a' }}>
                Danh sách khu vực ({placedZones.length})
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '200px', overflowY: 'auto' }}>
                {placedZones.length === 0 ? (
                  <p style={{ fontSize: '0.8125rem', color: '#94a3b8', textAlign: 'center', padding: '1rem' }}>Chưa có khu vực nào</p>
                ) : placedZones.map(zone => (
                  <div
                    key={zone.id}
                    onClick={() => setSelectedZone(zone)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.5rem 0.75rem',
                      background: selectedZone?.id === zone.id ? `${zone.color}15` : '#f8fafc',
                      borderRadius: '0.5rem',
                      cursor: 'pointer',
                      border: selectedZone?.id === zone.id ? `1px solid ${zone.color}` : '1px solid #e2e8f0'
                    }}
                  >
                    <span style={{ fontSize: '1.125rem' }}>{zone.icon}</span>
                    <span style={{ fontSize: '0.8125rem', fontWeight: '600', color: '#0f172a', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{zone.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'camera' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '1.5rem' }}>
          {/* Camera View */}
          <div style={{ background: '#0f172a', borderRadius: '0.75rem', overflow: 'hidden' }}>
            <div style={{ aspectRatio: '16/9', background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
              {/* WebRTC Video - always rendered but hidden when not in use */}
              <video 
                ref={webrtcVideoRef}
                autoPlay 
                playsInline 
                muted
                onLoadedMetadata={(e) => {
                  console.log('🎥 Video metadata loaded:', e.target.videoWidth, 'x', e.target.videoHeight);
                  // If dimensions are valid, video is ready
                  if (e.target.videoWidth > 10 && e.target.videoHeight > 10) {
                    setWebrtcConnected(true);
                    setWebrtcStatus('connected');
                  }
                }}
                onCanPlay={() => {
                  console.log('🎥 Video can play');
                  // Try to play when ready
                  webrtcVideoRef.current?.play().catch(() => {});
                }}
                onPlay={() => {
                  console.log('🎥 Video started playing, dimensions:', webrtcVideoRef.current?.videoWidth, 'x', webrtcVideoRef.current?.videoHeight);
                  setWebrtcConnected(true);
                  setWebrtcStatus('connected');
                }}
                onResize={() => {
                  // Video dimensions changed - actual video frames are arriving
                  const video = webrtcVideoRef.current;
                  if (video && video.videoWidth > 10) {
                    console.log('🎥 Video resized to:', video.videoWidth, 'x', video.videoHeight);
                  }
                }}
                style={{ 
                  width: '100%', 
                  height: '100%', 
                  objectFit: 'cover', 
                  background: '#000',
                  display: (cameraSource === 'webrtc' && selectedCameraDevice) ? 'block' : 'none'
                }} 
              />
              {(cameraSource === 'url' && cameraUrl) ? (
                <img src={cameraUrl} alt="Camera vườn" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (cameraSource === 'device' && cameraFrame) ? (
                <img ref={cameraImgRef} alt="Camera thiết bị" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (!(cameraSource === 'webrtc' && selectedCameraDevice)) && (
                <>
                  <span className="material-symbols-outlined" style={{ fontSize: '4rem', color: '#475569' }}>videocam</span>
                  <p style={{ color: '#64748b', fontSize: '0.875rem', marginTop: '0.75rem' }}>
                    {cameraError || 'Chưa có tín hiệu camera'}
                  </p>
                  <p style={{ color: '#475569', fontSize: '0.75rem', marginTop: '0.25rem' }}>
                    {cameraSource === 'webrtc' ? 'Mở webrtc.html và bắt đầu stream' : cameraSource === 'url' ? 'Nhập URL stream' : 'Chọn thiết bị'}
                  </p>
                </>
              )}
              <div style={{ position: 'absolute', top: '1rem', left: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.375rem 0.75rem', borderRadius: '0.5rem', background: (cameraSource === 'webrtc' && webrtcStatus === 'connected') || (cameraSource === 'url' && cameraUrl) || (cameraSource === 'device' && cameraFrame) ? 'rgba(34, 197, 94, 0.9)' : 'rgba(239, 68, 68, 0.9)', fontSize: '0.75rem', fontWeight: '600', color: 'white' }}>
                <span style={{ width: '0.5rem', height: '0.5rem', borderRadius: '50%', background: 'white', animation: ((cameraSource === 'webrtc' && webrtcStatus === 'connected') || (cameraSource === 'url' && cameraUrl) || (cameraSource === 'device' && cameraFrame)) ? 'pulse 2s infinite' : 'none' }}></span>
                {(cameraSource === 'webrtc' && webrtcStatus === 'connected') || (cameraSource === 'url' && cameraUrl) || (cameraSource === 'device' && cameraFrame) ? 'LIVE' : 'OFFLINE'}
              </div>
              {selectedCameraDevice && (cameraSource === 'device' || cameraSource === 'webrtc') && (
                <div style={{ position: 'absolute', top: '1rem', right: '1rem', padding: '0.375rem 0.75rem', borderRadius: '0.5rem', background: 'rgba(0,0,0,0.6)', fontSize: '0.75rem', color: 'white' }}>
                  {selectedCameraDevice.name} {cameraSource === 'webrtc' && `(${webrtcStatus})`}
                </div>
              )}
              <div style={{ position: 'absolute', bottom: '1rem', right: '1rem', display: 'flex', gap: '0.5rem' }}>
                <button style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '0.5rem', padding: '0.5rem', cursor: 'pointer', backdropFilter: 'blur(4px)' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '1.25rem', color: 'white' }}>photo_camera</span>
                </button>
                <button style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '0.5rem', padding: '0.5rem', cursor: 'pointer', backdropFilter: 'blur(4px)' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '1.25rem', color: 'white' }}>fullscreen</span>
                </button>
              </div>
            </div>
            <div style={{ padding: '1rem', background: '#1e293b' }}>
              <p style={{ margin: 0, fontWeight: '600', color: 'white', fontSize: '1rem' }}>
                {cameraSource === 'device' && selectedCameraDevice ? selectedCameraDevice.name : 'Camera giám sát vườn'}
              </p>
              <p style={{ margin: '0.25rem 0 0', fontSize: '0.8125rem', color: '#94a3b8' }}>
                {cameraSource === 'device' ? `Device ID: ${selectedCameraDevice?.deviceId || 'N/A'}` : 'ESP32-CAM / IP Camera'}
              </p>
            </div>
          </div>

          {/* Camera Settings */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Source Selection */}
            <div style={{ background: 'white', borderRadius: '0.75rem', padding: '1.25rem', border: '1px solid #e2e8f0' }}>
              <h4 style={{ margin: '0 0 1rem', fontSize: '0.9375rem', fontWeight: '700', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '1.125rem', color: '#4cbe00' }}>linked_camera</span>
                Nguồn Camera
              </h4>
              
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                <button
                  onClick={() => setCameraSource('webrtc')}
                  style={{
                    flex: 1, padding: '0.625rem', border: 'none', borderRadius: '0.5rem', cursor: 'pointer',
                    background: cameraSource === 'webrtc' ? '#4cbe00' : '#f1f5f9',
                    color: cameraSource === 'webrtc' ? 'white' : '#64748b',
                    fontWeight: '600', fontSize: '0.75rem'
                  }}
                >
                  🎥 WebRTC
                </button>
                <button
                  onClick={() => setCameraSource('device')}
                  style={{
                    flex: 1, padding: '0.625rem', border: 'none', borderRadius: '0.5rem', cursor: 'pointer',
                    background: cameraSource === 'device' ? '#4cbe00' : '#f1f5f9',
                    color: cameraSource === 'device' ? 'white' : '#64748b',
                    fontWeight: '600', fontSize: '0.75rem'
                  }}
                >
                  📡 Base64
                </button>
                <button
                  onClick={() => setCameraSource('url')}
                  style={{
                    flex: 1, padding: '0.625rem', border: 'none', borderRadius: '0.5rem', cursor: 'pointer',
                    background: cameraSource === 'url' ? '#4cbe00' : '#f1f5f9',
                    color: cameraSource === 'url' ? 'white' : '#64748b',
                    fontWeight: '600', fontSize: '0.75rem'
                  }}
                >
                  🔗 URL
                </button>
              </div>

              {cameraSource === 'webrtc' ? (
                <div>
                  <label style={{ fontSize: '0.8125rem', color: '#64748b', display: 'block', marginBottom: '0.375rem', fontWeight: '500' }}>Chọn thiết bị (WebRTC)</label>
                  <select
                    value={selectedCameraDevice?._id || ''}
                    onChange={(e) => {
                      const device = devices.find(d => d._id === e.target.value);
                      setSelectedCameraDevice(device);
                    }}
                    style={{ width: '100%', padding: '0.625rem 0.75rem', border: '1px solid #e2e8f0', borderRadius: '0.5rem', fontSize: '0.875rem', background: 'white' }}
                  >
                    <option value="">-- Chọn thiết bị --</option>
                    {devices.map(device => (
                      <option key={device._id} value={device._id}>
                        {device.name} ({device.deviceId})
                      </option>
                    ))}
                  </select>
                  {selectedCameraDevice && (
                    <div style={{ marginTop: '0.5rem', padding: '0.5rem', background: '#e0f2fe', borderRadius: '0.375rem', fontSize: '0.75rem' }}>
                      <strong>Device ID cho Simulator:</strong> <code style={{ background: '#0f172a', color: '#4cbe00', padding: '0.125rem 0.375rem', borderRadius: '0.25rem', userSelect: 'all' }}>{selectedCameraDevice.deviceId}</code>
                    </div>
                  )}
                  <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.375rem' }}>
                    Mở webrtc.html, nhập Device ID ở trên và nhấn "Start"
                  </p>
                  <div style={{ marginTop: '0.5rem', padding: '0.5rem', background: webrtcStatus === 'connected' ? '#dcfce7' : '#fef3c7', borderRadius: '0.375rem', fontSize: '0.75rem' }}>
                    Status: <strong>{webrtcStatus}</strong>
                  </div>
                </div>
              ) : cameraSource === 'device' ? (
                <div>
                  <label style={{ fontSize: '0.8125rem', color: '#64748b', display: 'block', marginBottom: '0.375rem', fontWeight: '500' }}>Chọn thiết bị</label>
                  <select
                    value={selectedCameraDevice?._id || ''}
                    onChange={(e) => {
                      const device = devices.find(d => d._id === e.target.value);
                      setSelectedCameraDevice(device);
                    }}
                    style={{ width: '100%', padding: '0.625rem 0.75rem', border: '1px solid #e2e8f0', borderRadius: '0.5rem', fontSize: '0.875rem', background: 'white' }}
                  >
                    <option value="">-- Chọn thiết bị --</option>
                    {devices.map(device => (
                      <option key={device._id} value={device._id}>
                        {device.name} ({device.deviceId})
                      </option>
                    ))}
                  </select>
                  <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.375rem' }}>
                    Dùng index.html simulator (chậm hơn WebRTC)
                  </p>
                </div>
              ) : (
                <div>
                  <label style={{ fontSize: '0.8125rem', color: '#64748b', display: 'block', marginBottom: '0.375rem', fontWeight: '500' }}>URL Stream</label>
                  <input
                    type="text"
                    value={cameraUrl}
                    onChange={(e) => handleCameraUrlChange(e.target.value)}
                    placeholder="http://192.168.1.100:81/stream"
                    style={{ width: '100%', padding: '0.625rem 0.75rem', border: '1px solid #e2e8f0', borderRadius: '0.5rem', fontSize: '0.875rem', boxSizing: 'border-box' }}
                  />
                  <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.375rem' }}>Nhập URL từ ESP32-CAM hoặc IP Camera</p>
                </div>
              )}
            </div>

            {/* Instructions */}
            <div style={{ background: 'white', borderRadius: '0.75rem', padding: '1.25rem', border: '1px solid #e2e8f0' }}>
              <h4 style={{ margin: '0 0 0.75rem', fontSize: '0.875rem', fontWeight: '700', color: '#0f172a' }}>
                📖 Hướng dẫn
              </h4>
              {cameraSource === 'device' ? (
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                  <p style={{ margin: '0 0 0.5rem' }}>1. Mở ESP32-CAM Simulator</p>
                  <p style={{ margin: '0 0 0.5rem' }}>2. Nhập Device ID của thiết bị</p>
                  <p style={{ margin: '0 0 0.5rem' }}>3. Bật camera và nhấn "Gửi lên API"</p>
                  <p style={{ margin: 0 }}>4. Chọn thiết bị ở trên để xem</p>
                </div>
              ) : (
                <ul style={{ margin: 0, paddingLeft: '1rem', fontSize: '0.75rem', color: '#64748b' }}>
                  <li style={{ marginBottom: '0.25rem' }}>ESP32-CAM: http://[IP]:81/stream</li>
                  <li style={{ marginBottom: '0.25rem' }}>Simulator: http://localhost:8081</li>
                  <li>RTSP Camera: rtsp://[IP]:554/stream</li>
                </ul>
              )}
            </div>

            {/* Status */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem', background: ((cameraSource === 'url' && cameraUrl) || (cameraSource === 'device' && cameraFrame)) ? '#f0fdf4' : '#fef2f2', borderRadius: '0.5rem', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '1rem', color: ((cameraSource === 'url' && cameraUrl) || (cameraSource === 'device' && cameraFrame)) ? '#22c55e' : '#ef4444' }}>
                  {((cameraSource === 'url' && cameraUrl) || (cameraSource === 'device' && cameraFrame)) ? 'check_circle' : 'error'}
                </span>
                <span style={{ fontSize: '0.8125rem', fontWeight: '600', color: ((cameraSource === 'url' && cameraUrl) || (cameraSource === 'device' && cameraFrame)) ? '#166534' : '#991b1b' }}>
                  {((cameraSource === 'url' && cameraUrl) || (cameraSource === 'device' && cameraFrame)) ? 'Đang nhận tín hiệu' : 'Chưa có tín hiệu'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Info Page
function InfoPage({ user }) {
  return (
    <div>
      <div className="dashboard-header">
        <div className="header-text">
          <h2 className="dashboard-title">Thông tin cá nhân</h2>
          <p className="dashboard-subtitle">Thông tin tài khoản của bạn</p>
        </div>
      </div>

      <div style={{ maxWidth: '600px' }}>
        <div style={{ background: 'white', borderRadius: '0.75rem', padding: '1.5rem', border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem', paddingBottom: '1.5rem', borderBottom: '1px solid #f1f5f9' }}>
            <div style={{ width: '4rem', height: '4rem', borderRadius: '50%', background: 'linear-gradient(135deg, #4cbe00 0%, #22c55e 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', fontWeight: '700', color: 'white' }}>
              {user?.fullName ? user.fullName.charAt(0).toUpperCase() : 'U'}
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '700', color: '#0f172a' }}>{user?.fullName || 'Chưa cập nhật'}</h3>
              <p style={{ margin: '0.25rem 0 0', fontSize: '0.875rem', color: '#64748b' }}>{user?.role === 'manager' ? 'Manager' : 'User'}</p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '1.25rem', color: '#64748b' }}>badge</span>
              <div>
                <p style={{ margin: 0, fontSize: '0.75rem', color: '#94a3b8' }}>ID</p>
                <p style={{ margin: '0.125rem 0 0', fontSize: '0.875rem', fontWeight: '500', color: '#0f172a' }}>{user?._id || 'N/A'}</p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '1.25rem', color: '#64748b' }}>mail</span>
              <div>
                <p style={{ margin: 0, fontSize: '0.75rem', color: '#94a3b8' }}>Email</p>
                <p style={{ margin: '0.125rem 0 0', fontSize: '0.875rem', fontWeight: '500', color: '#0f172a' }}>{user?.email || 'Chưa cập nhật'}</p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '1.25rem', color: '#64748b' }}>phone</span>
              <div>
                <p style={{ margin: 0, fontSize: '0.75rem', color: '#94a3b8' }}>Số điện thoại</p>
                <p style={{ margin: '0.125rem 0 0', fontSize: '0.875rem', fontWeight: '500', color: '#0f172a' }}>{user?.phone || 'Chưa cập nhật'}</p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '1.25rem', color: '#64748b' }}>location_on</span>
              <div>
                <p style={{ margin: 0, fontSize: '0.75rem', color: '#94a3b8' }}>Địa chỉ</p>
                <p style={{ margin: '0.125rem 0 0', fontSize: '0.875rem', fontWeight: '500', color: '#0f172a' }}>{user?.address || 'Chưa cập nhật'}</p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '1.25rem', color: '#64748b' }}>calendar_today</span>
              <div>
                <p style={{ margin: 0, fontSize: '0.75rem', color: '#94a3b8' }}>Ngày đăng ký</p>
                <p style={{ margin: '0.125rem 0 0', fontSize: '0.875rem', fontWeight: '500', color: '#0f172a' }}>{user?.purchaseDate ? new Date(user.purchaseDate).toLocaleDateString('vi-VN') : 'N/A'}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
