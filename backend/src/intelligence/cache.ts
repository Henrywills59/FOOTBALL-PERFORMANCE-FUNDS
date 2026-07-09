import type { CacheStore } from "./types.js";
import { intelligenceLogger } from "./logger.js";

type CacheEntry = {
  expiresAt: number;
  value: unknown;
};

export class MemoryCacheStore implements CacheStore {
  private readonly entries = new Map<string, CacheEntry>();

  async get<T>(key: string): Promise<T | null> {
    const entry = this.entries.get(key);
    if (!entry) {
      intelligenceLogger.cacheMiss(key);
      return null;
    }

    if (entry.expiresAt <= Date.now()) {
      this.entries.delete(key);
      intelligenceLogger.cacheMiss(key);
      return null;
    }

    return entry.value as T;
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    this.entries.set(key, {
      expiresAt: Date.now() + ttlSeconds * 1000,
      value,
    });
  }

  async delete(key: string): Promise<void> {
    this.entries.delete(key);
  }
}

export class RedisCompatibleCacheStore implements CacheStore {
  async get<T>(_key: string): Promise<T | null> {
    return null;
  }

  async set<T>(_key: string, _value: T, _ttlSeconds: number): Promise<void> {}

  async delete(_key: string): Promise<void> {}
}

