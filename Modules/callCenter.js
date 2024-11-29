import { reportaError, consultaPHP } from "../src/comunes.js"

/**
 * Función que maneja la lógica del módulo para callcenter
 */
const callcenter = (socket, sesiones, io = null) => {
    socket.join("callcenter")

    const configuracion = JSON.parse(socket.handshake.query.configuracion)
    sesiones[socket.id] = {}
    sesiones[socket.id].servidor = socket.handshake.query.servidor
    sesiones[socket.id].sesionPHP = socket.handshake.query.sesionPHP
    sesiones[socket.id].asesor = configuracion.asesor
    sesiones[socket.id].conexion = new Date().toLocaleString("es-MX")
    sesiones[socket.id].estatus = "Iniciando"
    sesiones[socket.id].conteos = {
        asignados: 0,
        completados: 0,
        abandonados: 0
    }
    const url = `${sesiones[socket.id].servidor}/CallCenter`

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

    const reportaSupervisor = (emisor = "actInfoSesiones") => {
        sesiones[socket.id].ultimoCambio = new Date()
        const { asesor, cliente, conexion, conteos, estatus, ultimoCambio } = sesiones[socket.id]
        io.to("superCallcenter").emit(emisor, {
            asesor,
            cliente,
            conexion,
            conteos,
            estatus,
            ultimoCambio
        })
    }

    const asignaCliente = async () => {
        socket.emit("asignando")
        while (sesiones.asignandoCC) {
            await new Promise((resolve) => setTimeout(resolve, 50))
        }

        sesiones.asignandoCC = true
        limpiaAsignacion()
        sesiones[socket.id].estatus = "Actualizando"
        reportaSupervisor()
        consultaPHP(`${url}/AsignaClienteEncuestaPostventa`, sesiones[socket.id].sesionPHP, {
            asesor: sesiones[socket.id].asesor,
            cliente: sesiones[socket.id].cliente
        })
            .then((cliente) => {
                if (!Object.hasOwn(cliente, "success"))
                    throw new Error("La respuesta del servidor no tiene el formato esperado")

                if (cliente.success) {
                    sesiones[socket.id].estatus = "Asignado"
                    sesiones[socket.id].conteos.asignados++
                    sesiones[socket.id].cliente = cliente.success ? cliente.datos.CLIENTE : null
                    sesiones[socket.id].ciclo = cliente.success ? cliente.datos.CICLO : null
                    sesiones[socket.id].telefono = cliente.success ? cliente.datos.TELEFONO : null
                    sesiones[socket.id].tiempo = new Date().getTime()
                } else sesiones[socket.id].estatus = "Sin asignación"

                socket.emit("clienteAsignado", cliente)
                reportaSupervisor()
            })
            .catch((error) => {
                reportaError(error)
                socket.emit("clienteAsignado", {
                    success: false,
                    mensaje: "Error al realizar la consulta al servidor",
                    error
                })
                limpiaAsignacion()
                sesiones[socket.id].estatus = "Error de asignación"
                reportaSupervisor()
            })
            .finally(() => {
                sesiones.asignandoCC = false
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
        consultaPHP(`${url}/ActualizaClienteEncuestaPostventa`, sesiones[socket.id].sesionPHP, {
            asesor,
            cliente,
            ciclo,
            liberar
        })
    }

    const guardaEncuesta = (datos) => {
        datos.motivo = motivos[datos.motivo] || datos.motivo
        consultaPHP(`${url}/GuardaEncuestaPostventa`, sesiones[socket.id].sesionPHP, datos)
    }

    const limpiaAsignacion = () => {
        sesiones[socket.id].cliente = null
        sesiones[socket.id].ciclo = null
        sesiones[socket.id].telefono = null
        sesiones[socket.id].tiempo = null
    }

    socket.on("guardaEncuesta", ({ datosEncuesta = {}, abandono = false } = {}) => {
        const { asesor, cliente, ciclo } = sesiones[socket.id]
        const motivo = datosEncuesta.motivo
        guardaEncuesta(datosEncuesta)
        asignaCliente()
        sesiones[socket.id].conteos.completados++

        if (abandono) {
            sesiones[socket.id].conteos.completados--
            sesiones[socket.id].conteos.abandonados++
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

    socket.on("cambiaEstatus", (estatus) => {
        sesiones[socket.id].estatus = estatus
        reportaSupervisor()
    })

    socket.on("disconnect", () => {
        const datos = configuracion.datosRequeridos

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
        reportaSupervisor("asesorOUT")
        delete sesiones[socket.id]
    })

    socket.emit("conectado", { motivos })
    reportaSupervisor("asesorIN")
    asignaCliente()
}

export default callcenter
