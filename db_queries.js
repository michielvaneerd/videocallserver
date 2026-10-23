import db from './db.js';
import { randomUUID } from 'node:crypto';

// Start rooms
const createRoomStatement = db.prepare(`
    INSERT INTO rooms (name, created_at)
    VALUES (?, ?)
    RETURNING *
`);
const createRoom = (name) => createRoomStatement.get(name, Date.now());

const deleteRoomByIdStatement = db.prepare(`
    DELETE FROM rooms WHERE id = ?
`);
const deleteRoomById = (id) => deleteRoomByIdStatement.run(id);

const getRoomByNameStatement = db.prepare(`
    SELECT * FROM rooms WHERE name = ?
`);
const getRoomByName = (name) => getRoomByNameStatement.get(name);

const getRoomByIdStatement = db.prepare(`
    SELECT * FROM rooms WHERE id = ?
`);
const getRoomById = (id) => getRoomByIdStatement.get(id);

// Start users
const createUserStatement = db.prepare(`
    INSERT INTO users (room_id, guid, email, created_at)
    VALUES (?, ?, ?, ?)
`);
const createUser = (roomId, email) => createUserStatement.get(roomId, randomUUID(), email, Date.now());

const deleteUserByIdStatement = db.prepare(`
    DELETE FROM users WHERE room_id = ? AND id = ?
`);
const deleteUserById = (roomId, id) => deleteUserByIdStatement.run(roomId, id);

const getUserByEmailStatement = db.prepare(`
    SELECT * FROM users WHERE room_id = ? AND email = ?
`);
const getUserByEmail = (roomId, email) => getUserByEmailStatement.get(roomId, email);

const getUserByGuidStatement = db.prepare(`
    SELECT * FROM users WHERE room_id = ? AND guid = ?
`);
const getUserByGuid = (roomId, guid) => getUserByGuidStatement.get(roomId, guid);

const getUsersByRoomIdStatement = db.prepare(`
    SELECT * FROM users WHERE room_id = ?
`);
const getUsersByRoomId = (roomId) => getUsersByRoomIdStatement.all(roomId);

export {
    createRoom,
    getRoomById,
    getRoomByName,
    deleteRoomById,
    createUser,
    getUserByEmail,
    getUserByGuid,
    deleteUserById,
    getUsersByRoomId
}