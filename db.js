import { DatabaseSync } from 'node:sqlite';

const db = new DatabaseSync('videocallserver.db');

const init = `
    CREATE TABLE IF NOT EXISTS rooms (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY,
        email TEXT NOT NULL,
        guid TEXT NOT NULL,
        room_id INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        FOREIGN KEY(room_id) REFERENCES rooms(id)
    );
`;

db.exec(init);

export default db;