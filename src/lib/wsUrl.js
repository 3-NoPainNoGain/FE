// src/lib/wsUrl.js
export function buildWsUrl(path = "/ws/signaling", hostOverride) {
  if (!path.startsWith("/")) path = `/${path}`;
  const isHttps = window.location.protocol === "https:";
  const wsProto = isHttps ? "wss" : "ws";
  const host = hostOverride || window.location.host;
  return `${wsProto}://${host}${path}`;
}
