export function extractInsertedBlockId(result: any): string | null {
  const operations = Array.isArray(result?.data)
    ? result.data.flatMap((item: any) => Array.isArray(item?.doOperations) ? item.doOperations : [])
    : [];

  for (const operation of operations) {
    if (operation?.action === 'insert' && typeof operation.id === 'string' && operation.id.trim()) {
      return operation.id.trim();
    }
  }
  return null;
}
