import { ClientCodeMap, RocketPoolELMap, RocketPoolCLMap } from "./clientcodes.js"
import type { RawBlock, Client, Slot } from "./types.js"

export function detectClients(rawBlock: RawBlock): Slot {
    try {
        const index = Number(rawBlock.index)

        if (index == null) {
            throw new Error('Slot not found in the response.')
        }

        const graffitiHex = rawBlock.graffiti
        const validatorIndex = rawBlock.validatorIndex

        const graffiti = graffitiHex && graffitiHex !== '0x'
            ? Buffer.from(graffitiHex.slice(2), 'hex')  // Remove '0x' prefix
                .filter(byte => byte !== 0)             // Remove null bytes
                .toString()
                .trim() || null
            : null

        //const textClients = detectClientText(graffiti)
        //const codeClients = detectClientCode(graffiti)
        //const rocketPoolClients = detectRocketPool(graffiti)
        //const clients = [...textClients, ...codeClients, ...rocketPoolClients]
        const clients = detectClientCode(graffiti)

        const date = new Date((1606824023 + index * 12) * 1000)

        return { index, date, validatorIndex, graffiti, clients }
    } catch (error) {
        throw `Error extracting fields: ${error.message}`
    }
}

function detectClientText(graffiti: string) {
    if (graffiti === null) {
        return []
    }

    const matches: Client[] = []
    const textPattern = /^(Lighthouse|teku|Nimbus)\//
    const textMatch = graffiti.match(textPattern)

    if (textMatch) {
        matches.push({ name: textMatch[1].toLocaleLowerCase(), version: null })
    }

    return matches
}

function detectClientCode(graffiti: string | null) {
    if (graffiti === null) {
        return []
    }

    const matches: Client[] = []
    const standardPattern = /(BU|EG|GE|NM|RH|GR|LH|LS|NB|TK|PM)([0-9a-f]{0,8})(BU|EG|GE|NM|RH|GR|LH|LS|NB|TK|PM)([0-9a-f]{0,8})/g
    const standardMatches = graffiti.matchAll(standardPattern)

    for (const match of standardMatches) {
        matches.push(
            { name: ClientCodeMap[match[1]], version: match[2] || null },
            { name: ClientCodeMap[match[3]], version: match[4] || null }
        )
    }

    return matches
}

function detectRocketPool(graffiti: string) {
    if (graffiti === null) {
        return []
    }

    const matches: Client[] = []
    const rocketPattern = /^RP-(?:(X|R|N|G|B)(N|P|L|T|S)|(N|P|L|T|S))/
    const rocketMatch = graffiti.match(rocketPattern)

    if (rocketMatch) {
        if (rocketMatch[1] && rocketMatch[2]) {
            if (rocketMatch[1] !== 'X') {
                matches.push({ name: RocketPoolELMap[rocketMatch[1]], version: null })
            }
            matches.push({ name: RocketPoolCLMap[rocketMatch[2]], version: null })
        } else if (rocketMatch[3]) {
            matches.push({ name: RocketPoolCLMap[rocketMatch[3]], version: null })
        }
    }

    return matches
}
