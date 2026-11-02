const http = require('http');
const WebSocket = require('ws');

const PORT = process.env.PORT || 10000;
const UPSTREAM = process.env.UPSTREAM_URL;

if (!UPSTREAM) {
    throw new Error('UPSTREAM_URL is required');
}

const server = http.createServer((req, res) => {
    res.writeHead(200, {
        'Content-Type': 'text/plain'
    });
    res.end('WebSocket proxy is running');
});

const wss = new WebSocket.Server({
    server: server,
    path: '/ws'
});

wss.on('connection', (client) => {
    console.log('Client connected');

    const upstream = new WebSocket(UPSTREAM);
    let closed = false;

    function shutdown(code, reason) {
        if (closed) return;
        closed = true;

        if (client.readyState === WebSocket.OPEN) {
            client.close(code, reason);
        }

        if (upstream.readyState === WebSocket.OPEN) {
            upstream.close(code, reason);
        } else if (upstream.readyState === WebSocket.CONNECTING) {
            upstream.terminate();
        }
    }

    upstream.on('open', () => {
        console.log('Connected to upstream');
    });

    client.on('message', (data, binary) => {
        if (upstream.readyState === WebSocket.OPEN) {
            upstream.send(data, { binary: binary });
        }
    });

    upstream.on('message', (data, binary) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(data, { binary: binary });
        }
    });

    client.on('close', () => {
        shutdown(1000, 'Client disconnected');
    });

    upstream.on('close', (code, reason) => {
        shutdown(code, reason);
    });

    client.on('error', (err) => {
        console.error('Client error:', err.message);
        shutdown(1011, 'Client error');
    });

    upstream.on('error', (err) => {
        console.error('Upstream error:', err.message);
        shutdown(1011, 'Upstream error');
    });
});

server.listen(PORT, '0.0.0.0', () => {
    console.log('Listening on port ' + PORT);
});
