const express = require('express');
const path = require('path');
const app = express();
const PORT = 3000;

// Serve static files from dist
app.use(express.static(path.join(__dirname, 'dist'), {
  maxAge: '1d',
  etag: true,
}));

// API proxy
const { createProxyMiddleware } = require('http-proxy-middleware');

app.use('/api', createProxyMiddleware({
  target: 'http://localhost:8001',
  changeOrigin: true,
}));

app.use('/ws', createProxyMiddleware({
  target: 'ws://localhost:8001',
  ws: true,
  changeOrigin: true,
}));

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Production server running on http://0.0.0.0:${PORT}`);
});
