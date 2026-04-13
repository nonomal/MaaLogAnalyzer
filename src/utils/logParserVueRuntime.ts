import { markRaw } from 'vue'
import { setRawValueTransformer } from '@windsland52/maa-log-parser/raw-value'

export const installVueLogParserRuntime = (): void => {
  setRawValueTransformer((value) => {
    if (value != null && typeof value === 'object') {
      return markRaw(value as object) as typeof value
    }
    return value
  })
}
