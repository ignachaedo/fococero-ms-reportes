// ms-reportes/src/config/rabbitmq.ts

import { connect, ChannelModel, Channel } from 'amqplib';
import { envs } from './envs';
import { logger } from './logger';

class RabbitMQBus {
  private static instance: RabbitMQBus;
  private connection: ChannelModel | null = null;
  private channel: Channel | null = null;
  private isConnecting = false;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;

  private constructor() {}

  public static getInstance(): RabbitMQBus {
    if (!RabbitMQBus.instance) {
      RabbitMQBus.instance = new RabbitMQBus();
    }
    return RabbitMQBus.instance;
  }

  public async connect(): Promise<void> {
    if (this.isConnecting || (this.connection && this.channel)) return;
    this.isConnecting = true;

    try {
      const conn = await connect(envs.RABBITMQ_URL);
      const ch = await conn.createChannel();

      conn.on('error', (err: unknown) => {
        logger.error({ err }, '[RabbitMQ] Error de conexión');
        this.scheduleReconnect();
      });

      conn.on('close', () => {
        logger.warn('[RabbitMQ] Conexión cerrada. Reconectando...');
        this.scheduleReconnect();
      });

      ch.on('error', (err: unknown) => {
        logger.error({ err }, '[RabbitMQ] Error en el canal');
        this.scheduleReconnect();
      });

      ch.on('close', () => {
        logger.warn('[RabbitMQ] Canal cerrado. Reconectando...');
        this.scheduleReconnect();
      });

      this.connection = conn;
      this.channel = ch;

      logger.info('[RabbitMQ] Conectado exitosamente');
    } catch (error: unknown) {
      logger.error({ err: error }, '[RabbitMQ] Falla inicial. Reintentando...');
      this.scheduleReconnect();
    } finally {
      this.isConnecting = false;
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    if (this.connection) {
      this.connection.close().catch(() => {});
    }

    this.connection = null;
    this.channel = null;

    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null;
      this.connect().catch((err: unknown) => {
        logger.error({ err }, 'Error crítico al reconectar RabbitMQ');
      });
    }, 5000);
  }

  public async close(): Promise<void> {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    try {
      if (this.channel) {
        await this.channel.close();
      }
      if (this.connection) {
        await this.connection.close();
      }
    } catch (err: unknown) {
      logger.error({ err }, '[RabbitMQ] Error al cerrar conexión');
    } finally {
      this.channel = null;
      this.connection = null;
    }
  }

  public getChannel(): Channel {
    if (!this.channel) {
      throw new Error('RabbitMQ Channel no inicializado. Llama a connect() primero.');
    }
    return this.channel;
  }

  public async publishEvent(
    exchange: string,
    routingKey: string,
    payload: object,
  ): Promise<void> {
    const channel = this.getChannel();

    await channel.assertExchange(exchange, 'topic', { durable: true });

    const buffer = Buffer.from(JSON.stringify(payload));

    const published = channel.publish(exchange, routingKey, buffer, {
      persistent: true,
      contentType: 'application/json',
    });

    if (!published) {
      logger.warn(
        { exchange, routingKey },
        '[RabbitMQ] Publicación en pausa (backpressure)',
      );
    } else {
      logger.debug(
        { exchange, routingKey },
        '[RabbitMQ] Evento publicado exitosamente',
      );
    }
  }
}

export const rabbitMQBus = RabbitMQBus.getInstance();
