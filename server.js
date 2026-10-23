import { WebSocketServer } from "ws";
import {
    createRoom,
    createUser,
    getRoomById,
    getRoomByName,
    getUserByEmail,
    getUserByGuid,
    getUsersByRoomId
} from "./db_queries.js";

const roomName = 'test-room';

let room = getRoomByName(roomName);
if (!room) {
    room = createRoom(roomName);
}
console.log(room);

let users = getUsersByRoomId(room.id);
if (users.length === 0) {
    const user = createUser(room.id, 'test@gmail.com');
    users = getUsersByRoomId(room.id);
}

console.log(users);

// try {
//     const user = createUser(12, randomUUID(), 'test+1@gmail.com');
// } catch (ex) {
//     console.log('NEE');
// }


// const wss = new WebSocketServer({ port: 3000 });

// wss.on('connection', (ws) => {
//     console.log('Client connected');

//     ws.on('message', (data) => {
//         const message = data.toString();
//         console.log(`Received: ${message}`);
//         ws.send(`I have received: ${message}`);
//     });

//     ws.on('close', () => {
//         console.log('Client closed');
//     });
// });

// console.log('WebSocketServer running on port 3000...');