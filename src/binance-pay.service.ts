import { Inject, Injectable } from "@nestjs/common"

import { BinanceUserClient } from "./binance-user.client"
import {
    BINANCE_PAY_MAX_LIMIT,
    BINANCE_PAY_MAX_WINDOW_MS,
    BINANCE_PAY_TRANSACTIONS_PATH,
} from "./binance-user.constants"
import type {
    BinancePayTransaction,
    BinancePayVerification,
    FindBinancePayTransactionParams,
    GetBinancePayTransactionsParams,
    VerifyBinancePayPaymentParams,
    WaitForBinancePayPaymentParams,
} from "./binance-user.interfaces"

interface PayTransactionsResponse {
    code?: string
    message?: string
    data?: BinancePayTransaction[]
    success?: boolean
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

@Injectable()
export class BinancePayService {
    constructor(@Inject(BinanceUserClient) private readonly client: BinanceUserClient) {}

    /** Single request to `GET /sapi/v1/pay/transactions` (at most 100 records). */
    async getTransactionsPage(params: GetBinancePayTransactionsParams = {}): Promise<BinancePayTransaction[]> {
        const response = await this.client.signedGet<PayTransactionsResponse>(BINANCE_PAY_TRANSACTIONS_PATH, {
            startTimestamp: params.startTimestamp,
            endTimestamp: params.endTimestamp,
            limit: Math.min(params.limit ?? BINANCE_PAY_MAX_LIMIT, BINANCE_PAY_MAX_LIMIT),
        })
        return response.data ?? []
    }

    /**
     * All transactions in the window (newest first). The endpoint has no cursor, so when a page is full
     * the window is moved back to the oldest record and the query is repeated (results are deduplicated).
     */
    async getTransactions(params: GetBinancePayTransactionsParams = {}): Promise<BinancePayTransaction[]> {
        const limit = Math.min(params.limit ?? BINANCE_PAY_MAX_LIMIT, BINANCE_PAY_MAX_LIMIT)
        const end = params.endTimestamp ?? Date.now()
        const start = params.startTimestamp ?? end - BINANCE_PAY_MAX_WINDOW_MS

        const all = new Map<string, BinancePayTransaction>()
        let cursorEnd = end

        for (;;) {
            const page = await this.getTransactionsPage({ startTimestamp: start, endTimestamp: cursorEnd, limit })
            const before = all.size
            for (const transaction of page) all.set(String(transaction.transactionId), transaction)

            if (page.length < limit || all.size === before) break

            const oldest = Math.min(...page.map((transaction) => transaction.transactionTime))
            if (oldest >= cursorEnd || oldest <= start) break
            cursorEnd = oldest
        }

        return [...all.values()].sort((a, b) => b.transactionTime - a.transactionTime)
    }

    /**
     * Finds a transaction by ID. Binance does not support filtering by ID, so the history of the
     * window (default: last 90 days) is scanned, stopping as soon as the transaction is found.
     */
    async findTransaction(params: FindBinancePayTransactionParams): Promise<BinancePayTransaction | undefined> {
        const end = params.endTimestamp ?? Date.now()
        const start = params.startTimestamp ?? end - BINANCE_PAY_MAX_WINDOW_MS
        let cursorEnd = end

        for (;;) {
            const page = await this.getTransactionsPage({ startTimestamp: start, endTimestamp: cursorEnd })
            const found = page.find((transaction) => String(transaction.transactionId) === params.transactionId)
            if (found) return found

            if (page.length < BINANCE_PAY_MAX_LIMIT) return undefined
            const oldest = Math.min(...page.map((transaction) => transaction.transactionTime))
            if (oldest >= cursorEnd || oldest <= start) return undefined
            cursorEnd = oldest
        }
    }

    /** Checks that a payment with this transaction ID was received (and optionally matches amount/currency). */
    async verifyPayment(params: VerifyBinancePayPaymentParams): Promise<BinancePayVerification> {
        const transaction = await this.findTransaction(params)
        if (!transaction) return { paid: false, status: "not_found" }

        const received = Number(transaction.amount)
        if (!Number.isFinite(received) || received <= 0) {
            return { paid: false, status: "not_received", transaction }
        }
        if (params.orderTypes && !params.orderTypes.includes(transaction.orderType)) {
            return { paid: false, status: "order_type_mismatch", transaction }
        }
        if (params.currency && transaction.currency.toUpperCase() !== params.currency.toUpperCase()) {
            return { paid: false, status: "currency_mismatch", transaction }
        }
        if (params.amount !== undefined) {
            const diff = received - Number(params.amount)
            const ok = params.allowOverpayment ? diff > -1e-8 : Math.abs(diff) < 1e-8
            if (!ok) return { paid: false, status: "amount_mismatch", transaction }
        }
        return { paid: true, status: "paid", transaction }
    }

    /** Polls `verifyPayment` until the transaction appears (or the timeout elapses). */
    async waitForPayment(params: WaitForBinancePayPaymentParams): Promise<BinancePayVerification> {
        const { intervalMs = 5000, timeoutMs = 300000, ...verify } = params
        const deadline = Date.now() + timeoutMs

        for (;;) {
            const result = await this.verifyPayment(verify)
            if (result.status !== "not_found" || Date.now() + intervalMs > deadline) return result
            await sleep(intervalMs)
        }
    }
}
