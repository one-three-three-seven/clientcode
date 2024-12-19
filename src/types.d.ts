export type RawBlock = {
    index: number
    validatorIndex: number | null
    graffiti: string | null
}

export type Slot = {
    index: number
    date: Date
    validatorIndex: number | null
    graffiti: string | null
    clients: Client[]
}

export type Client = {
    name: string
    version: string | null
}
