const http = require('http');
http.createServer((req, res) => {
    res.writeHead(200, {'Content-Type': 'text/html'});
    res.end('<body style="background:#0a0a0a;color:#0f0;font-family:monospace;text-align:center;padding-top:20vh;"><h1>Warm Pool Node.js Works!</h1></body>');
}).listen(8000);
