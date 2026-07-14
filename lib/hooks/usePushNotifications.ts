"use client";

import { useCallback, useEffect, useState } from "react";
import { getAuthSession } from "@/lib/services/userPreferences";

export type PushState = "unsupported" | "default" | "denied" | "subscribed" | "not-subscribed";

function urlBase64ToUint8Array(base64String: string): BufferSource {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(rawData.length));
  for (let i = 0; i < rawData.length; i++) bytes[i] = rawData.charCodeAt(i);
  return bytes;
}

/**
 * Manages the browser's Web Push subscription for the current user — the
 * mechanism that lets a notification reach them even with no klokrs.com tab
 * open (unlike the in-app bell, which only shows what's already loaded, and
 * the extension's chrome.notifications, which needs the browser running).
 * Registers public/push-sw.js as the receiving service worker.
 */
export function usePushNotifications() {
  const [state, setState] = useState<PushState>("unsupported");
  const [loading, setLoading] = useState(false);

  const refreshState = useCallback(async () => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      setState("unsupported");
      return;
    }
    if (Notification.permission === "denied") {
      setState("denied");
      return;
    }
    try {
      const reg = await navigator.serviceWorker.getRegistration("/push-sw.js");
      const sub = reg ? await reg.pushManager.getSubscription() : null;
      setState(sub ? "subscribed" : "not-subscribed");
    } catch {
      setState("not-subscribed");
    }
  }, []);

  useEffect(() => { void refreshState(); }, [refreshState]);

  const subscribe = useCallback(async (): Promise<boolean> => {
    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidKey || typeof window === "undefined" || !("serviceWorker" in navigator)) return false;

    setLoading(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState("denied");
        return false;
      }

      const reg = await navigator.serviceWorker.register("/push-sw.js");
      await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });

      const { accessToken } = await getAuthSession();
      if (!accessToken) return false;

      const json = sub.toJSON();
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
      });
      if (!res.ok) return false;

      setState("subscribed");
      return true;
    } catch {
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const unsubscribe = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration("/push-sw.js");
      const sub = reg ? await reg.pushManager.getSubscription() : null;
      if (sub) {
        const endpoint = sub.endpoint;
        await sub.unsubscribe();
        const { accessToken } = await getAuthSession();
        if (accessToken) {
          await fetch("/api/push/unsubscribe", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
            body: JSON.stringify({ endpoint }),
          });
        }
      }
      setState("not-subscribed");
    } finally {
      setLoading(false);
    }
  }, []);

  return { state, loading, subscribe, unsubscribe, refreshState };
}
