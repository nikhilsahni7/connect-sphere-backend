import { Redis } from 'ioredis';
import { config } from '../config';

class RedisService {
  private readonly client: Redis;
  private readonly subscriber: Redis;
  private readonly publisher: Redis;
  private readonly prefix: string;

  constructor() {
    this.prefix = config.redis.prefix;

    const redisOptions: any = {
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password || undefined,
      retryStrategy: (times: number) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    };

    // Main client for general operations
    this.client = new Redis(redisOptions);

    // Dedicated client for subscriptions
    this.subscriber = new Redis(redisOptions);

    // Dedicated client for publishing
    this.publisher = new Redis(redisOptions);

    this.handleEvents();
  }

  private handleEvents() {
    this.client.on('error', (err) => {
      console.error('Redis Client Error:', err);
    });

    this.subscriber.on('error', (err) => {
      console.error('Redis Subscriber Error:', err);
    });

    this.publisher.on('error', (err) => {
      console.error('Redis Publisher Error:', err);
    });

    this.client.on('connect', () => {
      console.log('Redis Client Connected');
    });
  }

  // Key management
  private getKey(key: string): string {
    return `${this.prefix}${key}`;
  }

  // Cache operations
  async set(key: string, value: any, expireSeconds?: number): Promise<void> {
    const prefixedKey = this.getKey(key);
    const stringValue = typeof value === 'object' ? JSON.stringify(value) : String(value);

    if (expireSeconds) {
      await this.client.setex(prefixedKey, expireSeconds, stringValue);
    } else {
      await this.client.set(prefixedKey, stringValue);
    }
  }

  async get<T>(key: string): Promise<T | null> {
    const prefixedKey = this.getKey(key);
    const value = await this.client.get(prefixedKey);
    if (!value) return null;

    try {
      return JSON.parse(value) as T;
    } catch {
      return value as unknown as T;
    }
  }

  async delete(key: string): Promise<void> {
    const prefixedKey = this.getKey(key);
    await this.client.del(prefixedKey);
  }

  async exists(key: string): Promise<boolean> {
    const prefixedKey = this.getKey(key);
    const result = await this.client.exists(prefixedKey);
    return result === 1;
  }

  // List operations
  async listPush(key: string, value: any): Promise<void> {
    const prefixedKey = this.getKey(key);
    const stringValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
    await this.client.rpush(prefixedKey, stringValue);
  }

  async listRange<T>(key: string, start: number, end: number): Promise<T[]> {
    const prefixedKey = this.getKey(key);
    const values = await this.client.lrange(prefixedKey, start, end);

    return values.map((value) => {
      try {
        return JSON.parse(value) as T;
      } catch {
        return value as unknown as T;
      }
    });
  }

  // Pub/Sub operations
  async publish(channel: string, message: any): Promise<void> {
    const prefixedChannel = this.getKey(channel);
    const stringMessage = typeof message === 'object' ? JSON.stringify(message) : String(message);
    await this.publisher.publish(prefixedChannel, stringMessage);
  }

  async subscribe(channel: string, callback: (message: any) => void): Promise<void> {
    const prefixedChannel = this.getKey(channel);
    await this.subscriber.subscribe(prefixedChannel);

    this.subscriber.on('message', (subscribedChannel, message) => {
      if (subscribedChannel === prefixedChannel) {
        try {
          const parsedMessage = JSON.parse(message);
          callback(parsedMessage);
        } catch {
          callback(message);
        }
      }
    });
  }

  async unsubscribe(channel: string): Promise<void> {
    const prefixedChannel = this.getKey(channel);
    await this.subscriber.unsubscribe(prefixedChannel);
  }

  // Event channels
  getEventRSVPChannel(eventId: string): string {
    return `event:${eventId}:rsvp`;
  }

  getEventChatChannel(eventId: string): string {
    return `event:${eventId}:chat`;
  }

  getEventPollChannel(eventId: string): string {
    return `event:${eventId}:poll`;
  }

  getEventParticipantChannel(eventId: string): string {
    return `event:${eventId}:participant`;
  }

  // Test connection
  async ping(): Promise<string> {
    return this.client.ping();
  }
}

// Singleton instance
export const redisService = new RedisService();
