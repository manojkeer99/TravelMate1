self.addEventListener("push", (event) => {
  let payload = { title: "TravelMate safety alert", body: "Open TravelMate to view your group status.", tag: "travelmate-safety", url: "/" };
  try {
    payload = { ...payload, ...(event.data ? event.data.json() : {}) };
  } catch {
    // Use the safe default payload when a provider sends malformed data.
  }
  event.waitUntil(self.registration.showNotification(payload.title, {
    body: payload.body,
    tag: payload.tag,
    data: { url: payload.url || "/" },
    icon: "/icon.svg",
    badge: "/icon.svg",
    vibrate: [180, 90, 180, 90, 220],
    requireInteraction: payload.tag?.includes("sos") || false,
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = event.notification.data?.url || "/";
  event.waitUntil(clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
    const existing = windows.find((windowClient) => "focus" in windowClient);
    return existing ? existing.focus() : clients.openWindow(target);
  }));
});
