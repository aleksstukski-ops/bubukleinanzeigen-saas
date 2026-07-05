import { readTokenPair } from "./api";

// Singleton SSE connection to /api/events/stream.
// Components subscribe with subscribeEvents(fn); the connection opens on the
// first subscriber and closes when the last one unsubscribes. Reconnects with
// a fixed 5s backoff (the server also sends `retry: 5000`).

let source = null;
let reconnectTimer = null;
const listeners = new Set();

function getBaseURL() {
  const envBase = import.meta.env.VITE_API_BASE_URL;
  if (envBase) return envBase;
  return "/api";
}

function connect() {
  if (source || listeners.size === 0) return;
  const { access_token: accessToken } = readTokenPair();
  if (!accessToken) {
    scheduleReconnect();
    return;
  }
  const url = `${getBaseURL()}/events/stream?token=${encodeURIComponent(accessToken)}`;
  try {
    source = new EventSource(url);
  } catch (error) {
    scheduleReconnect();
    return;
  }
  source.onmessage = (event) => {
    let parsed = null;
    try {
      parsed = JSON.parse(event.data);
    } catch (error) {
      return;
    }
    listeners.forEach((fn) => {
      try {
        fn(parsed);
      } catch (error) {
        // one bad listener must not break the others
      }
    });
  };
  source.onerror = () => {
    // Browser retries transparently for network blips; a closed stream
    // (e.g. expired token -> 401) needs a fresh connect with a new token.
    if (source && source.readyState === EventSource.CLOSED) {
      source = null;
      scheduleReconnect();
    }
  };
}

function scheduleReconnect() {
  if (reconnectTimer || listeners.size === 0) return;
  reconnectTimer = window.setTimeout(() => {
    reconnectTimer = null;
    connect();
  }, 5000);
}

function disconnect() {
  if (reconnectTimer) {
    window.clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (source) {
    source.close();
    source = null;
  }
}

// Subscribe to realtime events. Returns an unsubscribe function.
// Event shape: { type: "conversations.updated" | "conversation.updated" |
//                       "listing.created" | ..., data: {...}, at: ISO string }
export function subscribeEvents(fn) {
  listeners.add(fn);
  connect();
  return () => {
    listeners.delete(fn);
    if (listeners.size === 0) disconnect();
  };
}
