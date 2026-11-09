import { DynamicModule, Global, Module, Provider } from "@nestjs/common"

import { BinancePayService } from "./binance-pay.service"
import { BinanceUserClient } from "./binance-user.client"
import { BINANCE_USER_OPTIONS } from "./binance-user.constants"
import type { BinanceUserModuleAsyncOptions, BinanceUserModuleOptions } from "./binance-user.interfaces"

@Global()
@Module({})
export class BinanceUserModule {
    static forRoot(options: BinanceUserModuleOptions): DynamicModule {
        return this.build([{ provide: BINANCE_USER_OPTIONS, useValue: options }])
    }

    static forRootAsync(options: BinanceUserModuleAsyncOptions): DynamicModule {
        return this.build(
            [{ provide: BINANCE_USER_OPTIONS, useFactory: options.useFactory, inject: options.inject ?? [] }],
            options.imports,
        )
    }

    private static build(optionsProviders: Provider[], imports: DynamicModule["imports"] = []): DynamicModule {
        return {
            module: BinanceUserModule,
            imports,
            providers: [...optionsProviders, BinanceUserClient, BinancePayService],
            exports: [BINANCE_USER_OPTIONS, BinanceUserClient, BinancePayService],
        }
    }
}
