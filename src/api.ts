import { getAggregatedSlotsData } from './database.js'
import http from 'node:http'

const API_SERVER_PORT = 8080

export function listenAPI() {
    const APIServer = http.createServer(async (req, res) => {
        res.setHeader('Access-Control-Allow-Origin', '*')
    
        if (req.method === 'GET') {
            try {
                const data = await getAggregatedSlotsData()
                res.writeHead(200, { 'Content-Type': 'application/json' })
                res.end(JSON.stringify(data.rows))
            } catch (error) {
                console.error(`Error fetching aggregated slot data: ${error.message}`)
                res.writeHead(500, { 'Content-Type': 'application/json' })
                res.end(JSON.stringify({ error: 'Internal Server Error' }))
            }
        } else {
            res.writeHead(405, { 'Content-Type': 'text/plain' })
            res.end('Method Not Allowed')
        }
    })
    
    APIServer.listen(API_SERVER_PORT, () => {
        console.log(`Server is running on port ${API_SERVER_PORT}`)
    })
}
