/**
 * @fileoverview Servicio de gestión de reportes ciudadanos.
 * Coordina la creación, consulta, actualización, eliminación y cambio de estado
 * de reportes de incidentes, incluyendo vinculación de multimedia y publicación
 * de eventos en RabbitMQ.
 */

import axios from 'axios';
import { ReporteRepository } from '../repositories/reporte.repository';
import { ICreateReporteDTO, IUpdateReporteDTO, EstadoReporte } from '../models/reporte.model';
import { UserRole } from '../models/user.enum';
import { AppError } from '../helpers/appError';
import { envs } from '../config/envs';
import { logger } from '../config/logger';
import { ReportePublisher } from '../events/reporte.publisher';

/** Estados que no permiten volver a PENDIENTE */
const ESTADOS_FINALES = new Set<EstadoReporte>([
    EstadoReporte.RESUELTO,
    EstadoReporte.FALSA_ALARMA,
]);

export class ReporteService {
    // --- CATEGORÍAS ---
    /**
     * Obtiene todas las categorías de incidentes disponibles.
     *
     * @returns Lista de categorías
     */
    static async obtenerCategorias() {
        return await ReporteRepository.obtenerCategorias();
    }

    /**
     * Obtiene una categoría de incidente por su ID.
     *
     * @param id - Identificador único de la categoría
     * @returns Categoría encontrada
     * @throws AppError(404) - Si la categoría no existe
     */
    static async obtenerCategoriaPorId(id: string) {
        const categoria = await ReporteRepository.obtenerCategoriaPorId(id);
        if (!categoria) throw new AppError('Categoría no encontrada.', 404);
        return categoria;
    }

    // --- REPORTES ---

    /**
     * Crea un reporte y vincula la multimedia asociada si existe.
     * @param data Datos del reporte
     * @param id_multimedia ID opcional de la imagen previamente subida
     */
    static async crearReporte(data: ICreateReporteDTO, id_multimedia?: string) {
        // 1. Persistimos el reporte en la base de datos local de ms-reportes
        const nuevoReporte = await ReporteRepository.crear(data);

        // 2. Si el usuario adjuntó una foto, disparamos la vinculación en ms-multimedia
        if (id_multimedia) {
            // Se ejecuta de forma asíncrona para no bloquear la respuesta al usuario
            this.vincularMultimedia(id_multimedia, data.id_ciudadano, nuevoReporte.id);
        }

        // 3. Publicamos evento de reporte creado en el bus de eventos (RabbitMQ)
        //    Se ejecuta de forma asíncrona para no bloquear la respuesta al usuario
        ReportePublisher.publicarReporteCreado(nuevoReporte as unknown as Record<string, unknown>).catch(
            (err) => {
                logger.error({ err }, '[ReporteService] Error publicando evento de creación');
            },
        );

        return nuevoReporte;
    }

    /**
     * Comunicación interna (Inter-Service): Llama al ms-multimedia para vincular la foto.
     */
    private static async vincularMultimedia(
        id_multimedia: string,
        userId: string,
        reporteId: string,
    ) {
        try {
            const url = `${envs.MULTIMEDIA_SERVICE_URL}/api/v1/multimedia/${id_multimedia}/vincular`;

            await axios.patch(
                url,
                {},
                {
                    headers: {
                        'x-internal-token': envs.INTERNAL_SECRET_TOKEN,
                        'x-internal-call': 'ms-reportes',
                        'x-user-id': userId,
                    },
                },
            );

            logger.info(
                `✅ Imagen ${id_multimedia} vinculada exitosamente al reporte ${reporteId}`,
            );
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
            logger.error(`⚠️ Error vinculando multimedia ${id_multimedia}: ${errorMessage}`);
        }
    }

    /**
     * Obtiene reportes con paginación y filtros.
     *
     * @param limit - Cantidad máxima de resultados
     * @param offset - Desplazamiento para paginación
     * @param usuarioAuth - Datos del usuario autenticado
     * @param filtros - Filtros opcionales (estado, categoria_id)
     * @returns Lista paginada de reportes
     */
    static async obtenerReportes(
        limit: number,
        offset: number,
        usuarioAuth: { uid: string; rol: string },
        filtros: { estado?: string; categoria_id?: string },
    ) {
        return await ReporteRepository.obtenerTodos(limit, offset, filtros);
    }

    /**
     * Obtiene los reportes creados por un ciudadano específico.
     *
     * @param uid - Firebase UID del ciudadano
     * @param limit - Cantidad máxima de resultados
     * @param offset - Desplazamiento para paginación
     * @returns Lista paginada de reportes del ciudadano
     */
    static async obtenerMisReportes(uid: string, limit: number, offset: number) {
        return await ReporteRepository.obtenerPorCiudadano(uid, limit, offset);
    }

    /**
     * Obtiene un reporte por su ID.
     *
     * @param id - Identificador único del reporte
     * @returns Reporte encontrado
     * @throws AppError(404) - Si el reporte no existe
     */
    static async obtenerReportePorId(id: string) {
        const reporte = await ReporteRepository.obtenerPorId(id);
        if (!reporte) throw new AppError('El reporte solicitado no existe.', 404);
        return reporte;
    }

    /**
     * Actualiza un reporte verificando permisos del usuario.
     *
     * @param reporteId - ID del reporte a actualizar
     * @param updateData - Datos parciales a modificar
     * @param usuarioAuth - Datos del usuario autenticado
     * @returns Reporte actualizado
     * @throws AppError(403) - Si no tiene permisos para modificar
     * @throws AppError(400) - Si el reporte ya está siendo procesado
     * @throws AppError(404) - Si el reporte no existe
     */
    static async actualizarReporte(
        reporteId: string,
        updateData: IUpdateReporteDTO,
        usuarioAuth: { uid: string; rol: string },
    ) {
        const reporte = await ReporteRepository.obtenerPorId(reporteId);
        if (!reporte) throw new AppError('Reporte no encontrado.', 404);

        if (reporte.id_ciudadano !== usuarioAuth.uid && usuarioAuth.rol !== UserRole.ADMIN) {
            throw new AppError('No tienes permiso para modificar este reporte.', 403);
        }

        if (reporte.estado !== EstadoReporte.PENDIENTE && usuarioAuth.rol !== UserRole.ADMIN) {
            throw new AppError('No puedes editar un reporte que ya está siendo procesado.', 400);
        }

        return await ReporteRepository.actualizarParcial(reporteId, updateData);
    }

    /**
     * Elimina un reporte verificando permisos del usuario.
     *
     * @param reporteId - ID del reporte a eliminar
     * @param usuarioAuth - Datos del usuario autenticado
     * @returns Resultado de la eliminación
     * @throws AppError(403) - Si no tiene permisos para eliminar
     * @throws AppError(404) - Si el reporte no existe
     */
    static async eliminarReporte(reporteId: string, usuarioAuth: { uid: string; rol: string }) {
        const reporte = await ReporteRepository.obtenerPorId(reporteId);
        if (!reporte) throw new AppError('Reporte no encontrado.', 404);

        if (reporte.id_ciudadano !== usuarioAuth.uid && usuarioAuth.rol !== UserRole.ADMIN) {
            throw new AppError('No tienes permiso para eliminar este reporte.', 403);
        }

        return await ReporteRepository.eliminar(reporteId);
    }

    /**
     * Obtiene el historial de cambios de estado de un reporte.
     *
     * @param reporteId - ID del reporte
     * @returns Historial de estados
     * @throws AppError(404) - Si el reporte no existe
     */
    static async obtenerHistorial(reporteId: string) {
        const reporte = await ReporteRepository.obtenerPorId(reporteId);
        if (!reporte) throw new AppError('Reporte no encontrado.', 404);
        return await ReporteRepository.obtenerHistorialPorReporte(reporteId);
    }

    /**
     * Cambia el estado de un reporte con validación de permisos y reglas de negocio.
     *
     * @description Restricciones:
     * - Usuarios con rol USUARIO no pueden cambiar estados.
     * - No se puede cambiar al mismo estado actual.
     * - Reportes en estado RESUELTO o FALSA_ALARMA no pueden volver a PENDIENTE.
     *
     * @param reporteId - ID del reporte
     * @param nuevoEstado - Nuevo estado del reporte
     * @param usuarioAuth - Datos del usuario autenticado
     * @param comentarios - Comentarios opcionales sobre el cambio
     * @returns Reporte actualizado
     * @throws AppError(403) - Si el usuario no tiene permisos
     * @throws AppError(400) - Si la transición de estado no es válida
     * @throws AppError(404) - Si el reporte no existe
     */
    static async cambiarEstado(
        reporteId: string,
        nuevoEstado: EstadoReporte,
        usuarioAuth: { uid: string; rol: string },
        comentarios?: string,
    ) {
        if (usuarioAuth.rol === UserRole.USUARIO) {
            throw new AppError(
                'Un ciudadano no tiene permisos para auditar estados de un incidente.',
                403,
            );
        }

        const reporteActual = await ReporteRepository.obtenerPorId(reporteId);
        if (!reporteActual) throw new AppError('Reporte no encontrado.', 404);

        if (reporteActual.estado === nuevoEstado) {
            throw new AppError(`El reporte ya se encuentra marcado como ${nuevoEstado}.`, 400);
        }

        if (ESTADOS_FINALES.has(reporteActual.estado) && nuevoEstado === EstadoReporte.PENDIENTE) {
            throw new AppError('Un incidente cerrado no puede volver a estado pendiente.', 400);
        }

        return await ReporteRepository.actualizarEstadoConHistorial(
            reporteId,
            reporteActual.estado,
            nuevoEstado,
            usuarioAuth.uid,
            comentarios,
        );
    }
}
