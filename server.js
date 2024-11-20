// Importar dependencias
import http from "http"
import express from "express"
import { Server } from "socket.io"
import axios from "axios"

// Crear objetos requeridos
const app = express()
const server = http.createServer(app)
const io = new Server(server, {
    cors: {
        origin: "*", // Permitir todos los orígenes (no recomendado para producción)
        methods: ["GET", "POST"]
    }
})

const archivoPHP = (archivo, parametros = null) => {
    const { exec } = require("child_process")
    exec(`php ${archivo} ${parametros}`, (error, stdout, stderr) => {
        if (!error) return stderr
        return stdout
    })
}

const consultaHTTP = async (url, config) => {
    try {
        const response = await axios.get(url, config)
        return response.data
    } catch (error) {
        return error
    }
}

const sesiones = {}
const status = {
    usuarios: 0,
    ultimo: null,
    nombre: null,
    nombre2: null
}

const acciones = {
    notificaEstatus: () => {
        status.usuarios = io.engine.clientsCount
        io.emit("estatus", status)
    }
}

// Evento de conexión
io.on("connection", (socket) => {
    status.ultimo = socket.handshake.address
    status.nombre = socket.handshake.query.nombre
    sesiones[socket.id] = {
        id: socket.handshake.query.sessionId,
        hora: new Date().toISOString(),
        nombre: status.nombre
    }
    acciones.notificaEstatus()

    // Evento de desconexión
    socket.on("disconnect", (accion, nombre) => {
        try {
            status.nombre2 = sesiones[socket.id].nombre
            acciones.notificaEstatus()
            delete sesiones[socket.id]
        } catch (error) {
            console.error("Error al desconectar:", error)
        }
    })

    // Evento para ejecucion de archivo php
    socket.on("php", (archivo, parametros = null) => {
        console.log("Ejecutando archivo PHP:", archivo)
        socket.emit("resultado-php", archivoPHP(archivo, parametros))
    })

    // Evento para consultas http
    socket.on("http", async (datos) => {
        const configuracion = {}
        if (datos.sesion) {
            configuracion.headers = {
                Cookie: datos.sesion
            }
        }
        socket.emit("resultado-http", await consultaHTTP(datos.url, configuracion))
    })
})

// Iniciar el servidor
const PORT = 3333
server.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`)
})
