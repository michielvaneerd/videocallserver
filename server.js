import { WebSocketServer } from "ws";
// import {
//     createRoom,
//     createUser,
//     getRoomById,
//     getRoomByName,
//     getUserByEmail,
//     getUserByGuid,
//     getUsersByRoomId
// } from "./db_queries.js";

const roomName = 'test-room';
const users = new Set();

const wss = new WebSocketServer({ port: 3000 });

function sendData(ws, data) {
    ws.send(JSON.stringify(data));
}

wss.on('connection', (ws) => {

    console.log('Client connected');

    if (users.size >= 2) {
        console.log('Room already full, closing client.');
        ws.close(1013, 'full'); // 1013 = try again later...
        return;
    }

    const polite = users.size === 1;
    users.add(ws);
    sendData(ws, { type: 'welcome', polite: polite });
    console.log(`Welcome client ${polite ? 'polite' : 'impolite'}`);

    if (users.size === 2) {
        for (const peer of users) {
            if (peer !== ws && peer.readyState === peer.OPEN) { // TODO: Is dit goed??? peer.OPEN???
                // Now the first caller is told that the other peer is ready, so connection can start (offer etc.)
                sendData(peer, { type: 'ready' });
            }
        }
    }

    ws.on('message', (data, isBinary) => {
        for (const peer of users) {
            if (peer !== ws && peer.readyState === peer.OPEN) { // TODO: Is dit goed??? peer.OPEN???
                peer.send(data, { binary: isBinary });
            }
        }
    });

    ws.on('close', () => {
        users.delete(ws);
        console.log('Client closed');
    });

});

console.log('WebSocketServer running on port 3000...');