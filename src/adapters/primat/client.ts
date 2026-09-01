import type { PortCallOptions } from "@/ports";
import type { PrimatProductsResponse, PrimatResolveResponse } from "./types";

const BASE_URL = "https://primat.nu/api/v3/";
const CACHE_TTL_MS = 5 * 60_000;
const CALL_TIMEOUT_MS = 8_000;
export const PRIMAT_ATTRIBUTION = { text: "Prisdata från primat.nu", url: "https://primat.nu" } as const;

interface CacheEntry<T> { readonly expiresAt: number; readonly value: T }
export class PrimatClient {
  private readonly cache = new Map<string, CacheEntry<unknown>>();
  private readonly seenProducts = new Map<string, import("./types").PrimatProduct>();
  constructor(private readonly apiKey = process.env.PRIMAT_API_KEY, private readonly fetcher: typeof fetch = fetch) {}

  private async get<T>(path: string, options: PortCallOptions): Promise<T> {
    const remaining = options.deadlineAt - options.clock.now();
    if (remaining <= 0) throw new Error("Primat request deadline exceeded");
    const cached = this.cache.get(path) as CacheEntry<T> | undefined;
    if (cached && cached.expiresAt > options.clock.now()) return cached.value;
    if (!this.apiKey) throw new Error("Primat is unavailable: missing API configuration");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), Math.min(remaining, CALL_TIMEOUT_MS));
    try {
      const response = await this.fetcher(new URL(path, BASE_URL), { headers: { Authorization: `Bearer ${this.apiKey}`, Accept: "application/json" }, signal: controller.signal });
      if (!response.ok) throw new Error(`Primat request failed (${response.status})`);
      const value = await response.json() as T;
      this.cache.set(path, { value, expiresAt: options.clock.now() + CACHE_TTL_MS });
      return value;
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("Primat request failed")) throw error;
      throw new Error("Primat request failed");
    } finally { clearTimeout(timeout); }
  }

  resolve(place: string, options: PortCallOptions) { return this.get<PrimatResolveResponse>(`stores/resolve?place=${encodeURIComponent(place)}`, options); }
  products(query: string, stores: readonly string[], options: PortCallOptions) {
    const params = new URLSearchParams({ q: query, stores: stores.join(",") });
    return this.get<PrimatProductsResponse>(`products?${params}`, options).then((response) => {
      for (const product of response.data) this.seenProducts.set(`${product.chain}:${product.store_id}:${product.product_id}`, product);
      return response;
    });
  }
  observedProducts(storeKey: string, productIds: readonly string[]) {
    return productIds.map((id) => this.seenProducts.get(`${storeKey}:${id}`)).filter((item): item is import("./types").PrimatProduct => item !== undefined);
  }
}
