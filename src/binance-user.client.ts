import { createHmac } from "node:crypto"

import { Inject, Injectable } from "@nestjs/common"

import { BINANCE_API_BASE_URL, BINANCE_USER_OPTIONS } from "./binance-user.constants"
import { BinanceApiError } from "./binance-user.errors"
import type { BinanceUserModuleOptions } from "./binance-user.interfaces"

export type BinanceQuery = Record<string, string | number | boolean | undefined>

/** Minimal signed HTTP client for Binance `USER_DATA` endpoints. */
@Injectable()
export class BinanceUserClient {
    constructor(@Inject(BINANCE_USER_OPTIONS) private readonly options: BinanceUserModuleOptions) {}

    sign(queryString: string): string {
        return createHmac("sha256", this.options.apiSecret).update(queryString).digest("hex")
    }

    async signedGet<T>(path: string, query: BinanceQuery = {}): Promise<T> {
        const params = new URLSearchParams()
        for (const [key, value] of Object.entries(query)) {
            if (value !== undefined) params.set(key, String(value))
        }
        params.set("recvWindow", String(this.options.recvWindow ?? 5000))
        params.set("timestamp", String(Date.now()))
        params.set("signature", this.sign(params.toString()))

        const baseUrl = (this.options.baseUrl ?? BINANCE_API_BASE_URL).replace(/\/+$/, "")
        const response = await fetch(`${baseUrl}${path}?${params.toString()}`, {
            method: "GET",
            headers: { "X-MBX-APIKEY": this.options.apiKey },
            signal: AbortSignal.timeout(this.options.timeoutMs ?? 10000),
        })

        const text = await response.text()
        let body: unknown
        try {
            body = text ? JSON.parse(text) : undefined
        } catch {
            body = undefined
        }
        const data = (body ?? {}) as { code?: number | string; msg?: string; message?: string; success?: boolean }

        if (!response.ok) {
            throw new BinanceApiError(
                data.msg ?? data.message ?? (text || response.statusText),
                response.status,
                data.code,
            )
        }
        // Binance Pay (sapi) endpoints can answer 200 with `success: false` on business errors
        if (data.success === false) {
            throw new BinanceApiError(data.message ?? data.msg ?? "Binance request failed", response.status, data.code)
        }
        return body as T
    }
}
