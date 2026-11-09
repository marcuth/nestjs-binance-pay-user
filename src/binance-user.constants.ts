export const BINANCE_USER_OPTIONS = Symbol("BINANCE_USER_OPTIONS")

export const BINANCE_API_BASE_URL = "https://api.binance.com"
export const BINANCE_PAY_TRANSACTIONS_PATH = "/sapi/v1/pay/transactions"

/** Binance Pay history only goes back 90 days and a single query can span at most 90 days. */
export const BINANCE_PAY_MAX_WINDOW_MS = 90 * 24 * 60 * 60 * 1000
export const BINANCE_PAY_MAX_LIMIT = 100
