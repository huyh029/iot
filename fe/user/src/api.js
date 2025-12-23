// API Helper with base URL
import config from './config';

const API_BASE = config.API_BASE_URL;

export const api = {
  get: async (endpoint, options = {}) => {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        ...options.headers
      }
    });
    return response;
  },
  
  post: async (endpoint, data, options = {}) => {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        ...options.headers
      },
      body: JSON.stringify(data),
      ...options
    });
    return response;
  }
};

export default api;
