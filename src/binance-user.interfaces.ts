import type { ModuleMetadata, Type } from "@nestjs/common"

export interface BinanceUserModuleOptions {
    /** API key with "Enable Reading" permission. */
    apiKey: string
    /** API secret used to sign requests (HMAC-SHA256). */
    apiSecret: string
    /**
     * Base URL of the Binance API.
     * @default "https://api.binance.com"
     */
    baseUrl?: string
    /**
     * `recvWindow` sent with signed requests, in milliseconds.
     * @default 5000
     */
    recvWindow?: number
    /**
     * Request timeout in milliseconds.
     * @default 10000
     */
    timeoutMs?: number
}

export interface BinanceUserModuleAsyncOptions extends Pick<ModuleMetadata, "imports"> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useFactory: (...args: any[]) => BinanceUserModuleOptions | Promise<BinanceUserModuleOptions>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    inject?: (Type<any> | string | symbol)[]
}

export interface BinancePayParty {
    name?: string
    type?: string
    binanceId?: string
    accountId?: string
    [key: string]: unknown
}

export interface BinancePayFundsDetail {
    currency: string
    amount: string
    walletAssetCost?: unknown
    [key: string]: unknown
}

export interface BinancePayTransaction {
    /** e.g. `PAY`, `PAY_REFUND`, `C2C`, `CRYPTO_BOX`, `CRYPTO_BOX_RE`, `REMITTANCE`... */
    orderType: string
    transactionId: string
    /** Unix time in milliseconds. */
    transactionTime: number
    /** Positive when received, negative when sent. */
    amount: string
    currency: string
    walletType?: number
    fundsDetail?: BinancePayFundsDetail[]
    payerInfo?: BinancePayParty
    receiverInfo?: BinancePayParty
    [key: string]: unknown
}

export interface GetBinancePayTransactionsParams {
    /** Unix time in ms. Defaults to `endTimestamp` minus 90 days. */
    startTimestamp?: number
    /** Unix time in ms. Defaults to now. */
    endTimestamp?: number
    /** Page size, 1-100. @default 100 */
    limit?: number
}

export interface FindBinancePayTransactionParams {
    transactionId: string
    /** Start of the search window, unix ms. @default endTimestamp - 90 days */
    startTimestamp?: number
    /** End of the search window, unix ms. @default now */
    endTimestamp?: number
}

export type BinancePayVerificationStatus =
    "paid" | "not_found" | "not_received" | "amount_mismatch" | "currency_mismatch" | "order_type_mismatch"

export interface VerifyBinancePayPaymentParams extends FindBinancePayTransactionParams {
    /** Expected amount. When set, the received amount must match it (see `allowOverpayment`). */
    amount?: number | string
    /** Expected currency (e.g. `USDT`). Case-insensitive. */
    currency?: string
    /** Accepted order types (e.g. `["PAY", "C2C"]`). Any type is accepted when omitted. */
    orderTypes?: string[]
    /** Accepts an amount greater than `amount`. @default false */
    allowOverpayment?: boolean
}

export interface BinancePayVerification {
    paid: boolean
    status: BinancePayVerificationStatus
    transaction?: BinancePayTransaction
}

export interface WaitForBinancePayPaymentParams extends VerifyBinancePayPaymentParams {
    /** Delay between checks in ms. @default 5000 */
    intervalMs?: number
    /** Gives up after this many ms. @default 300000 */
    timeoutMs?: number
}
