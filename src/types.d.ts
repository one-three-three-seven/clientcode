export type BlockData = {
    slot: number
    graffiti: string | null
}

export type SlotRecord = {
    slot: number
    date: Date
    graffiti: string
    rocketPool: boolean
    clients: string[]
}
