import axios from 'axios';
import { API_BASE_URL } from './config';

export { API_BASE_URL };

export function getAuthHeaders() {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function apiGet(endpoint, params = {}) {
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}/api${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
  const response = await axios.get(url, {
    headers: getAuthHeaders(),
    params
  });
  return response.data;
}

export async function apiPost(endpoint, body = {}) {
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}/api${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
  const response = await axios.post(url, body, {
    headers: getAuthHeaders()
  });
  return response.data;
}

export async function apiPatch(endpoint, body = {}) {
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}/api${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
  const response = await axios.patch(url, body, {
    headers: getAuthHeaders()
  });
  return response.data;
}

export async function apiPut(endpoint, body = {}) {
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}/api${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
  const response = await axios.put(url, body, {
    headers: getAuthHeaders()
  });
  return response.data;
}

export async function apiDelete(endpoint) {
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}/api${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
  const response = await axios.delete(url, {
    headers: getAuthHeaders()
  });
  return response.data;
}
