/**
 * @fileoverview Clase AppError para errores operativos de ms-reportes.
 * Proporciona mensaje descriptivo y código de estado HTTP para
 * que el error.middleware responda adecuadamente.
 */

/**
 * Error operativo personalizado para la lógica de negocio de reportes.
 * Incluye statusCode para que el manejador global responda con el código HTTP correcto.
 */
export class AppError extends Error {
    public readonly statusCode: number;
    
    constructor(message: string, statusCode: number) {
        super(message);
        this.statusCode = statusCode;
        // Mantiene la traza de la pila limpia (exclusivo de V8)
        Error.captureStackTrace(this, this.constructor);
    }
}