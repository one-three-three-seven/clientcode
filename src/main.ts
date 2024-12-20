import { closeDatabase, createTable, getLastSlotDatabase, insertClient, insertIntoDatabase, isDatabaseBusy } from './database.js'
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
    refreshClients()

    while (true) {
        if (exitSignalReceived) {
            break
        }

        const lastSlotDatabase = await getLastSlotDatabase()
        const endSlot = await getLastFinalizedSlotBlockchain()
        let startSlot = lastSlotDatabase + 1

        if (startSlot < 8953199) {
            startSlot = 8953199 // First slot of 2024-04-28 UTC
        }

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
    const rawBlock = await fetchBlockData(slot)
    const slotRecord = detectClients(rawBlock)
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


async function refreshClients() {

    const repositories = new Map([
        ['Besu', 'hyperledger/besu'],
        ['Erigon', 'erigontech/erigon'],
        ['Geth', 'ethereum/go-ethereum'],
        ['Nethermind', 'NethermindEth/nethermind'],
        ['Reth', 'paradigmxyz/reth'],
        ['Grandine', 'grandinetech/grandine'],
        ['Lighthouse', 'sigp/lighthouse'],
        ['Lodestar', 'ChainSafe/lodestar'],
        ['Nimbus', 'status-im/nimbus-eth2'],
        ['Teku', 'Consensys/teku'],
        ['Prysm', 'prysmaticlabs/prysm']
    ])

    // Iterating over the Map
    for (const [client, repo] of repositories) {
        try {
            const response = await fetch(`https://api.github.com/repos/${repo}/tags`)
            if (!response.ok) {
                throw `Failed to fetch client tags for ${client}. Status: ${response.status}`
            }

            const tags = await response.json()

            tags.forEach(tag => {
                insertClient(client, tag.commit.sha, tag.name)
            })

        } catch (error) {
            throw `Error fetching client tags for ${client}: ${error.message}`
        }
    }
}
