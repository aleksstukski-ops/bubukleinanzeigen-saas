import { useState } from "react";
import api from "../lib/api";

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

export function usePushNotifications() {
  const [status, setStatus] = useState(
    "Notification" in window ? Notification.permission : "unsupported"
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const isSupported = "serviceWorker" in navigator && "PushManager" in window;

  const subscribe = async () => {
    setError(null);
    setLoading(true);
    try {
      const { data } = await api.get("/push/vapid-public-key");
      const applicationServerKey = urlBase64ToUint8Array(data.public_key);

      const reg = await navigator.serviceWorker.register("/push-sw.js", { scope: "/" });
      await navigator.serviceWorker.ready;

      const existing = await reg.pushManager.getSubscription();
      if (existing) await existing.unsubscribe();

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      });

      const subJson = sub.toJSON();
      await api.post("/push/subscribe", {
        endpoint: subJson.endpoint,
        p256dh: subJson.keys.p256dh,
        auth: subJson.keys.auth,
      });

      setStatus("granted");
    } catch (err) {
      setError(err?.response?.data?.detail || err?.message || "Fehler beim Aktivieren");
      if (Notification.permission === "denied") setStatus("denied");
    } finally {
      setLoading(false);
    }
  };

  const unsubscribe = async () => {
    setError(null);
    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration("/push-sw.js");
      if (reg) {
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          const subJson = sub.toJSON();
          await api.post("/push/unsubscribe", {
            endpoint: subJson.endpoint,
            p256dh: subJson.keys.p256dh,
            auth: subJson.keys.auth,
          });
          await sub.unsubscribe();
        }
      }
      setStatus("default");
    } catch (err) {
      setError(err?.message || "Fehler beim Deaktivieren");
    } finally {
      setLoading(false);
    }
  };

  return { status, loading, error, isSupported, subscribe, unsubscribe };
}
