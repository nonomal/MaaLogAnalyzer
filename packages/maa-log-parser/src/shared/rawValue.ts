type RawValueTransformer = <T>(value: T) => T

const identityRawValueTransformer: RawValueTransformer = <T>(value: T) => value

let currentRawValueTransformer: RawValueTransformer = identityRawValueTransformer

export const setRawValueTransformer = (transformer?: RawValueTransformer): void => {
  currentRawValueTransformer = transformer ?? identityRawValueTransformer
}

export const resetRawValueTransformer = (): void => {
  currentRawValueTransformer = identityRawValueTransformer
}

export const wrapRaw = <T>(value: T): T => {
  return currentRawValueTransformer(value)
}
