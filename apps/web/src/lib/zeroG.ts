export function zeroGReceiptUrl(indexerBase: string, rootHash: string): string {
  const base = indexerBase.replace(/\/$/, "");
  return `${base}/file?root=${encodeURIComponent(rootHash)}`;
}
