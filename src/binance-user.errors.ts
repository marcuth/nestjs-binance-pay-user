export class BinanceApiError extends Error {
    constructor(
        message: string,
        readonly status: number,
        /** Binance error `code` (e.g. `-2015`) when present. */
        readonly code?: number | string,
    ) {
        super(message)
        this.name = "BinanceApiError"
    }
}
