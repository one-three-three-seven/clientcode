import type { BlockData } from "./types.js"

const API_HOST = 'http://localhost:5000'

export async function fetchBlockData(slot: number | string): Promise<BlockData> {
    try {
        const response = await fetch(`${API_HOST}/eth/v2/beacon/blocks/${slot}`)
        if (response.status === 404) {
            // Return a placeholder block data for 404 status
            return { slot: Number(slot), graffiti: null }
        }
        if (!response.ok) {
            throw `Failed to fetch block data for slot ${slot}. Status: ${response.status}`
        }

        const result = await response.json()

        return { slot: Number(result.data.message.slot), graffiti: result.data.message.body.graffiti }
    } catch (error) {
        throw `Error fetching block data for slot ${slot}: ${error.message}`
    }
}

export async function getLastFinalizedSlotBlockchain(): Promise<number> {
    const blockData = await fetchBlockData('finalized')
    return Number(blockData.slot)
}