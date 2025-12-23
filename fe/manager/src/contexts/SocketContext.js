import React, { createContext, useContext, useEffect, useState } from 'react';
import io from 'socket.io-client';
import toast from 'react-hot-toast';
import { useAuth } from './AuthContext';

const SocketContext = createContext();

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      // Initialize socket connection
      const newSocket = io('https://beiot.onrender.com', {
        transports: ['websocket'],
        upgrade: false
      });

      newSocket.on('connect', () => {
        console.log('Connected to server');
        setConnected(true);
        
        // Join user room for notifications
        newSocket.emit('join-user-room', user.id);
        
        toast.success('Connected to real-time updates');
      });

      newSocket.on('disconnect', () => {
        console.log('Disconnected from server');
        setConnected(false);
        toast.error('Disconnected from real-time updates');
      });

      // Handle notifications
      newSocket.on('notification', (notification) => {
        console.log('Received notification:', notification);
        
        setNotifications(prev => [notification, ...prev.slice(0, 49)]); // Keep last 50
        
        // Show toast notification
        switch (notification.severity) {
          case 'success':
            toast.success(notification.message);
            break;
          case 'error':
            toast.error(notification.message);
            break;
          case 'warning':
            toast(notification.message, { icon: '⚠️' });
            break;
          default:
            toast(notification.message);
        }
      });

      // Handle sensor data updates
      newSocket.on('sensor-data', (data) => {
        console.log('Sensor data received:', data);
        // This will be handled by specific components
      });

      // Handle device status updates
      newSocket.on('device-status', (data) => {
        console.log('Device status update:', data);
        // This will be handled by specific components
      });

      // Handle control updates
      newSocket.on('control-update', (data) => {
        console.log('Control update received:', data);
        // This will be handled by specific components
      });

      // Handle plant updates
      newSocket.on('plant-update', (data) => {
        console.log('Plant update received:', data);
        // This will be handled by specific components
      });

      // Handle weather updates
      newSocket.on('weather-update', (data) => {
        console.log('Weather update received:', data);
        // This will be handled by specific components
      });

      setSocket(newSocket);

      return () => {
        newSocket.close();
      };
    }
  }, [user]);

  // Join device room for real-time device data
  const joinDeviceRoom = (deviceId) => {
    if (socket && connected) {
      socket.emit('join-device-room', deviceId);
    }
  };

  // Leave device room
  const leaveDeviceRoom = (deviceId) => {
    if (socket && connected) {
      socket.emit('leave-device-room', deviceId);
    }
  };

  // Send device control command
  const sendDeviceControl = (deviceId, controlType, action, settings) => {
    if (socket && connected) {
      socket.emit('device-control', {
        deviceId,
        controlType,
        action,
        settings
      });
    }
  };

  // Clear notifications
  const clearNotifications = () => {
    setNotifications([]);
  };

  // Mark notification as read
  const markNotificationRead = (index) => {
    setNotifications(prev => 
      prev.map((notif, i) => 
        i === index ? { ...notif, read: true } : notif
      )
    );
  };

  const value = {
    socket,
    connected,
    notifications,
    joinDeviceRoom,
    leaveDeviceRoom,
    sendDeviceControl,
    clearNotifications,
    markNotificationRead
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};