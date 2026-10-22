import { WebSocketServer } from "ws";

const wss = new WebSocketServer({ port: 3000 });

wss.on('connection', (ws) => {
    console.log('Client connected');

    ws.on('message', (data) => {
        const message = data.toString();
        console.log(`Received: ${message}`);
        ws.send(`I have received: ${message}`);
    });

    ws.on('close', () => {
        console.log('Client closed');
    });
});

console.log('WebSocketServer running on port 3000...');