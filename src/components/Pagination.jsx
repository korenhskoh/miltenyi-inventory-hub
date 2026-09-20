import { useState, useCallback } from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { paginate, rangeLabel, isAllSize, PAGE_SIZE_OPTIONS } from '../lib/paginate.js';

export { PAGE_SIZE_OPTIONS };

/**
 * Pagination state for one table.
 *
 * `resetKey` is any value describing the current filter/search/sort. When it
 * changes the view returns to page 1, adjusted during render rather than in an
 * effect so there is no extra render pass (and no set-state-in-effect warning).
 *
 * The chosen page size is remembered per table under `storageKey`; it is a
 * display preference, so a failure to read or write it is ignored.
 */
export function usePaginationState({ storageKey, initialSize = 50, resetKey } = {}) {
  const [pageSize, setPageSizeState] = useState(() => {
    if (!storageKey) return initialSize;
    try {
      const saved = localStorage.getItem(`mih_pagesize_${storageKey}`);
      if (saved === 'All') return 'All';
      const n = parseInt(saved, 10);
      return PAGE_SIZE_OPTIONS.includes(n) ? n : initialSize;
    } catch {
      return initialSize;
    }
  });
  const [page, setPage] = useState(1);
  const [prevReset, setPrevReset] = useState(resetKey);

  if (resetKey !== prevReset) {
    setPrevReset(resetKey);
    if (page !== 1) setPage(1);
  }

  const setPageSize = useCallback(
    (size) => {
      const next = isAllSize(size) ? 'All' : Number(size);
      setPageSizeState(next);
      setPage(1);
      if (storageKey) {
        try {
          localStorage.setItem(`mih_pagesize_${storageKey}`, String(next));
        } catch {
          /* display preference only */
        }
      }
    },
    [storageKey],
  );

  return { page, pageSize, setPage, setPageSize };
}

/**
 * The common case: hand it the filtered list and render `pageItems`.
 *
 * Where the list is only built inside a nested render block (so a hook cannot
 * be called there), use `usePaginationState` at component level and apply the
 * pure `paginate()` next to the list instead.
 */
export function usePagination(items, options) {
  const state = usePaginationState(options);
  return { ...paginate(items, state.page, state.pageSize), ...state };
}

export { paginate };

const btn = (disabled) => ({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 26,
  height: 26,
  borderRadius: 6,
  border: '1px solid #E2E8F0',
  background: disabled ? '#F8FAFB' : '#fff',
  color: disabled ? '#CBD5E1' : '#334155',
  cursor: disabled ? 'not-allowed' : 'pointer',
  padding: 0,
});

/**
 * Row-count label, page-size selector and page controls for a table.
 * Renders the count on its own when everything fits on one page.
 */
export default function Pagination({
  page,
  totalPages,
  total,
  from,
  to,
  pageSize,
  setPage,
  setPageSize,
  unit = 'items',
  align = 'space-between',
  style,
}) {
  const first = page <= 1;
  const last = page >= totalPages;
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: align,
        gap: 12,
        flexWrap: 'wrap',
        fontSize: 11.5,
        color: '#64748B',
        padding: '8px 0 2px',
        ...style,
      }}
    >
      <span>{rangeLabel({ from, to, total }, unit)}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span>Show</span>
          <select
            value={String(pageSize)}
            onChange={(e) => setPageSize(e.target.value)}
            style={{
              padding: '2px 6px',
              borderRadius: 6,
              border: '1px solid #E2E8F0',
              fontSize: 11.5,
              cursor: 'pointer',
              background: '#fff',
            }}
          >
            {PAGE_SIZE_OPTIONS.map((n) => (
              <option key={n} value={String(n)}>
                {n}
              </option>
            ))}
          </select>
        </label>
        {totalPages > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <button style={btn(first)} disabled={first} onClick={() => setPage(1)} title="First page">
              <ChevronsLeft size={14} />
            </button>
            <button style={btn(first)} disabled={first} onClick={() => setPage(page - 1)} title="Previous page">
              <ChevronLeft size={14} />
            </button>
            <span style={{ minWidth: 92, textAlign: 'center' }}>
              Page <strong style={{ color: '#1A202C' }}>{page}</strong> of {totalPages}
            </span>
            <button style={btn(last)} disabled={last} onClick={() => setPage(page + 1)} title="Next page">
              <ChevronRight size={14} />
            </button>
            <button style={btn(last)} disabled={last} onClick={() => setPage(totalPages)} title="Last page">
              <ChevronsRight size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
