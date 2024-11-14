export const sleep = (milliseconds: number): Promise<void> => new Promise(resolve => setTimeout(resolve, milliseconds))

export function isDateInLastHour(date: Date): boolean {
    const oneHourAgo = new Date(new Date().getTime() - 60 * 60 * 1000)
    return date >= oneHourAgo
}
