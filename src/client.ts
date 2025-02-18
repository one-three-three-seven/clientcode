import type { RawBlock } from "./types.js"

const API_HOST = 'http://10.10.10.2:5000'

export async function fetchBlockData(slot: number | string): Promise<RawBlock> {
    try {
        const response = await fetch(`${API_HOST}/eth/v2/beacon/blocks/${slot}`)
        if (response.status === 404) {
            // Return a placeholder block data for 404 status
            //console.log(`404 response for slot ${slot}`)
            return { index: Number(slot), validatorIndex: null, graffiti: null }
        }
        if (!response.ok) {
            throw `Failed to fetch block data for slot ${slot}. Status: ${response.status}`
        }

        const result = await response.json()

        return { index: Number(result.data.message.slot), validatorIndex: Number(result.data.message.proposer_index), graffiti: result.data.message.body.graffiti }
    } catch (error) {
        throw `Error fetching block data for slot ${slot}: ${error.message}`
    }
}

export async function getLastFinalizedSlotBlockchain(): Promise<number> {
    const rawBlock = await fetchBlockData('finalized')
    return Number(rawBlock.index)
}