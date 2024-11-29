import { reportaError, consultaPHP } from "../src/comunes.js"

const superCallcenter = (socket, sesiones, io = null) => {
    socket.join("superCallcenter")

    socket.on("mensajeGlobal", (mensaje) => {
        io.to("callcenter").emit("mensajeSuper", mensaje.mensaje)
    })

    socket.on("mensajeAsesor", (mensaje) => {
        const id = Object.entries(sesiones).find(
            ([clave, valor]) => valor.asesor === mensaje.asesor
        )[0]
        io.to(id).emit("mensajeSuper", mensaje.mensaje)
    })

    const infoSesiones = Object.keys(sesiones)
        .filter((sesion) => sesiones[sesion].asesor)
        .map((sesion) => {
            const { asesor, cliente, conexion, conteos, estatus, ultimoCambio } = sesiones[sesion]
            return { asesor, cliente, conexion, conteos, estatus, ultimoCambio }
        })

    socket.emit("supervisando", infoSesiones)
}

export default superCallcenter
