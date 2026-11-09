import { Inject } from "@nestjs/common"

import { BinanceUserClient } from "./binance-user.client"

/** Injects the signed `BinanceUserClient`. */
export const InjectBinanceUser = () => Inject(BinanceUserClient)
