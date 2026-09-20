import { describe, it, expect } from 'vitest';
import { paginate, rangeLabel, isAllSize, PAGE_SIZE_OPTIONS } from './paginate.js';

const items = Array.from({ length: 125 }, (_, i) => i + 1);

describe('paginate', () => {
  it('slices a 1-based page', () => {
    const r = paginate(items, 2, 50);
    expect(r.pageItems[0]).toBe(51);
    expect(r.pageItems).toHaveLength(50);
    expect(r.from).toBe(51);
    expect(r.to).toBe(100);
    expect(r.totalPages).toBe(3);
  });
  it('clamps a page past the end instead of showing nothing', () => {
    const r = paginate(items, 99, 50);
    expect(r.page).toBe(3);
    expect(r.pageItems).toHaveLength(25);
  });
  it('clamps a page below 1', () => {
    expect(paginate(items, 0, 50).page).toBe(1);
    expect(paginate(items, -5, 50).page).toBe(1);
  });
  it('returns everything for the All size', () => {
    const r = paginate(items, 3, 'All');
    expect(r.pageItems).toHaveLength(125);
    expect(r.totalPages).toBe(1);
    expect(r.page).toBe(1);
  });
  it('handles an empty list', () => {
    const r = paginate([], 1, 50);
    expect(r.total).toBe(0);
    expect(r.from).toBe(0);
    expect(r.to).toBe(0);
    expect(r.totalPages).toBe(1);
  });
  it('tolerates a non-array', () => {
    expect(paginate(null, 1, 25).total).toBe(0);
  });
});

describe('rangeLabel', () => {
  it('describes a partial page', () => {
    expect(rangeLabel(paginate(items, 2, 50), 'orders')).toBe('Showing 51–100 of 125 orders');
  });
  it('drops the range when everything is shown', () => {
    expect(rangeLabel(paginate(items, 1, 'All'), 'parts')).toBe('125 parts');
  });
  it('handles empty', () => {
    expect(rangeLabel(paginate([], 1, 50), 'items')).toBe('No items');
  });
});

describe('isAllSize', () => {
  it('recognises the All option', () => {
    expect(isAllSize('All')).toBe(true);
    expect(isAllSize(50)).toBe(false);
    expect(PAGE_SIZE_OPTIONS).toContain('All');
  });
});
