import React, { useCallback, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

/**
 * A section header you can fold away, remembering whether you did.
 *
 * Part Arrival stacks three long tables on one page, and the one you want is
 * usually not the one at the top. Folding is only useful if it sticks, though:
 * the page unmounts whenever you visit another part of the app, so plain state
 * would spring back open on every return. The preference is kept in
 * localStorage instead, per section, so it survives navigation and reloads.
 *
 * Reads and writes are wrapped because localStorage throws in a private window
 * and in some embedded browsers, where a display preference is not worth
 * breaking the page over.
 */
const KEY = (storageKey) => `mih_section_${storageKey}`;

export function useCollapsed(storageKey, defaultCollapsed = true) {
  const [collapsed, setCollapsedState] = useState(() => {
    try {
      const saved = localStorage.getItem(KEY(storageKey));
      if (saved === 'open') return false;
      if (saved === 'closed') return true;
    } catch {
      /* display preference only */
    }
    return defaultCollapsed;
  });

  const setCollapsed = useCallback(
    (next) => {
      setCollapsedState(next);
      try {
        localStorage.setItem(KEY(storageKey), next ? 'closed' : 'open');
      } catch {
        /* display preference only */
      }
    },
    [storageKey],
  );

  const toggle = useCallback(() => setCollapsed(!collapsed), [collapsed, setCollapsed]);
  return { collapsed, setCollapsed, toggle };
}

/**
 * The clickable header. `title` and `count` always show, so a folded section
 * still says how much is inside it; `actions` (export buttons and the like) sit
 * to the right and do not toggle the section when clicked.
 */
export function SectionHeader({ title, count, countLabel = 'items', collapsed, onToggle, actions, style }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 12,
        ...style,
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={!collapsed}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          background: 'transparent',
          border: 'none',
          padding: 0,
          margin: 0,
          cursor: 'pointer',
          fontFamily: 'inherit',
          color: 'inherit',
          textAlign: 'left',
          flex: 1,
          minWidth: 0,
        }}
      >
        {collapsed ? <ChevronRight size={16} color="#64748B" /> : <ChevronDown size={16} color="#64748B" />}
        <span style={{ fontSize: 15, fontWeight: 700 }}>{title}</span>
        {count !== undefined && (
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: '#475569',
              background: '#F1F5F9',
              borderRadius: 999,
              padding: '2px 8px',
              whiteSpace: 'nowrap',
            }}
          >
            {count} {countLabel}
          </span>
        )}
      </button>
      {actions ? <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>{actions}</div> : null}
    </div>
  );
}

export default SectionHeader;
