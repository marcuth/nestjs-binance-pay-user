import "reflect-metadata"

import { createHmac } from "node:crypto"

import { Test } from "@nestjs/testing"
import { afterEach, describe, expect, it, vi } from "vitest"

import { BinanceApiError, BinancePayService, BinanceUserClient, BinanceUserModule } from "../src"

const tx = (id: string, time: number, amount = "10") => ({
    orderType: "PAY",
    transactionId: id,
    transactionTime: time,
    amount,
    currency: "USDT",
})

function mockFetch(handler: (url: URL) => unknown, status = 200) {
    const fn = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        void init
        const body = handler(new URL(String(input)))
        return new Response(JSON.stringify(body), { status })
    })
    vi.stubGlobal("fetch", fn)
    return fn
}

async function setup() {
    const moduleRef = await Test.createTestingModule({
        imports: [BinanceUserModule.forRoot({ apiKey: "key", apiSecret: "secret" })],
    }).compile()
    return { pay: moduleRef.get(BinancePayService), client: moduleRef.get(BinanceUserClient) }
}

afterEach(() => vi.unstubAllGlobals())

describe("BinanceUserClient", () => {
    it("signs the query and sends the api key", async () => {
        const fetchMock = mockFetch(() => ({ code: "000000", success: true, data: [] }))
        const { client } = await setup()
        await client.signedGet("/sapi/v1/pay/transactions", { limit: 5 })

        const [input, init] = fetchMock.mock.calls[0]
        const url = new URL(String(input))
        const signature = url.searchParams.get("signature")
        url.searchParams.delete("signature")
        expect(signature).toBe(createHmac("sha256", "secret").update(url.searchParams.toString()).digest("hex"))
        expect((init?.headers as Record<string, string>)["X-MBX-APIKEY"]).toBe("key")
    })

    it("throws BinanceApiError on http and business errors", async () => {
        const { client } = await setup()
        mockFetch(() => ({ code: -2015, msg: "Invalid API-key" }), 401)
        await expect(client.signedGet("/x")).rejects.toMatchObject({ status: 401, code: -2015 })

        mockFetch(() => ({ code: "400002", message: "bad", success: false }))
        await expect(client.signedGet("/x")).rejects.toBeInstanceOf(BinanceApiError)
    })
})

describe("BinancePayService", () => {
    it("finds a transaction by id and verifies it", async () => {
        mockFetch(() => ({ success: true, data: [tx("A1", 2000), tx("B2", 1000, "25.5")] }))
        const { pay } = await setup()

        expect(await pay.verifyPayment({ transactionId: "B2", amount: "25.5", currency: "usdt" })).toMatchObject({
            paid: true,
            status: "paid",
        })
        expect((await pay.verifyPayment({ transactionId: "B2", amount: 30 })).status).toBe("amount_mismatch")
        expect((await pay.verifyPayment({ transactionId: "B2", amount: 20, allowOverpayment: true })).paid).toBe(true)
        expect((await pay.verifyPayment({ transactionId: "B2", currency: "BTC" })).status).toBe("currency_mismatch")
        expect((await pay.verifyPayment({ transactionId: "B2", orderTypes: ["C2C"] })).status).toBe(
            "order_type_mismatch",
        )
        expect((await pay.verifyPayment({ transactionId: "ZZ" })).status).toBe("not_found")
    })

    it("does not accept sent (negative) transactions", async () => {
        mockFetch(() => ({ success: true, data: [tx("S1", 1000, "-5")] }))
        const { pay } = await setup()
        expect((await pay.verifyPayment({ transactionId: "S1" })).status).toBe("not_received")
    })

    it("walks the history back when a page is full", async () => {
        const fetchMock = mockFetch((url) => {
            const end = Number(url.searchParams.get("endTimestamp"))
            if (end > 4100) {
                return { success: true, data: Array.from({ length: 100 }, (_, i) => tx(`T${i}`, 5000 - i * 10)) }
            }
            return { success: true, data: [tx("OLD", 900)] }
        })
        const { pay } = await setup()

        const found = await pay.findTransaction({ transactionId: "OLD", startTimestamp: 0, endTimestamp: 6000 })
        expect(found?.transactionId).toBe("OLD")
        expect(fetchMock).toHaveBeenCalledTimes(2)

        const all = await pay.getTransactions({ startTimestamp: 0, endTimestamp: 6000 })
        expect(all).toHaveLength(101)
        expect(all[0].transactionTime).toBeGreaterThan(all[100].transactionTime)
    })

    it("waitForPayment polls until the transaction shows up", async () => {
        let calls = 0
        mockFetch(() => ({ success: true, data: ++calls < 3 ? [] : [tx("W1", 1000)] }))
        const { pay } = await setup()
        const result = await pay.waitForPayment({ transactionId: "W1", intervalMs: 1, timeoutMs: 1000 })
        expect(result.paid).toBe(true)
        expect(calls).toBe(3)
    })

    it("waitForPayment returns not_found after the timeout", async () => {
        mockFetch(() => ({ success: true, data: [] }))
        const { pay } = await setup()
        const result = await pay.waitForPayment({ transactionId: "N", intervalMs: 5, timeoutMs: 10 })
        expect(result.status).toBe("not_found")
    })
})
