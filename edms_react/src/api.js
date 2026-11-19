import axios from 'axios';

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

export default Api;
