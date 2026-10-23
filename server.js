import { WebSocketServer } from "ws";
import { readFileSync } from 'node:fs';
// import {
//     createRoom,
//     createUser,
//     getRoomById,
//     getRoomByName,
//     getUserByEmail,
//     getUserByGuid,
//     getUsersByRoomId
// } from "./db_queries.js";

const pwd = readFileSync('.env', { encoding: 'utf-8' });

// We only have 1 room with 2 users maximum.
const users = new Set();

// Start to listen for connections
const wss = new WebSocketServer({ port: 3000 });

function sendData(ws, data) {
    ws.send(JSON.stringify(data));
}

// Started when the user is authenticated.
function start(ws) {
    if (users.size >= 2) {
        console.log('Room already full, closing client.');
        ws.close(1013, 'full'); // 1013 = try again later...
        return;
    }

    const polite = users.size === 1; // So the second one is the polite one.
    users.add(ws); // Add this socket to the users list
    sendData(ws, { type: 'welcome', polite: polite }); // Send the 'welcome' message
    console.log(`Welcome for the ${polite ? 'polite' : 'impolite'} client`);

    if (users.size === 2) {
        for (const peer of users) {
            if (peer !== ws && peer.readyState === peer.OPEN) {
                // Now the first caller is told that the other peer is ready, so connection can start (offer etc.)
                sendData(peer, { type: 'ready' });
            }
        }
    }
}

wss.on('connection', (ws) => {

    let isAuthenticated = false;

    console.log('Client connected');

    ws.on('message', (data, isBinary) => {

        const obData = JSON.parse(data);

        // The first message we must get is the auth call. Otherwise we won't handle any other message.
        if (!isAuthenticated && obData.type === 'auth' && obData.pwd === pwd) {
            isAuthenticated = true;
            start(ws);
        }
        if (!isAuthenticated) {
            ws.send(JSON.stringify({ type: 'unauth' }));
            return;
        }

        for (const peer of users) {
            if (peer !== ws && peer.readyState === peer.OPEN) {
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