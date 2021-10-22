import { readFileSync, writeFileSync } from "fs"
import P from "pino"
import { Boom } from "@hapi/boom"
import makeWASocket, { WASocket, AuthenticationState, DisconnectReason, BufferJSON, initInMemoryKeyStore } from '@adiwajshing/baileys-md'
import * as cases from './cases.js'


let sock: WASocket | undefined = undefined
// load authentication state from a file
const loadState = () => {
    let state: AuthenticationState | undefined = undefined
    try {
        const value = JSON.parse(
            readFileSync('./auth_info_multi.json', { encoding: 'utf-8' }), 
            BufferJSON.reviver
        )
        state = { 
            creds: value.creds, 
            // stores pre-keys, session & other keys in a JSON object
            // we deserialize it here
            keys: initInMemoryKeyStore(value.keys) 
        }
    } catch{  }
    return state
}
// save the authentication state to a file
const saveState = (state?: any) => {
    console.log('saving pre-keys')
    state = state || sock?.authState
    writeFileSync(
        './auth_info_multi.json', 
        // BufferJSON replacer utility saves buffers nicely
        JSON.stringify(state, BufferJSON.replacer, 2)
    )
}
// start a connection
const startSock = () => {
    // SHUT THE FUCK UP, YOU CAN'T LIE TO ME, THIS IS NOT A FUCKING FUNCTION
    const sock = (makeWASocket as any).default({
        printQRInTerminal: true,
        logger: P({ level: "silent" }),
        auth: loadState()
    }) as WASocket

    sock.ev.on('messages.upsert', cases.handleMsgUpsert)
    // sock.ev.on('messages.update', m => console.log(m))
    // sock.ev.on('presence.update', m => console.log(m))
    // sock.ev.on('chats.update', m => console.log(m))
    // sock.ev.on('contacts.update', m => console.log(m))

    // reinitialize socket
    cases.init(sock)
    return sock
}

sock = startSock()

sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect } = update
    if(connection === 'close') {
        // reconnect if not logged out
        if((lastDisconnect.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut) {
            sock = startSock()
        } else {
            console.log('connection closed')
        }
    }
    console.log('connection update', update.connection)
})
// listen for when the auth state is updated
// it is imperative you save this data, it affects the signing keys you need to have conversations
sock.ev.on('auth-state.update', saveState)