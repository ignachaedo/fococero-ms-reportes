/**
 * @fileoverview Esquemas Zod para validación de operaciones CRUD de reportes.
 * Define schemas para creación, actualización parcial, cambio de estado y
 * eliminación de reportes ciudadanos.
 */

import { z } from 'zod';
import { EstadoReporte } from '../models/reporte.model';

/** Validador base reutilizable para ID en parámetros de URL */
const idParamSchema = z.object({
    id: z.string().uuid({ message: 'El ID del reporte debe ser un UUID válido.' }),
});

/** Validador base reutilizable para metadatos (structura llave-valor) */
const metadataSchema = z.record(z.string(), z.unknown()).optional();

/**
 * Esquema para validar la creación de un reporte (POST /).
 * Requiere categoria_id, titulo, descripción, latitud y longitud.
 */
export const crearReporteSchema = z.object({
    body: z
        .object({
            categoria_id: z.string().uuid({ message: 'Formato de categoría inválido.' }),
            titulo: z
                .string()
                .min(5, 'El título es muy corto.')
                .max(150, 'El título es muy largo.'),
            descripcion: z.string().min(10, 'La descripción debe tener al menos 10 caracteres.'),
            latitud: z.number().min(-90).max(90, 'Latitud fuera del rango global.'),
            longitud: z.number().min(-180).max(180, 'Longitud fuera del rango global.'),
            direccion: z.string().max(300).optional(),
            metadata: metadataSchema,
        }),
});

/**
 * Esquema para validar actualización parcial de un reporte (PATCH /:id).
 * Todos los campos son opcionales, pero al menos uno debe estar presente.
 */
export const actualizarReporteSchema = z.object({
    params: idParamSchema,
    body: z
        .object({
            titulo: z.string().min(5).max(150).optional(),
            descripcion: z.string().min(10).optional(),
            categoria_id: z.string().uuid().optional(),
            latitud: z.number().min(-90).max(90).optional(),
            longitud: z.number().min(-180).max(180).optional(),
            direccion: z.string().max(300).optional(),
            metadata: metadataSchema,
        })
        .refine((data) => Object.keys(data).length > 0, {
            message:
                'Debe enviar al menos un campo válido para actualizar (titulo, descripcion, categoria_id, latitud, longitud, direccion o metadata).',
        }),
});

/**
 * Esquema para validar cambio de estado de un reporte (PATCH /:id/estado).
 * Requiere un nuevoEstado válido del enum EstadoReporte y comentarios opcionales.
 */
export const cambiarEstadoSchema = z.object({
    params: idParamSchema,
    body: z
        .object({
            nuevoEstado: z.nativeEnum(EstadoReporte, {
                message: 'Estado inválido. Use: PENDIENTE, EN_PROCESO, RESUELTO o FALSA_ALARMA',
            }),
            comentarios: z
                .string()
                .max(500, 'El comentario excede los 500 caracteres permitidos.')
                .optional(),
        })
        .strict(),
});

/**
 * Esquema para validar eliminación de un reporte (DELETE /:id).
 * Solo requiere un UUID válido en los parámetros de ruta.
 */
export const eliminarReporteSchema = z.object({
    params: idParamSchema,
});
