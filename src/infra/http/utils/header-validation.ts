export function formatMissingHeadersMessage(headerNames: string[]): string | undefined {
  const filteredHeaders = headerNames.filter((headerName) => headerName.startsWith('x-'))
  if (filteredHeaders.length === 0) return undefined

  const uniqueHeaders = [...new Set(filteredHeaders)]
  if (uniqueHeaders.length === 1) {
    return `Missing required header: ${uniqueHeaders[0]}`
  }
  return `Missing required headers: ${uniqueHeaders.join(', ')}`
}
