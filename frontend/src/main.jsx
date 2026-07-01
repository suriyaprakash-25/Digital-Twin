import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import axios from 'axios'
import './index.css'
import 'leaflet/dist/leaflet.css'
import App from './App.jsx'
import { API_BASE_URL } from './utils/config'

// Set up Axios interceptor for dynamic deployment API URL mapping
axios.interceptors.request.use((config) => {
  if (config.url && config.url.startsWith(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}`)) {
    config.url = config.url.replace(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}`, API_BASE_URL);
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
