import { ClientCodeMap, RocketPoolELMap, RocketPoolCLMap } from "./clientcodes.js"
import type { BlockData, SlotRecord } from "./types.js"

export function detectClients(blockData: BlockData): SlotRecord {
    try {
        const slot = Number(blockData.slot)

        if (slot == null) {
            throw new Error('Slot not found in the response.')
        }

        const graffitiHex = blockData.graffiti

        const graffiti = graffitiHex && graffitiHex !== '0x'
            ? Buffer.from(graffitiHex.slice(2), 'hex')  // Remove '0x' prefix
                .filter(byte => byte !== 0)             // Remove null bytes
                .toString()
                .trim() || null
            : null

        const textClients = detectClientText(graffiti)
        const codeClients = detectClientCode(graffiti)
        const rocketPoolClients = detectRocketPool(graffiti)
        const clients = [...textClients, ...codeClients, ...rocketPoolClients]
        const rocketPool = !!rocketPoolClients.length

        const date = new Date((1606824023 + slot * 12) * 1000)

        return { slot, date, graffiti, rocketPool, clients }
    } catch (error) {
        throw `Error extracting fields: ${error.message}`
    }
}

function detectClientText(graffiti: string) {
    if (graffiti === null) {
        return []
    }

    const matches = []
    const textPattern = /^(Lighthouse|teku|Nimbus)\//
    const textMatch = graffiti.match(textPattern)

    if (textMatch) {
        matches.push(textMatch[1].toLocaleLowerCase())
    }

    return matches
}

function detectClientCode(graffiti: string) {
    if (graffiti === null) {
        return []
    }

    const matches = []
    const standardPattern = /(BU|EG|GE|NM|RH|GR|LH|LS|NB|TK|PM)[0-9a-f]{0,8}(BU|EG|GE|NM|RH|GR|LH|LS|NB|TK|PM)/g
    const standardMatches = graffiti.matchAll(standardPattern)

    for (const match of standardMatches) {
        matches.push(ClientCodeMap[match[1]], ClientCodeMap[match[2]])
    }

    return matches
}

function detectRocketPool(graffiti: string) {
    if (graffiti === null) {
        return []
    }

    const matches = []
    const rocketPattern = /^RP-(?:(X|R|N|G|B)(N|P|L|T|S)|(N|P|L|T|S))/
    const rocketMatch = graffiti.match(rocketPattern)

    if (rocketMatch) {
        if (rocketMatch[1] && rocketMatch[2]) {
            if (rocketMatch[1] !== 'X') {
                matches.push(RocketPoolELMap[rocketMatch[1]])
            }
            matches.push(RocketPoolCLMap[rocketMatch[2]])
        } else if (rocketMatch[3]) {
            matches.push(RocketPoolCLMap[rocketMatch[3]])
        }
    }

    return matches
}
