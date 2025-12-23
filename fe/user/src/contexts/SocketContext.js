import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';
import toast from 'react-hot-toast';

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
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      const newSocket = io('https://beiot.onrender.com', {
        auth: {
          token: localStorage.getItem('token')
        }
      });

      newSocket.on('connect', () => {
        console.log('Connected to WebSocket');
        setConnected(true);
        newSocket.emit('join-user-room', user._id);
      });

      newSocket.on('disconnect', () => {
        console.log('Disconnected from WebSocket');
        setConnected(false);
      });

      // Listen for real-time notifications
      newSocket.on('notification', (notification) => {
        toast(notification.message, {
          icon: notification.type === 'success' ? '✅' : 
                notification.type === 'warning' ? '⚠️' : 
                notification.type === 'error' ? '❌' : 'ℹ️'
        });
      });

      // Listen for sensor data updates
      newSocket.on('sensor-data', (data) => {
        console.log('Received sensor data:', data);
      });

      // Listen for device status updates
      newSocket.on('device-status', (data) => {
        console.log('Device status update:', data);
      });

      // Listen for control updates
      newSocket.on('control-update', (data) => {
        console.log('Control update:', data);
      });

      setSocket(newSocket);

      return () => {
        newSocket.close();
      };
    }
  }, [user]);

  const joinDeviceRoom = (deviceId) => {
    if (socket) {
      socket.emit('join-device-room', deviceId);
    }
  };

  const sendControlCommand = (deviceId, controlType, action, settings) => {
    if (socket) {
      socket.emit('device-control', {
        deviceId,
        controlType,
        action,
        settings
      });
    }
  };

  const value = {
    socket,
    connected,
    joinDeviceRoom,
    sendControlCommand
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};