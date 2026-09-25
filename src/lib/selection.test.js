import { describe, it, expect } from 'vitest';
import { allSelected, nextSelection } from './selection.js';

describe('header select-all', () => {
  const rows = [{ id: 'SC-1' }, { id: 'SC-2' }, { id: 'SC-3' }, { id: 'SC-4' }, { id: 'SC-5' }];
  const search = (q) => rows.filter((r) => !q || r.id.includes(q));

  it('selects only the rows the filter left on screen', () => {
    const visible = search('SC-1').map((r) => r.id);
    expect(visible).toEqual(['SC-1']);
    expect([...nextSelection(new Set(), visible)]).toEqual(['SC-1']);
  });

  it('never reaches past the filter into the rest of the table', () => {
    // The bug: select-all mapped over every row, so a batch delete behind a
    // narrow filter removed the whole history.
    const visible = search('SC-2').map((r) => r.id);
    const picked = nextSelection(new Set(), visible);
    expect(picked.size).toBe(1);
    expect(picked.has('SC-5')).toBe(false);
  });

  it('clears only when every visible row is already selected', () => {
    const visible = rows.map((r) => r.id);
    const all = new Set(visible);
    expect(allSelected(all, visible)).toBe(true);
    expect(nextSelection(all, visible).size).toBe(0);
  });

  it('a same-sized selection from another filter is not mistaken for all-selected', () => {
    // `prev.size === ids.length` said "already selected" and cleared it.
    const leftOver = new Set(['SC-4', 'SC-5']);
    const visible = ['SC-1', 'SC-2'];
    expect(allSelected(leftOver, visible)).toBe(false);
    expect([...nextSelection(leftOver, visible)]).toEqual(['SC-1', 'SC-2']);
  });

  it('an empty table does not read as fully selected', () => {
    expect(allSelected(new Set(), [])).toBe(false);
  });
});
