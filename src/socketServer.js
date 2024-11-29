import https from "https"
import express from "express"
import { Server } from "socket.io"
import fs from "node:fs"

import callcenter from "../Modules/callCenter.js"
import superCallcenter from "../Modules/superCallcenter.js"

// Crear objetos requeridos
const certificado = {
    key: fs.readFileSync("C:/xampp/apache/CertificadoSSL/Autofirmado/server.key"),
    cert: fs.readFileSync("C:/xampp/apache/CertificadoSSL/Autofirmado/server.crt")
}
const app = express()
const server = https.createServer(certificado, app)
const io = new Server(server, {
    cors: {
        origin: "*", // Permitir todos los orígenes (no recomendado para producción)
        methods: ["GET", "POST"]
    }
})
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"
const sesiones = {
    callcenter: {}
}

// Evento de conexión principal
io.on("connection", (socket) => {
    switch (socket.handshake.query.modulo) {
        case "callcenter":
            callcenter(socket, sesiones.callcenter, io)
            break
        case "superCallcenter":
            superCallcenter(socket, sesiones.callcenter, io)
            break
        default:
            console.log(`Módulo no reconocido: ${socket.handshake.query.modulo}`)
            break
    }
})

// Iniciar el servidor
server.listen(process.env.PUERTO, () => {
    console.log("Servidor activo")
})
