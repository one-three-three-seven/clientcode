import type { SlotRecord } from './types.js'
import { ClientCodeMap } from './clientcodes.js'
import pg from 'pg'

const TABLE_NAME = 'slots'

const db = new pg.Pool({
    user: 'sonic',
    host: 'localhost',
    database: 'graffiti',
    password: 'AixkzLRfhQVYhKY',
    port: 5432
})

export async function createTable() {
    const createTableSQL = `CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
                            slot INTEGER PRIMARY KEY,
                            date DATE NOT NULL,
                            graffiti TEXT,
                            prysm BOOLEAN NOT NULL,
                            lighthouse BOOLEAN NOT NULL,
                            teku BOOLEAN NOT NULL,
                            nimbus BOOLEAN NOT NULL,
                            lodestar BOOLEAN NOT NULL,
                            grandine BOOLEAN NOT NULL,
                            nethermind BOOLEAN NOT NULL,
                            geth BOOLEAN NOT NULL,
                            besu BOOLEAN NOT NULL,
                            erigon BOOLEAN NOT NULL,
                            reth BOOLEAN NOT NULL,
                            rocketpool BOOLEAN NOT NULL
                            );`

    const createIndexSQL = `CREATE INDEX IF NOT EXISTS idx_${TABLE_NAME}_date ON ${TABLE_NAME} (date);`

    try {
        await db.query(createTableSQL)
        await db.query(createIndexSQL)
    } catch (error) {
        throw `Error creating table ${TABLE_NAME} or index on 'date' column: ${error.message}`
    }

    console.log(`Table '${TABLE_NAME}' is ready.`)
}

export async function insertIntoDatabase(record: SlotRecord) {
    const columns = ['slot', 'date', 'graffiti', 'rocketpool', ...Object.values(ClientCodeMap)]
    const values = [record.slot, record.date.toISOString(), record.graffiti, record.rocketPool, ...Object.values(ClientCodeMap).map(client => record.clients.includes(client))]
    const placeholders = values.map((_, index) => `$${index + 1}`)

    const insertSQL = `INSERT INTO ${TABLE_NAME} (${columns.join(', ')}) VALUES (${placeholders.join(', ')});`

    try {
        await db.query(insertSQL, values)
    } catch (error) {
        throw `Error inserting slot ${record.slot}: ${error.message}`
    }
}

export async function getLastSlotDatabase(): Promise<number> {
    const maxSlotSQL = `SELECT MAX(slot) as max_slot FROM ${TABLE_NAME};`

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
            date,
            MIN(slot) AS slot_first,
            MAX(slot) AS slot_last,
            COUNT(*) AS slot_count,
            AVG(prysm::int) AS prysm,
            AVG(lighthouse::int) AS lighthouse,
            AVG(teku::int) AS teku,
            AVG(nimbus::int) AS nimbus,
            AVG(lodestar::int) AS lodestar,
            AVG(grandine::int) AS grandine,
            AVG(nethermind::int) AS nethermind,
            AVG(geth::int) AS geth,
            AVG(besu::int) AS besu,
            AVG(erigon::int) AS erigon,
            AVG(reth::int) AS reth
        FROM
            slots
		WHERE
			    date < CURRENT_DATE
            AND
                date >= CURRENT_DATE - INTERVAL '90' DAY
        GROUP BY
            date
        ORDER BY
            date;
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