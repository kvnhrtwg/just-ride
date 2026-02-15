type FitDownloadPayload = {
  fileName: string
  contentBase64: string
}

export function downloadFitFile({
  fileName,
  contentBase64,
}: FitDownloadPayload): void {
  const fitBytes = decodeBase64ToArrayBuffer(contentBase64)
  const blob = new Blob([fitBytes], { type: 'application/octet-stream' })
  const downloadUrl = window.URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = downloadUrl
  anchor.download = fileName
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  window.URL.revokeObjectURL(downloadUrl)
}

function decodeBase64ToArrayBuffer(encoded: string): ArrayBuffer {
  const decoded = window.atob(encoded)
  const bytes = new Uint8Array(decoded.length)
  for (let index = 0; index < decoded.length; index += 1) {
    bytes[index] = decoded.charCodeAt(index)
  }
  return bytes.buffer
}
