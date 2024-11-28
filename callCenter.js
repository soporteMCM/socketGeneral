import { reportaError, consultaHTTP } from "./comunes.js"

/**
 * Función que maneja la lógica del módulo para callcenter
 */
const callcenter = (socket, sesiones, io = null) => {
    sesiones[socket.id] = {}
    sesiones[socket.id].asesor = socket.handshake.query.asesor
    sesiones[socket.id].sesionPHP = socket.handshake.query.sesionPHP
    sesiones[socket.id].servidor = socket.handshake.query.servidor
    sesiones[socket.id].datosRequeridos = JSON.parse(socket.handshake.query.datosRequeridos)
    sesiones[socket.id].inicio = new Date()
    sesiones[socket.id].conteoClientes = 0

    const motivos = {
        NC: "No contesta",
        NE: "Número equivocado",
        NI: "No está interesado",
        MD: "Marcar otro día",
        MM: "Marcar más tarde",
        OT: "Otro"
    }

    const liberarDespues = ["NC", "MM"]

    const noLiberar = ["NE", "NI", "MD"]

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
                sesiones[socket.id].conteoClientes++
                sesiones[socket.id].cliente = cliente.success ? cliente.datos.CLIENTE : null
                sesiones[socket.id].ciclo = cliente.success ? cliente.datos.CICLO : null
                sesiones[socket.id].telefono = cliente.success ? cliente.datos.TELEFONO : null
                sesiones[socket.id].tiempo = new Date().getTime()
                socket.emit("clienteAsignado", cliente)
            })
            .catch((error) => {
                reportaError(error)
                socket.emit("clienteAsignado", {
                    success: false,
                    mensaje: "Error al realizar la consulta al servidor",
                    error
                })
            })
    }

    const liberarCliente = ({
        asesor = null,
        cliente = null,
        ciclo = null,
        liberar = true
    } = {}) => {
        asesor = asesor || sesiones[socket.id].asesor
        cliente = cliente || sesiones[socket.id].cliente
        ciclo = ciclo || sesiones[socket.id].ciclo
        consulta("ActualizaClienteEncuestaPostventa", { asesor, cliente, ciclo, liberar })
    }

    const guardaEncuesta = (datos) => {
        datos.motivo = motivos[datos.motivo] || datos.motivo
        consulta("GuardaEncuestaPostventa", datos)
    }

    socket.on("guardaEncuesta", ({ datosEncuesta = {}, abandono = false } = {}) => {
        const { asesor, cliente, ciclo } = sesiones[socket.id]
        const motivo = datosEncuesta.motivo
        guardaEncuesta(datosEncuesta)
        asignaCliente()

        if (abandono) {
            if (liberarDespues.includes(motivo)) {
                setTimeout(() => {
                    console.log("Liberando cliente")
                    liberarCliente({ asesor, cliente, ciclo, abandono })
                }, 1000 * 60 * 60) // Liberar después de una hora
            } else if (!noLiberar.includes(motivo)) {
                liberarCliente({ asesor, cliente, ciclo, abandono })
            }
        }
    })

    socket.on("disconnect", () => {
        const datos = sesiones[socket.id].datosRequeridos

        if (datos) {
            datos.cliente = sesiones[socket.id].cliente
            datos.ciclo = sesiones[socket.id].ciclo
            datos.telefono = sesiones[socket.id].telefono
            datos.estatus = "DESCONECTADO"
            datos.motivo = "Conexión perdida"
            datos.duracion = Math.round((new Date().getTime() - sesiones[socket.id].tiempo) / 1000)
            guardaEncuesta(datos)
        }

        liberarCliente()
        delete sesiones[socket.id]
    })

    asignaCliente()
    socket.emit("conectado", { motivos })
}

export default callcenter
