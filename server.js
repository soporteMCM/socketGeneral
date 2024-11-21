// Importar dependencias
import https from "https"
import express from "express"
import { Server } from "socket.io"
import axios from "axios"
import fs from "node:fs"

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

// Evento de conexión
io.on("connection", (socket) => {
    switch (socket.handshake.query.modulo) {
        case "callcenter":
            callcenter(socket)
            break
        default:
            console.log("Módulo no identificado")
            break
    }
})

const archivoPHP = (archivo, parametros = null) => {
    const { exec } = require("child_process")
    exec(`php ${archivo} ${parametros}`, (error, stdout, stderr) => {
        if (!error) return stderr
        return stdout
    })
}

const consultaHTTP = async (url, datos = null, config = null) => {
    try {
        const response = datos ? await axios.get(url, config) : await axios.post(url, datos, config)
        return response.data
    } catch (error) {
        return error
    }
}

const callcenter = (socket) => {
    const sesion = {}
    sesion.asesor = socket.handshake.query.asesor
    sesion.sesionPHP = socket.handshake.query.sesionPHP

    socket.on("disconnect", (data) => {
        const r = consultaHTTP(
            `${sesion.servidor}/callcenter/ActualizaClienteEncuestaPostventa`,
            { asesor: sesion.asesor },
            {
                headers: {
                    Cookie: sesion.sesionPHP
                }
            }
        )
        console.log(r)
    })
}

// Iniciar el servidor
const PORT = 8009
server.listen(PORT, () => {
    console.log(`Servidor en linea en el puerto ${PORT}`)
})
