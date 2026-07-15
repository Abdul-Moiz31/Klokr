// Web Push service worker for klokrs.com. Deliberately separate from the
// Chrome extension's own service worker (extension/background.js) — this one
// belongs to the website and is what lets the browser's push service wake a
// notification even when no klokrs.com tab is open, independent of whether
// the extension is installed at all.

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Klokrs", body: event.data ? event.data.text() : "" };
  }

  const title = data.title || "Klokrs";
  const options = {
    body: data.body || "",
    icon: "/icon.svg",
    tag: data.tag,
    data: { url: data.url || "/dashboard" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data && event.notification.data.url ? event.notification.data.url : "/dashboard";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientsArr) => {
      const existing = clientsArr.find((c) => {
        try {
          return new URL(c.url).pathname === url;
        } catch {
          return false;
        }
      });
      if (existing) return existing.focus();
      return self.clients.openWindow(url);
    })
  );
});
