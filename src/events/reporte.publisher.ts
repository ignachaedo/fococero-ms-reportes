// ms-reportes/src/events/reporte.publisher.ts

import { rabbitMQBus } from '../config/rabbitmq';
import { logger } from '../config/logger';

const EXCHANGE = 'fococero.events';
const ROUTING_KEY_CREADO = 'incidente.reporte.creado';

export class ReportePublisher {
  /**
   * Publica un evento cuando un reporte ciudadano es creado.
   * El payload sigue el contrato RawIncidenteSchema definido en ms-analitica.
   *
   * @param reporte - Objeto del reporte recién creado (desde la BD)
   */
  public static async publicarReporteCreado(reporte: Record<string, unknown>): Promise<void> {
    try {
      const lat = Number(reporte.latitud ?? 0);
      const lng = Number(reporte.longitud ?? 0);

      const categoriaId = String(reporte.categoria_id ?? '');
      const metadata = (reporte.metadata as Record<string, unknown>) ?? {};

      const payload = {
        idExterno: String(reporte.id ?? ''),
        origen: 'REPORTE',
        tipo: categoriaId,
        nivelUrgencia: (metadata.nivel_urgencia as number | string) ?? undefined,
        ubicacion: { lat, lng },
        timestamps: {
          creadoEn: reporte.created_at instanceof Date
            ? reporte.created_at.toISOString()
            : String(reporte.created_at ?? new Date().toISOString()),
        },
        detallesAdicionales: {
          titulo: String(reporte.titulo ?? ''),
          descripcion: String(reporte.descripcion ?? ''),
          direccion: String(reporte.direccion ?? ''),
          id_ciudadano: String(reporte.id_ciudadano ?? ''),
          estado: String(reporte.estado ?? ''),
          ...metadata,
        },
      };

      await rabbitMQBus.publishEvent(EXCHANGE, ROUTING_KEY_CREADO, payload);

      logger.info(
        { reporteId: reporte.id, routingKey: ROUTING_KEY_CREADO },
        '[ReportePublisher] Evento de creación publicado exitosamente',
      );
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      logger.error(
        { err: errorMessage, reporteId: reporte.id },
        '[ReportePublisher] Error al publicar evento de creación',
      );
    }
  }
}
