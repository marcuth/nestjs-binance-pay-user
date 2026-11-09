import { defineConfig } from "vitest/config"

export default defineConfig({
    oxc: {
        decorator: {
            legacy: true,
            emitDecoratorMetadata: true,
        },
    },
    test: {
        coverage: {
            include: ["src/**/*.ts"],
            // barrel file and type-only declarations have no runtime code
            exclude: ["src/index.ts", "src/binance-user.interfaces.ts"],
        },
    },
})
