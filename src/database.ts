import type { Slot } from './types.js'
import pg from 'pg'

const SLOTS_TABLE_NAME = 'slots'
const SLOT_CLIENTS_TABLE_NAME = 'slot_clients'
const CLIENTS_TABLE_NAME = 'clients'

const db = new pg.Pool({
    user: 'sonic',
    host: 'localhost',
    database: 'graffiti',
    password: 'AixkzLRfhQVYhKY',
    port: 5432
})

export async function createTable() {
    const createSlotsTableSQL = `CREATE TABLE IF NOT EXISTS ${SLOTS_TABLE_NAME} (
                                 index INTEGER PRIMARY KEY,
                                 date DATE NOT NULL,
                                 validator_index INTEGER,
                                 graffiti TEXT
                                 );`

    const createSlotClientsTableSQL = `CREATE TABLE IF NOT EXISTS ${SLOT_CLIENTS_TABLE_NAME} (
                                       slot_index INTEGER NOT NULL REFERENCES slots(index),
                                       client TEXT NOT NULL,
                                       version TEXT
                                       );`

    const createClientsTableSQL = `CREATE TABLE IF NOT EXISTS ${CLIENTS_TABLE_NAME} (
    name TEXT NOT NULL,
    hash TEXT NOT NULL,
    version TEXT NOT NULL
    );`

    const createUniqueIndexClientsTableSQL = `CREATE UNIQUE INDEX IF NOT EXISTS unique_name_hash ON ${CLIENTS_TABLE_NAME} (name, hash);`

    try {
        await db.query(createSlotsTableSQL)
        await db.query(createSlotClientsTableSQL)
        await db.query(createClientsTableSQL)
        await db.query(createUniqueIndexClientsTableSQL)
    } catch (error) {
        throw `Error creating table ${SLOTS_TABLE_NAME}: ${error.message}`
    }

    console.log(`Table '${SLOTS_TABLE_NAME}' is ready.`)
    console.log(`Table '${SLOT_CLIENTS_TABLE_NAME}' is ready.`)
}

export async function insertIntoDatabase(slot: Slot) {
    const insertSlotSQL = `INSERT INTO ${SLOTS_TABLE_NAME} (index, date, validator_index, graffiti) VALUES ($1, $2, $3, $4);`

    const slotValues = [
        slot.index,
        slot.date.toISOString(),
        slot.validatorIndex,
        slot.graffiti
    ]

    try {
        await db.query(insertSlotSQL, slotValues)
    } catch (error) {
        throw `Error inserting slot ${slot.index}: ${error.message}`
    }

    slot.clients.forEach(async client => {
        const insertSlotClientsSQL = `INSERT INTO ${SLOT_CLIENTS_TABLE_NAME} (slot_index, name, version) VALUES ($1, $2, $3);`

        const slotClientsValues = [
            slot.index,
            client.name,
            client.version
        ]

        try {
            await db.query(insertSlotClientsSQL, slotClientsValues)
        } catch (error) {
            throw `Error inserting clients ${slot.index}: ${error.message}`
        }
    })
}

export async function insertClient(name: string, hash: string, version: string) {
    const insertClientSQL = `INSERT INTO ${CLIENTS_TABLE_NAME} (name, hash, version) VALUES ($1, $2, $3) ON CONFLICT (name, hash) DO UPDATE SET version = EXCLUDED.version;`

    const clientValues = [
        name,
        hash,
        version
    ]

    try {
        db.query(insertClientSQL, clientValues)
    } catch (error) {
        throw `Error inserting client: ${error.message}`
    }
}

export async function getLastSlotDatabase(): Promise<number> {
    const maxSlotSQL = `SELECT MAX(index) as max_slot FROM ${SLOTS_TABLE_NAME};`

    try {
        const result = await db.query(maxSlotSQL)
        const maxSlot = result.rows[0].max_slot !== null ? result.rows[0].max_slot : -1
        return maxSlot
    } catch (error) {
        throw `Error querying last slot: ${error.message}`
    }
}

export function getAggregatedSlotsData() {
    const sql = `
SELECT
    sub.date,
    json_agg(json_build_object('name', sub.name, 'count', sub.cnt)) AS clients
FROM (
    SELECT
        s.date,
        sc.name,
        COUNT(*) AS cnt
    FROM slots s
    JOIN slot_clients sc ON s.index = sc.slot_index
    WHERE s.date < CURRENT_DATE
      AND s.date >= CURRENT_DATE - INTERVAL '90' DAY
    GROUP BY s.date, sc.name
) sub
GROUP BY sub.date
ORDER BY sub.date;
    `

    return db.query(sql)
}

export async function closeDatabase() {
    if (db) {
        try {
            await db.end()
        } catch (error) {
            throw `Error closing the database: ${error.message}`
        }
        console.log('Database connection closed.')
    }
}

export function isDatabaseBusy() {
    const total = db.totalCount
    const idle = db.idleCount
    const waiting = db.waitingCount

    //console.log(`Database Connections Total: ${total} Idle: ${idle}, Waiting: ${waiting}`)

    return total !== idle || waiting > 0
}

/*
SELECT
    sc.name,
    c.version,
    COUNT(*) AS count
FROM slots s
JOIN slot_clients sc ON s.index = sc.slot_index
LEFT JOIN clients c ON c.hash LIKE sc.version || '%' AND c.name = sc.name
WHERE s.date >= NOW() - INTERVAL '24 HOURS'
GROUP BY sc.name, c.version
ORDER BY count DESC;
*/
