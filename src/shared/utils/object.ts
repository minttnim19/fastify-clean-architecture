export type UnknownRecord = Record<string, unknown>

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object'
}

export function toRecord(value: unknown): UnknownRecord | undefined {
  return isRecord(value) ? value : undefined
}

export function getStringField(
  source: UnknownRecord | undefined,
  field: string,
): string | undefined {
  return typeof source?.[field] === 'string' ? source[field] : undefined
}

export function getNumberField(
  source: UnknownRecord | undefined,
  field: string,
): number | undefined {
  return typeof source?.[field] === 'number' ? source[field] : undefined
}

export function getBooleanField(
  source: UnknownRecord | undefined,
  field: string,
): boolean | undefined {
  return typeof source?.[field] === 'boolean' ? source[field] : undefined
}
