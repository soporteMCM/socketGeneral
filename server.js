import https from "https"
import express from "express"
import { Server } from "socket.io"
import fs from "node:fs"

import callcenter from "./callCenter.js"

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
const sesiones = {}

// Evento de conexión principal
io.on("connection", (socket) => {
    switch (socket.handshake.query.modulo) {
        case "callcenter":
            callcenter(socket, sesiones)
            break
        default:
            console.log(`Módulo no reconocido: ${socket.handshake.query.modulo}`)
            break
    }
})

// Iniciar el servidor
const PORT = 8009
server.listen(PORT, () => {
    console.log(`Servidor en linea en el puerto ${PORT}`)
})
