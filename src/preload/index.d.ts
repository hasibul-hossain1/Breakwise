import type { BreakwiseApi } from './index'

declare global {
  interface Window {
    breakwise: BreakwiseApi
  }
}

export {}
