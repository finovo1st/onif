import { Platform } from 'react-native';

// Server API Host
export const DEFAULT_API_HOST = 'http://34.180.50.240';
export const API_BASE = `${DEFAULT_API_HOST}/api/v1`;

let authToken = null;

export const setAuthToken = (token) => {
  authToken = token;
};

export const getAuthToken = () => authToken;

export const buildApiUrl = (endpoint) => {
  let path = (endpoint || '').trim();
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  if (!path.startsWith('/')) {
    path = `/${path}`;
  }
  if (path.startsWith('/api/v1/')) {
    path = path.replace('/api/v1', '');
  }
  // Ensure trailing slash for Django REST endpoints if no query string
  if (!path.includes('?') && !path.endsWith('/') && !path.includes('.')) {
    path = `${path}/`;
  }
  return `${API_BASE}${path}`;
};

export const apiCall = async (endpoint, method = 'GET', body = null, isFormData = false) => {
  const url = buildApiUrl(endpoint);
  const headers = {};

  if (!isFormData) {
    headers['Content-Type'] = 'application/json';
  }

  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  const options = {
    method,
    headers,
  };

  if (body) {
    options.body = isFormData ? body : JSON.stringify(body);
  }

  try {
    const response = await fetch(url, options);

    if (response.status === 401) {
      setAuthToken(null);
      throw new Error('Session expired or unauthorized. Please sign in again.');
    }

    if (!response.ok) {
      let errData = {};
      try {
        errData = await response.json();
      } catch (e) {
        const textErr = await response.text().catch(() => '');
        throw new Error(`Server returned HTTP ${response.status} for ${url}: ${textErr.slice(0, 100) || response.statusText}`);
      }
      const msg = parseErrorMessage(errData) || `Server error (${response.status}) at ${url}`;
      throw new Error(msg);
    }

    if (response.status === 204) return null;
    return await response.json();
  } catch (err) {
    console.error(`[Mobile API Error] ${method} ${url}:`, err.message);
    throw err;
  }
};

function parseErrorMessage(errData) {
  if (typeof errData === 'string') return errData;
  if (errData.detail) return errData.detail;
  if (errData.error) return errData.error;
  if (errData.non_field_errors) return errData.non_field_errors.join(' ');
  const keys = Object.keys(errData);
  if (keys.length > 0) {
    const firstVal = errData[keys[0]];
    return `${keys[0]}: ${Array.isArray(firstVal) ? firstVal.join(' ') : firstVal}`;
  }
  return null;
}

