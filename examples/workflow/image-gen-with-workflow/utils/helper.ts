import { REDIS_PREFIX } from './constants'

export const costCalc = (time = 0, isWorkflow = false) => {
  return 0.00_005 * (time / 1000) + (isWorkflow ? 0.00004 : 0)
}

export const generateCallKey = () => {
  return `${REDIS_PREFIX}-${Math.ceil(Math.random() * 1000000)}`
}
