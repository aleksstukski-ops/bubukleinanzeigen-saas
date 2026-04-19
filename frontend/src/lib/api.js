import axios from "axios";

const ACCESS_TOKEN_KEY = "bk_access_token";
const REFRESH_TOKEN_KEY = "bk_refresh_token";

let isRefreshing = false;
let refreshPromise = null;
const retryQueue = [];

function getBaseURL() {
  const envBase = import.meta.env.VITE_API_BASE_URL;
  if (envBase) return envBase;
  return "/api";
}

function getAccessToken() {
  return localStorage.getItem(ACCESS_TOKEN_KEY) || "";
}

function getRefreshToken() {
  return localStorage.getItem(REFRESH_TOKEN_KEY) || "";
}

function setAccessToken(token) {
  if (!token) {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    return;
  }
  localStorage.setItem(ACCESS_TOKEN_KEY, token);
}

function setRefreshToken(token) {
  if (!token) {
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    return;
  }
  localStorage.setItem(REFRESH_TOKEN_KEY, token);
}

function clearTokens() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

function flushRetryQueue(error, token) {
  while (retryQueue.length > 0) {
    const item = retryQueue.shift();
    if (!item) continue;
    if (error) item.reject(error);
    else item.resolve(token);
  }
}

export function storeTokenPair(tokens) {
  setAccessToken(tokens?.access_token || "");
  setRefreshToken(tokens?.refresh_token || "");
}

export function readTokenPair() {
  return {
    access_token: getAccessToken(),
    refresh_token: getRefreshToken(),
  };
}

export function removeTokenPair() {
  clearTokens();
}

const api = axios.create({
  baseURL: getBaseURL(),
  timeout: 20000,
});

api.interceptors.request.use((config) => {
  const nextConfig = { ...config };
  const accessToken = getAccessToken();
  if (accessToken) {
    nextConfig.headers = nextConfig.headers || {};
    nextConfig.headers.Authorization = `Bearer ${accessToken}`;
  }
  return nextConfig;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error?.config;
    const responseStatus = error?.response?.status;

    if (!originalRequest || responseStatus !== 401 || originalRequest._retry) {
      return Promise.reject(error);
    }

    const refreshToken = getRefreshToken();
    if (!refreshToken) {
      clearTokens();
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    if (isRefreshing && refreshPromise) {
      return new Promise((resolve, reject) => {
        retryQueue.push({
          resolve: (token) => {
            originalRequest.headers = originalRequest.headers || {};
            originalRequest.headers.Authorization = `Bearer ${token}`;
            resolve(api(originalRequest));
          },
          reject,
        });
      });
    }

    isRefreshing = true;
    refreshPromise = axios.post(`${getBaseURL()}/auth/refresh`, {
      refresh_token: refreshToken,
    });

    try {
      const refreshResponse = await refreshPromise;
      const nextTokens = refreshResponse.data || {};
      storeTokenPair(nextTokens);
      flushRetryQueue(null, nextTokens.access_token);

      originalRequest.headers = originalRequest.headers || {};
      originalRequest.headers.Authorization = `Bearer ${nextTokens.access_token}`;
      return api(originalRequest);
    } catch (refreshError) {
      clearTokens();
      flushRetryQueue(refreshError, null);
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  }
);

export default api;
