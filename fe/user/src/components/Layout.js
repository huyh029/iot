import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { useLocation, useNavigate } from 'react-router-dom';
import './Layout.css';

const Layout = ({ children }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const { user, logout } = useAuth();
  const { connected } = useSocket();
  const location = useLocation();
  const navigate = useNavigate();

  const menuItems = [
    { 
      text: 'Bảng điều khiển', 
      icon: 'dashboard', 
      path: '/',
      iconFill: true
    },
    { 
      text: 'Cây trồng', 
      icon: 'potted_plant', 
      path: '/plants',
      iconFill: false
    },
    { 
      text: 'Điều khiển', 
      icon: 'settings', 
      path: '/controls',
      iconFill: false
    },
    { 
      text: 'Xem vườn', 
      icon: 'visibility', 
      path: '/garden',
      iconFill: false
    },
  ];

  const isActive = (path) => {
    if (path === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(path);
  };

  const handleNavigation = (path) => {
    navigate(path);
  };

  return (
    <div className="layout-container">
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
                <p className="brand-subtitle">User View</p>
              </div>
            </div>

            {/* Navigation */}
            <nav className="navigation">
              {menuItems.map((item) => (
                <button
                  key={item.path}
                  className={`nav-item ${isActive(item.path) ? 'nav-item-active' : ''}`}
                  onClick={() => handleNavigation(item.path)}
                >
                  <span className={`material-symbols-outlined ${item.iconFill && isActive(item.path) ? 'icon-fill' : ''}`}>
                    {item.icon}
                  </span>
                  <span className="nav-text">{item.text}</span>
                </button>
              ))}
            </nav>
          </div>

          {/* User Profile at bottom */}
          <div className="user-profile">
            <div 
              className="user-avatar"
              style={{
                backgroundImage: `url("https://lh3.googleusercontent.com/aida-public/AB6AXuCvTrfQ223kjjQTnf_5UyF8mraF5GjVGZ2eKBHeyirAlzyrNcqo7_AwSbvEsq94jDSanZJp9jZYymciMIFOYPtUI92ThsGQyCoNZ4hRI9aZHsSPTc5AF8C4eTTSjl2DdDGpQe2BGacD9uNjqVQVn-jNe2sVyLP4FSiK18XNlTDe3cwxteBAw-N68L2zHGUU7Ds4FD088KnsnkmoUGkP8sAlSDg0Ak06DrIhq762UBq7rup2OKcyFqCkImwUD1Ob4KwP60eb0vKwppuf")`
              }}
            ></div>
            <div className="user-info">
              <p className="user-name">{user?.fullName || user?.username}</p>
              <p className="user-role">User</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        {/* Top Header */}
        <header className="top-header">
          {/* Search */}
          <div className="search-container">
            <span className="material-symbols-outlined search-icon">search</span>
            <input
              className="search-input"
              placeholder="Tìm kiếm thiết bị, khu vực..."
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Right Actions */}
          <div className="header-actions">
            <button className="header-button">
              <span className="material-symbols-outlined">notifications</span>
              <span className="notification-dot"></span>
            </button>
            <button className="header-button">
              <span className="material-symbols-outlined">help</span>
            </button>
            <button className="header-button logout-button" onClick={logout}>
              <span className="material-symbols-outlined">logout</span>
            </button>
          </div>
        </header>

        {/* Page Content */}
        <div className="page-content">
          {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;