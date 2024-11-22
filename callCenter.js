import { consultaHTTP } from "./comunes.js"

const callcenter = (socket, sesiones) => {
    sesiones[socket.id] = {}
    sesiones[socket.id].asesor = socket.handshake.query.asesor
    sesiones[socket.id].sesionPHP = socket.handshake.query.sesionPHP
    sesiones[socket.id].servidor = socket.handshake.query.servidor

    const consulta = (recurso, datos) => {
        return consultaHTTP(
            `${sesiones[socket.id].servidor}/callcenter/${recurso}`,
            new URLSearchParams(datos),
            {
                headers: {
                    Cookie: `PHPSESSID=${sesiones[socket.id].sesionPHP}`
                }
            }
        )
    }

    const asignaCliente = () => {
        socket.emit("asignando")
        consulta("AsignaClienteEncuestaPostventa", {
            asesor: sesiones[socket.id].asesor,
            cliente: sesiones[socket.id].cliente
        })
            .then((cliente) => {
                try {
                    const datos = JSON.parse(cliente)
                    sesiones[socket.id].cliente = datos.success ? datos.datos.CLIENTE : null
                    sesiones[socket.id].telefono = datos.success ? datos.datos.TELEFONO : null
                    sesiones[socket.id].tiempo = new Date().getTime()
                    socket.emit("clienteAsignado", datos)
                } catch (error) {
                    console.log(error)
                    socket.emit("clienteAsignado", {
                        success: false,
                        mensaje: "Error al procesar la respuesta del servidor",
                        error
                    })
                }
            })
            .catch((error) => {
                console.log(error)
                socket.emit("clienteAsignado", {
                    success: false,
                    mensaje: "Error al realizar la consulta al servidor"
                })
            })
    }

    const liberarCliente = ({ asesor = null, cliente = null } = {}) => {
        asesor = asesor || sesiones[socket.id].asesor
        cliente = cliente || sesiones[socket.id].cliente
        consulta("ActualizaClienteEncuestaPostventa", { asesor, cliente, limpiar: true })
    }

    const guardaEncuesta = (datos) => {
        consulta("GuardaEncuestaPostventa", datos)
    }

    asignaCliente()

    socket.on("cambiaCliente", (libera = false) => {
        const { asesor, cliente } = sesiones[socket.id]
        asignaCliente()
        if (libera) liberarCliente({ asesor, cliente })
    })

    socket.on("guardaEncuesta", (datos) => {
        sesiones[socket.id].objetoCierre = datos
        guardaEncuesta(datos)
    })

    socket.on("disconnect", () => {
        const datos = sesiones[socket.id].objetoCierre

        if (datos) {
            Object.keys(datos).forEach((llave) => (datos[llave] = null))
            datos["asesor"] = sesiones[socket.id].asesor
            datos["cliente"] = sesiones[socket.id].cliente
            datos["telefono"] = sesiones[socket.id].telefono
            datos["estatus"] = "DESCONECTADO"
            datos["duracion"] = Math.round(
                (new Date().getTime() - sesiones[socket.id].tiempo) / 1000
            )
            guardaEncuesta(datos)
        }

        liberarCliente()
        delete sesiones[socket.id]
    })
}

export default callcenter
