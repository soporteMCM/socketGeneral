import axios from "axios"
import { exec } from "child_process"

const reportaError = (error) => {
    if (process.env.DEV) console.log(Date(), error)
}

/**
 * Ejecuta un archivo PHP con parámetros opcionales.
 *
 * @param {string} archivo - La ruta del archivo PHP a ejecutar.
 * @param {string} [parametros=null] - Los parámetros opcionales a pasar al archivo PHP.
 * @returns {string} - La salida del archivo PHP.
 */
const archivoPHP = (archivo, parametros = null) => {
    return exec(`php ${archivo} ${parametros}`, (error, stdout, stderr) => {
        if (!error) return stderr
        return stdout
    })
}

/**
 * Realiza una consulta HTTP utilizando axios.
 *
 * @param {string} url - La URL a la que se realizará la solicitud.
 * @param {Object} [datos=null] - Los datos a enviar en una solicitud POST. Si es null, se realizará una solicitud GET.
 * @param {Object} [config=null] - La configuración adicional para la solicitud.
 * @returns {Promise<Object>} - Los datos de la respuesta o el error en caso de fallo.
 */
const consultaHTTP = async (url, datos = null, config = null) => {
    try {
        const response = datos ? await axios.post(url, datos, config) : await axios.get(url, config)
        return response.data
    } catch (error) {
        return error
    }
}

const consultaPHP = (url, sesion, datos) => {
    return consultaHTTP(url, new URLSearchParams(datos), {
        headers: {
            Cookie: `PHPSESSID=${sesion}`
        }
    })
}

export { reportaError, archivoPHP, consultaHTTP, consultaPHP }
