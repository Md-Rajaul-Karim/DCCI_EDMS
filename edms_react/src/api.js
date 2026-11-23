import axios from 'axios';
import { SYSTEM_USERS, DEFAULT_USER } from './constants/systemUsers';

// Automatically detect host (localhost or Office LAN IP like 192.168.x.x)
const apiHost = typeof window !== 'undefined' && window.location.hostname && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1'
  ? window.location.hostname
  : 'localhost';

export const API_BASE_URL = `http://${apiHost}:5162/api`;

const Api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Automatically inject currently selected user persona into every API request header
Api.interceptors.request.use((config) => {
  try {
    const savedId = typeof window !== 'undefined' ? localStorage.getItem('dcci_simulated_user') : null;
    let user = DEFAULT_USER;
    if (savedId) {
      const matched = SYSTEM_USERS.find(u => u.id === savedId || u.role === savedId);
      if (matched) user = matched;
    }
    if (user) {
      config.headers['X-User-Name'] = user.name;
      config.headers['X-User-Role'] = user.role || user.designation;
    }
  } catch (err) {
    console.warn('Failed to inject user headers', err);
  }
  return config;
});

export default Api;
