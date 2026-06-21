# ms-reportes

> Microservicio de Reportes Ciudadanos de FocoCero. Permite a los ciudadanos reportar incidentes, a los brigadistas gestionar su estado operativo y a los administradores auditar toda la trazabilidad.

[![Version](https://img.shields.io/badge/version-1.0.0-blue)]()
[![Node](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen)]()
[![License: ISC](https://img.shields.io/badge/License-ISC-blue)]()

---

## Stack

| Capa            | Tecnología                                      |
|-----------------|-------------------------------------------------|
| **Runtime**     | Node.js 20+, TypeScript 5.9                     |
| **Framework**   | Express 5                                       |
| **Base de datos** | PostgreSQL 15 + PostGIS                       |
| **ORM / Driver**  | `pg` (conexión directa con Pool)               |
| **Validación**  | Zod 4                                           |
| **Documentación** | Swagger (swagger-ui-express)                 |
| **Mensajería**  | RabbitMQ (amqplib, exchange `topic`)            |
| **Service Discovery** | Eureka (eureka-js-client)               |
| **Autenticación** | Firebase Admin SDK (verifyIdToken + Custom Token) |
| **Métricas**    | prom-client (Prometheus)                        |
| **Logging**     | Pino                                            |
| **Seguridad**   | Helmet, express-rate-limit, CORS estricto       |

---

## Requisitos

- **Node.js** >= 20.0.0
- **npm** >= 9
- **PostgreSQL** 15+ con extensión **PostGIS** (o Docker con `postgis/postgis:15-3.3`)
- **RabbitMQ** 3 (o Docker con `rabbitmq:3-management`)
- **Eureka Server** (opcional, para service discovery)
- Acceso a un proyecto **Firebase** con SDK de Admin habilitado

---

## Variables de entorno

| Variable                       | Obligatoria | Default                          | Descripción                                                |
|-------------------------------|:-----------:|----------------------------------|------------------------------------------------------------|
| `PORT`                        | No          | `3004`                           | Puerto donde escucha el microservicio.                     |
| `NODE_ENV`                    | No          | `development`                    | Entorno de ejecución.                                      |
| `DB_USER`                     | **Sí**      | —                                | Usuario de PostgreSQL.                                     |
| `DB_PASSWORD`                 | **Sí**      | —                                | Contraseña de PostgreSQL.                                  |
| `DB_NAME`                     | **Sí**      | —                                | Nombre de la base de datos (ej: `fococero_reportes`).      |
| `DB_HOST`                     | No          | `db-fococero`                    | Host de PostgreSQL.                                        |
| `DB_PORT`                     | No          | `5432`                           | Puerto de PostgreSQL (Docker).                             |
| `DB_HOST_LOCAL`               | No          | `localhost`                      | Host de PostgreSQL en desarrollo fuera de Docker.          |
| `DB_PORT_LOCAL`               | No          | `5433`                           | Puerto de PostgreSQL en desarrollo fuera de Docker.        |
| `API_GATEWAY_URL`             | No          | `http://localhost:3000`           | URL del API Gateway (para CORS estricto).                  |
| `MULTIMEDIA_SERVICE_URL`      | **Sí**      | —                                | URL del microservicio `ms-multimedia` (ej: `http://ms-multimedia:3005`). |
| `INTERNAL_SECRET_TOKEN`       | **Sí**      | —                                | Token secreto compartido para comunicación entre microservicios. |
| `RABBITMQ_URL`                | No          | `amqp://guest:guest@rabbitmq:5672` | URL de conexión a RabbitMQ.                              |
| `EUREKA_HOST`                 | No          | `localhost`                      | Host del servidor Eureka.                                  |
| `FIREBASE_PROJECT_ID`         | **Sí**      | —                                | ID del proyecto en Firebase.                               |
| `FIREBASE_CLIENT_EMAIL`       | **Sí**      | —                                | Correo de la cuenta de servicio de Firebase.               |
| `FIREBASE_PRIVATE_KEY`        | **Sí**      | —                                | Llave privada de la cuenta de servicio (con `\n` escapados). |

> ⚠️ `FIREBASE_PRIVATE_KEY` debe contener los saltos de línea literales `\n`. El código los transforma automáticamente con `replace(/\\n/g, '\n')`.

---

## Instalación

```bash
cd fococero-backend/ms-reportes
npm install
cp .env.template .env   # Editar con valores correctos
npm run dev              # Desarrollo en http://localhost:3004
```

### Scripts disponibles

| Comando           | Descripción                                    |
|-------------------|------------------------------------------------|
| `npm run dev`     | Inicia el servidor en modo desarrollo con hot-reload (`tsx watch`). |
| `npm run build`   | Compila TypeScript a JavaScript (`dist/`).      |
| `npm start`       | Ejecuta el código compilado en producción.      |
| `npm test`        | Ejecuta los tests con Jest.                    |
| `npm run lint`    | Analiza el código con ESLint.                  |
| `npm run format`  | Formatea el código con Prettier.               |

---

## Endpoints

Todas las rutas (excepto `/api/health` y `/metrics`) requieren autenticación mediante **Firebase ID Token** en el header `Authorization: Bearer <token>`.

### Zona ciudadana — cualquier usuario autenticado

| Método | Ruta                              | Descripción                                      |
|--------|-----------------------------------|--------------------------------------------------|
| `GET`  | `/api/health`                     | Health check del servicio.                       |
| `GET`  | `/metrics`                        | Métricas en formato Prometheus.                  |
| `GET`  | `/categorias`                     | Obtiene todas las categorías de incidentes activas. |
| `GET`  | `/categorias/:id`                 | Obtiene una categoría por su ID.                 |
| `POST` | `/`                               | Crea un nuevo reporte ciudadano.                 |
| `GET`  | `/`                               | Lista global de reportes (con paginación y filtros). |
| `GET`  | `/me`                             | Lista los reportes creados por el usuario autenticado. |
| `GET`  | `/:id`                            | Obtiene un reporte por su ID.                    |
| `PATCH`| `/:id`                            | Actualiza parcialmente un reporte (solo dueño o admin). |
| `DELETE`| `/:id`                           | Elimina un reporte (solo dueño o admin).         |

### Zona operativa — requiere rol `admin` o `brigadista`

| Método | Ruta                              | Descripción                                      |
|--------|-----------------------------------|--------------------------------------------------|
| `GET`  | `/:id/historial`                  | Trazabilidad completa de cambios de estado.      |
| `PATCH`| `/:id/estado`                     | Cambia el estado operativo del reporte.          |

### Parámetros de consulta comunes

| Parámetro    | Ubicación  | Tipo     | Descripción                                  |
|-------------|------------|----------|----------------------------------------------|
| `limit`     | query      | `number` | Cantidad de resultados por página (default: 10). |
| `offset`    | query      | `number` | Desplazamiento para paginación (default: 0).  |
| `estado`    | query      | `string` | Filtro por estado (`PENDIENTE`, `EN_PROCESO`, `RESUELTO`, `FALSA_ALARMA`). |
| `categoria_id` | query   | `string` | Filtro por ID de categoría.                  |

### Estados posibles de un reporte

```
PENDIENTE  ──► EN_PROCESO  ──► RESUELTO
                                 FALSA_ALARMA
```

Los estados `RESUELTO` y `FALSA_ALARMA` son terminales: un reporte cerrado no puede volver a `PENDIENTE`.

### Ejemplos

**Crear reporte:**
```bash
curl -X POST http://localhost:3000/api/reportes/ \
  -H "Authorization: Bearer <FIREBASE_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "categoria_id": "550e8400-e29b-41d4-a716-446655440000",
    "titulo": "Humo en cerro San Cristóbal",
    "descripcion": "Se observa columna de humo blanco en la ladera norte.",
    "latitud": -33.425,
    "longitud": -70.633,
    "direccion": "Cerro San Cristóbal, Santiago"
  }'
```

**Cambiar estado (brigadista/admin):**
```bash
curl -X PATCH http://localhost:3000/api/reportes/<ID>/estado \
  -H "Authorization: Bearer <FIREBASE_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"nuevoEstado": "EN_PROCESO", "comentarios": "Brigada despachada."}'
```

---

## Swagger

La documentación interactiva de la API está disponible en:

```
http://localhost:<PORT>/api/docs
```

Se sirve mediante `swagger-ui-express` usando la especificación OpenAPI definida en `src/docs/swagger.json`.

---

## Seguridad

El microservicio implementa varias capas de seguridad:

| Capa                | Mecanismo                                    |
|---------------------|----------------------------------------------|
| **Autenticación**   | Firebase ID Token verificado con Firebase Admin SDK. |
| **Autorización**    | Middleware `authorizeRole` para rutas operativas (roles `admin`, `brigadista`). |
| **Comunicación interna** | Middleware `internalAuthMiddleware` que valida el token secreto compartido (`INTERNAL_SECRET_TOKEN`). |
| **Headers de seguridad** | Helmet con CSP restrictivo (`default-src: 'self'`). |
| **Rate limiting**   | express-rate-limit: 100 peticiones por ventana de 15 minutos. |
| **CORS**            | Origen restringido a `API_GATEWAY_URL`, `localhost:5173` y `fococero.cl`. |
| **Validación**      | Esquemas Zod que validan body, params y query en cada ruta crítica. |

### Orden de los middleware (crítico)

```
1. Swagger (público)
2. Helmet + CORS + JSON parser + Morgan
3. Rate limiter
4. Health check + Metrics (públicos)
5. internalAuthMiddleware (protege rutas internas)
6. validateFirebaseToken (aplica a TODAS las rutas de reportes — router.use)
7. authorizeRole (solo en rutas operativas)
8. Catch-all 404
9. Error handler global
```

---

## Eureka

Al iniciar, el microservicio se registra en **Eureka Server** con el nombre `ms-reportes`. Esto permite que el API Gateway y otros servicios descubran su ubicación dinámicamente.

```typescript
// src/config/eureka.client.ts
initEurekaClient('ms-reportes', Number(envs.PORT));
```

- **Host por defecto**: `localhost` (configurable con `EUREKA_HOST`).
- Si Eureka no está disponible, el servicio igualmente arranca y funciona (fallo tolerante).

---

## RabbitMQ — Publicación de eventos

`ms-reportes` actúa como **productor** de eventos en el bus de mensajería. Cada vez que un ciudadano crea un reporte, se publica un evento en el exchange `fococero.events`.

### Configuración del exchange

| Propiedad       | Valor               |
|-----------------|---------------------|
| **Exchange**    | `fococero.events`   |
| **Tipo**        | `topic`             |
| **Durable**     | `true`              |

### Eventos publicados

| Routing key                     | Cuándo se publica                     | Payload principal                  |
|---------------------------------|---------------------------------------|-------------------------------------|
| `incidente.reporte.creado`      | Tras crear un reporte exitosamente.   | Datos del reporte con ubicación GeoJSON. |

### Estructura del payload (`incidente.reporte.creado`)

```json
{
  "idExterno": "uuid-del-reporte",
  "origen": "REPORTE",
  "tipo": "uuid-de-categoria",
  "nivelUrgencia": 3,
  "ubicacion": {
    "lat": -33.425,
    "lng": -70.633
  },
  "timestamps": {
    "creadoEn": "2026-06-21T12:00:00.000Z"
  },
  "detallesAdicionales": {
    "titulo": "Humo en cerro San Cristóbal",
    "descripcion": "Se observa columna de humo blanco...",
    "direccion": "Cerro San Cristóbal, Santiago",
    "id_ciudadano": "firebase-uid",
    "estado": "PENDIENTE"
  }
}
```

Este evento es consumido por `ms-analitica` (y potencialmente otros suscriptores) para alimentar dashboards en tiempo real y análisis de patrones de incidentes.

### Reconexión automática

RabbitMQBus implementa un patrón **Singleton** con reconexión automática cada 5 segundos ante fallos, sin perder mensajes (`persistent: true`).

---

## Comunicación entre servicios

| Microservicio       | Tipo          | Método                  | Propósito                                    |
|---------------------|---------------|-------------------------|----------------------------------------------|
| **ms-multimedia**   | HTTP síncrono | `PATCH /:id/vincular`   | Vincula una imagen al reporte creado (usa `x-internal-token`). |
| **ms-analitica**    | Evento asíncrono | RabbitMQ `incidente.reporte.creado` | Notifica nuevo reporte para analytics. |

---

## Base de datos

PostgreSQL con **PostGIS** almacena la ubicación de cada reporte como `geometry(Point, 4326)`. El campo `ubicacion` se genera automáticamente desde `latitud` y `longitud`.

| Tabla                     | Propósito                                    |
|---------------------------|----------------------------------------------|
| `reportes`                | Reportes ciudadanos.                         |
| `categorias_incidente`    | Catálogo de tipos de incidente.              |
| `historial_estados`       | Auditoría de cambios de estado.              |

---

## Contribuir

1. `git checkout -b feat/nombre-cambio`
2. `npm install && npm run dev`
3. Asegurar tests: `npm test`
4. Ejecutar linter: `npm run lint`
5. Abrir Pull Request describiendo el cambio.

---

## Licencia

ISC © FocoCero
