# nestjs-binance-user

[![npm](https://img.shields.io/npm/v/nestjs-binance-user)](https://www.npmjs.com/package/nestjs-binance-user)
[![license](https://img.shields.io/npm/l/nestjs-binance-user)](./LICENSE)

A [NestJS](https://nestjs.com) module for the Binance user API, focused on querying **Binance Pay** transactions and
**verifying received payments by transaction ID**. It has no runtime dependencies (it uses the global `fetch`).

- Signed (HMAC-SHA256) client for `USER_DATA` endpoints, injectable with `@InjectBinanceUser()`
- `BinancePayService` with transaction listing, lookup by ID, payment verification and polling
- `forRoot` and `forRootAsync` configuration

## Installation

```bash
npm install nestjs-binance-user @nestjs/common reflect-metadata rxjs
```

Requires Node.js >= 18 and NestJS 10, 11 or 12. Create an API key with **Enable Reading** only.

## Setup

```ts
import { Module } from "@nestjs/common"
import { BinanceUserModule } from "nestjs-binance-user"

@Module({
    imports: [
        BinanceUserModule.forRoot({
            apiKey: process.env.BINANCE_API_KEY!,
            apiSecret: process.env.BINANCE_API_SECRET!,
        }),
    ],
})
export class AppModule {}
```

Async configuration:

```ts
BinanceUserModule.forRootAsync({
    imports: [ConfigModule],
    inject: [ConfigService],
    useFactory: (config: ConfigService) => ({
        apiKey: config.getOrThrow("BINANCE_API_KEY"),
        apiSecret: config.getOrThrow("BINANCE_API_SECRET"),
    }),
})
```

The module is global.

### Options

| Option       | Description                          | Default                   |
| ------------ | ------------------------------------ | ------------------------- |
| `apiKey`     | API key (read permission).           | —                         |
| `apiSecret`  | Secret used to sign requests.        | —                         |
| `baseUrl`    | Binance API base URL.                | `https://api.binance.com` |
| `recvWindow` | `recvWindow` of signed requests, ms. | `5000`                    |
| `timeoutMs`  | Request timeout, ms.                 | `10000`                   |

## Verifying a payment

```ts
import { Injectable } from "@nestjs/common"
import { BinancePayService } from "nestjs-binance-user"

@Injectable()
export class CheckoutService {
    constructor(private readonly pay: BinancePayService) {}

    async confirm(transactionId: string) {
        const result = await this.pay.verifyPayment({
            transactionId,
            amount: "25.5",
            currency: "USDT",
            orderTypes: ["PAY", "C2C"], // optional
        })
        // result.status: "paid" | "not_found" | "not_received" | "amount_mismatch"
        //              | "currency_mismatch" | "order_type_mismatch"
        return result.paid
    }
}
```

| Method                                 | Description                                                                       |
| -------------------------------------- | --------------------------------------------------------------------------------- |
| `getTransactionsPage(params?)`         | One request to `GET /sapi/v1/pay/transactions` (max 100 records).                 |
| `getTransactions(params?)`             | Whole window, newest first; walks back when a page is full and deduplicates.      |
| `findTransaction({ transactionId })`   | Scans the history until the ID is found, or returns `undefined`.                  |
| `verifyPayment(params)`                | Found + received (amount > 0) + optional amount, currency and order type checks.  |
| `waitForPayment({ intervalMs, ... })`  | Polls `verifyPayment` until the transaction shows up or `timeoutMs` elapses.      |

Notes:

- Binance cannot filter by transaction ID, so lookups scan the history (default window: last 90 days, the maximum
  Binance keeps). Pass `startTimestamp`/`endTimestamp` to narrow it.
- Only received payments count: sent transactions have a negative `amount` and yield `not_received`.
- Amounts are compared with a tolerance of `1e-8`; use `allowOverpayment: true` to accept larger amounts.
- Binance Pay has no webhook for personal history, so use `waitForPayment` or your own polling.
- Errors are thrown as `BinanceApiError` (`status`, `code`).

## Using the client

```ts
constructor(@InjectBinanceUser() private readonly client: BinanceUserClient) {}

account() {
    return this.client.signedGet("/api/v3/account")
}
```

## Development

```bash
npm run format      # prettier
npm run lint:fix    # eslint --fix
npm test            # vitest
npm run test:cov    # coverage
npm run build       # tsc
```

## License

MIT © Marcuth
