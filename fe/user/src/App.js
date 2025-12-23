import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SocketProvider } from './contexts/SocketContext';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import PlantManagement from './components/PlantManagement';
import Controls from './components/Controls';
import GardenView from './components/GardenView';
import Layout from './components/Layout';
import './App.css';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        backgroundColor: '#102216',
        color: 'white'
      }}>
        <div style={{
          width: '2rem',
          height: '2rem',
          border: '2px solid #28392e',
          borderTop: '2px solid #4cbe00',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }}></div>
      </div>
    );
  }
  
  if (!user || user.role !== 'user') {
    return <Navigate to="/login" replace />;
  }
  
  return children;
}

function AppRoutes() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route 
        path="/login" 
        element={user ? <Navigate to="/" replace /> : <Login />} 
      />
      <Route path="/" element={
        <ProtectedRoute>
          <Layout>
            <Dashboard />
          </Layout>
        </ProtectedRoute>
      } />
      <Route path="/plants" element={
        <ProtectedRoute>
          <Layout>
            <PlantManagement />
          </Layout>
        </ProtectedRoute>
      } />
      <Route path="/controls" element={
        <ProtectedRoute>
          <Layout>
            <Controls />
          </Layout>
        </ProtectedRoute>
      } />
      <Route path="/garden" element={
        <ProtectedRoute>
          <Layout>
            <GardenView />
          </Layout>
        </ProtectedRoute>
      } />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <Router>
          <AppRoutes />
          <Toaster 
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: '#363636',
                color: '#fff',
                fontFamily: 'Manrope, sans-serif',
                borderRadius: '0.5rem',
              },
              success: {
                style: {
                  background: '#4cbe00',
                  color: '#ffffff',
                },
              },
              error: {
                style: {
                  background: '#dc2626',
                  color: '#fff',
                },
              },
            }}
          />
        </Router>
      </SocketProvider>
    </AuthProvider>
  );
}

export default App;
