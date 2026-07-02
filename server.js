// Minimal static server for OSC My Apps. Must listen on process.env.PORT (8080).
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 8080;
const html = fs.readFileSync(path.join(__dirname, 'index.html'));

http.createServer((req, res) => {
  if (req.url === '/healthz') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    return res.end('ok');
  }
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html);
}).listen(PORT, () => console.log('Asteroid Blaster listening on ' + PORT));
