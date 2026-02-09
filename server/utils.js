export function snakeToCamel(row) {
  if (!row) return row;
  const result = {};
  for (const [key, value] of Object.entries(row)) {
    const camelKey = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    result[camelKey] = value;
  }
  return result;
}

export function camelToSnake(obj) {
  if (!obj) return obj;
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    const snakeKey = key.replace(/[A-Z]/g, c => '_' + c.toLowerCase());
    result[snakeKey] = value;
  }
  return result;
}
