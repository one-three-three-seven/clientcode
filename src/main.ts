import { closeDatabase, createTable, getLastSlotDatabase, insertIntoDatabase, isDatabaseBusy } from './database.js'
import { fetchBlockData, getLastFinalizedSlotBlockchain } from './client.js'
import { isDateInLastHour, sleep } from './helper.js'
import { detectClients } from './detection.js'
import { EventEmitter } from 'node:events'
import { listenAPI } from './api.js'

const taskEventEmitter = new EventEmitter()
const CONCURRENCY = 100
let exitSignalReceived = false
let activeTaskCount = 0

function waitForAvailableConcurrency() {
    if (activeTaskCount < CONCURRENCY) {
        return Promise.resolve()
    }

    return new Promise<void>(resolve => {
        const onTaskCompletion = () => {
            if (activeTaskCount < CONCURRENCY) {
                taskEventEmitter.removeListener('taskCompleted', onTaskCompletion)
                resolve()
            }
        }
        taskEventEmitter.on('taskCompleted', onTaskCompletion)
    })
}

async function main() {
    await createTable()
    listenAPI()

    while (true) {
        if (exitSignalReceived) {
            break
        }

        const lastSlotDatabase = await getLastSlotDatabase()
        const endSlot = await getLastFinalizedSlotBlockchain()
        let startSlot = lastSlotDatabase + 1

        // if (startSlot < 8953199) {
        //     startSlot = 8953199 // First slot of 2024-04-28 UTC
        // }

        if (startSlot > endSlot) {
            console.log(`Waiting for next finalized epoch...`)
            await sleep(60000)
            continue
        }

        console.log(`Fetching blocks from ${startSlot} to ${endSlot} `)

        for (let slot = startSlot; slot <= endSlot; slot++) {
            if (exitSignalReceived) {
                break
            }

            await waitForAvailableConcurrency()
            activeTaskCount++
            processSlot(slot)
        }

        while (true) {
            await sleep(1000)
            if (activeTaskCount > 0 || isDatabaseBusy()) {
                console.log(`Finishing active tasks...`)
                continue
            }
            break
        }
    }
}

async function processSlot(slot: number) {
    const blockData = await fetchBlockData(slot)
    const slotRecord = detectClients(blockData)
    await insertIntoDatabase(slotRecord)

    // Print logs every 1000th slot or every slot if we are near the chain head
    if (slot % 1000 === 0 || isDateInLastHour(slotRecord.date)) {
        console.log(JSON.stringify(slotRecord))
    }

    activeTaskCount--
    taskEventEmitter.emit('taskCompleted', activeTaskCount)
}

async function handleExitSignal(signal: string) {
    console.log(`Received ${signal}.`)
    exitSignalReceived = true

    while (true) {
        if (activeTaskCount > 0 || isDatabaseBusy()) {
            console.log(`Finishing active tasks...`)
            await sleep(1000)
            continue
        }

        await closeDatabase()
        process.exit()
    }
}

process.on('SIGTERM', () => handleExitSignal('SIGTERM'))
process.on('SIGINT', () => handleExitSignal('SIGINT'))

main()

/* SELECT
  ARRAY_REMOVE(ARRAY[
    CASE WHEN lighthouse THEN 'lighthouse' END,
    CASE WHEN teku THEN 'teku' END,
    CASE WHEN nimbus THEN 'nimbus' END,
    CASE WHEN lodestar THEN 'lodestar' END,
    CASE WHEN grandine THEN 'grandine' END,
    CASE WHEN nethermind THEN 'nethermind' END,
    CASE WHEN geth THEN 'geth' END,
    CASE WHEN besu THEN 'besu' END,
    CASE WHEN erigon THEN 'erigon' END,
    CASE WHEN reth THEN 'reth' END
  ], NULL) AS combos,
  COUNT(*) AS quantity
FROM
  slots
WHERE
  (lighthouse::int + teku::int + nimbus::int + lodestar::int + grandine::int +
   nethermind::int + geth::int + besu::int + erigon::int + reth::int) = 2
GROUP BY
  combos
ORDER BY
  quantity DESC; */