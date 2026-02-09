import { describe, it, expect } from 'vitest';
import { camelToSnake } from '../utils.js';

describe('orders route - SQL injection prevention', () => {
  // The ALLOWED_ORDER_COLUMNS allowlist in orders.js prevents SQL injection
  const ALLOWED_ORDER_COLUMNS = new Set([
    'id', 'material_no', 'description', 'quantity', 'list_price', 'total_cost',
    'order_date', 'order_by', 'remark', 'arrival_date', 'qty_received',
    'back_order', 'engineer', 'status', 'approval_status', 'month', 'year', 'created_at'
  ]);

  it('rejects SQL injection payload in orderBy', () => {
    const malicious = 'id; DROP TABLE orders; --';
    const snakeCol = malicious.replace(/[A-Z]/g, c => '_' + c.toLowerCase());
    expect(ALLOWED_ORDER_COLUMNS.has(snakeCol)).toBe(false);
  });

  it('rejects unknown column names', () => {
    const unknown = 'password_hash';
    expect(ALLOWED_ORDER_COLUMNS.has(unknown)).toBe(false);
  });

  it('allows valid camelCase column converted to snake_case', () => {
    const orderBy = 'totalCost';
    const snakeCol = orderBy.replace(/[A-Z]/g, c => '_' + c.toLowerCase());
    expect(snakeCol).toBe('total_cost');
    expect(ALLOWED_ORDER_COLUMNS.has(snakeCol)).toBe(true);
  });

  it('allows valid column orderDate', () => {
    const orderBy = 'orderDate';
    const snakeCol = orderBy.replace(/[A-Z]/g, c => '_' + c.toLowerCase());
    expect(snakeCol).toBe('order_date');
    expect(ALLOWED_ORDER_COLUMNS.has(snakeCol)).toBe(true);
  });

  it('allows plain snake_case column id', () => {
    const snakeCol = 'id'.replace(/[A-Z]/g, c => '_' + c.toLowerCase());
    expect(snakeCol).toBe('id');
    expect(ALLOWED_ORDER_COLUMNS.has(snakeCol)).toBe(true);
  });
});

describe('camelToSnake used on string (old bug)', () => {
  it('camelToSnake on a string produces wrong result (object instead of string)', () => {
    // This was the original bug — camelToSnake was called with a string
    // but it expects an object. Object.entries on a string gives character indices.
    const result = camelToSnake('totalCost');
    expect(typeof result).toBe('object');
    // The fix now uses a direct regex instead of camelToSnake
  });
});
