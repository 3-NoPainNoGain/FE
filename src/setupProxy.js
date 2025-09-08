// src/setupProxy.js
const { createProxyMiddleware } = require("http-proxy-middleware");

module.exports = function (app) {
  // Spring(혹은 메인) 백엔드 REST: https://handdoc.store/api/...
  app.use(
    "/api",
    createProxyMiddleware({
      target: "https://handdoc.store",
      changeOrigin: true,
      secure: true,     // cert는 정상 도메인이라 true 유지
      ws: false,
      logLevel: "debug",
    })
  );

  // FastAPI (REST + WebSocket): https://handdoc.store/fastapi/...
  // WebSocket 업그레이드가 필요하므로 ws:true
  app.use(
    "/fastapi",
    createProxyMiddleware({
      target: "https://handdoc.store",
      changeOrigin: true,
      secure: true,
      ws: true,
      logLevel: "debug",
    })
  );
};
