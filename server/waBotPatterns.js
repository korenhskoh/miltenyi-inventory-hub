// WhatsApp Bot — Intent Pattern Matching (no AI, pure regex)

const intents = [
  // ── HELP ──
  {
    name: 'help',
    patterns: [
      /^(help|menu|hi|hello|hey|start|\?)$/i,
      /^help\s+(\w+)/i,
    ],
    extract: (m) => ({ category: m[1] && !/^(help|menu|hi|hello|hey|start|\?)$/i.test(m[0]) ? m[1].toLowerCase() : null })
  },

  // ── PRICE LOOKUP ──
  {
    name: 'price_lookup',
    patterns: [
      /price\s+(\d{3}-\d{3}-\d{3})/i,
      /how\s+much\s+(?:is|does|for)\s+(\d{3}-\d{3}-\d{3})/i,
      /cost\s+(?:of\s+)?(\d{3}-\d{3}-\d{3})/i,
      /(\d{3}-\d{3}-\d{3})\s+price/i,
      /^(\d{3}-\d{3}-\d{3})$/i,
    ],
    extract: (m) => ({ materialNo: m[1] })
  },

  // ── ORDER STATUS ──
  {
    name: 'order_status',
    patterns: [
      /status\s+(ord-\d+)/i,
      /track\s+(ord-\d+)/i,
      /where\s+is\s+(ord-\d+)/i,
      /(ord-\d+)\s+status/i,
      /check\s+(?:order\s+)?(ord-\d+)/i,
    ],
    extract: (m) => ({ orderId: m[1].toUpperCase() })
  },

  // ── CREATE ORDER ──
  {
    name: 'create_order',
    patterns: [
      /order\s+(\d+)\s*[x\u00d7]?\s*(\d{3}-\d{3}-\d{3})/i,
      /order\s+(\d{3}-\d{3}-\d{3})\s*[x\u00d7]?\s*(\d+)/i,
      /buy\s+(\d+)\s+(\d{3}-\d{3}-\d{3})/i,
      /(?:new|create|place)\s+order\s+(\d+)\s+(\d{3}-\d{3}-\d{3})/i,
      /^(?:new|create|place)\s+order$/i,
    ],
    extract: (m) => {
      if (!m[1]) return { interactive: true };
      const matFirst = /^\d{3}-/.test(m[1]);
      return {
        qty: parseInt(matFirst ? m[2] : m[1]) || 1,
        materialNo: matFirst ? m[1] : m[2],
      };
    }
  },

  // ── UPDATE ORDER STATUS ──
  {
    name: 'update_order',
    patterns: [
      /(?:update|set|change|mark)\s+(ord-\d+)\s+(?:to|as|status)\s+(.+)/i,
      /(?:update|set|change|mark)\s+(?:order\s+)?(ord-\d+)\s+(.+)/i,
    ],
    extract: (m) => ({ orderId: m[1].toUpperCase(), newStatus: m[2].trim() })
  },

  // ── DELETE ORDER ──
  {
    name: 'delete_order',
    patterns: [
      /(?:delete|remove)\s+(?:order\s+)?(ord-\d+)/i,
    ],
    extract: (m) => ({ orderId: m[1].toUpperCase() })
  },

  // ── SEARCH CATALOG (must come before search_orders) ──
  {
    name: 'search_catalog',
    patterns: [
      /(?:search|find|lookup)\s+(?:part|catalog|parts)\s+(.+)/i,
      /^catalog\s+(.+)/i,
    ],
    extract: (m) => ({ query: m[1].trim() })
  },

  // ── SEARCH ORDERS ──
  {
    name: 'search_orders',
    patterns: [
      /^search\s+(?:orders?\s+)?(?:for\s+)?(.+)/i,
      /^find\s+(?:orders?\s+)?(?:for\s+)?(.+)/i,
    ],
    extract: (m) => ({ query: m[1].trim() })
  },

  // ── LIST ORDERS ──
  {
    name: 'list_orders',
    patterns: [
      /^(?:list|show|view|get|my)\s+orders?/i,
      /^orders?\s+(?:list|all)/i,
      /^(?:all\s+)?orders$/i,
      /^(?:pending|approved|received|ordered)\s+orders?$/i,
    ],
    extract: (_m, text) => {
      const statusMatch = text.match(/(pending|approved|received|ordered|cancelled)/i);
      const monthMatch = text.match(/(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+\d{4}/i);
      const byMatch = text.match(/(?:by|for|from)\s+(\w+)/i);
      return {
        status: statusMatch?.[0] || null,
        month: monthMatch?.[0] || null,
        engineer: byMatch?.[1] || null,
      };
    }
  },

  // ── LIST BULK GROUPS ──
  {
    name: 'list_bulk',
    patterns: [
      /^(?:list|show|view|get)\s+(?:bulk|bulk\s+groups?|bulks?)/i,
      /^bulk\s+(?:groups?|list|all)/i,
      /^bulks?$/i,
    ],
    extract: () => ({})
  },

  // ── BULK GROUP DETAILS ──
  {
    name: 'bulk_detail',
    patterns: [
      /(?:bulk|group)\s+(blk-\d+)/i,
      /(?:detail|info|view)\s+(blk-\d+)/i,
      /(blk-\d+)\s+(?:detail|info|orders)/i,
      /^(blk-\d+)$/i,
    ],
    extract: (m) => ({ bulkId: m[1].toUpperCase() })
  },

  // ── LIST APPROVALS ──
  {
    name: 'list_approvals',
    patterns: [
      /^(?:list|show|view|get|pending)\s+approvals?/i,
      /^approvals?$/i,
      /^(?:what|which)\s+(?:needs?|pending)\s+approval/i,
    ],
    extract: () => ({})
  },

  // ── APPROVE ──
  {
    name: 'approve',
    patterns: [
      /^approve\s+(.+)/i,
    ],
    extract: (m) => ({ approvalId: m[1].trim().toUpperCase() })
  },

  // ── REJECT ──
  {
    name: 'reject',
    patterns: [
      /^reject\s+(.+)/i,
    ],
    extract: (m) => ({ approvalId: m[1].trim().toUpperCase() })
  },

  // ── STOCK ──
  {
    name: 'stock',
    patterns: [
      /^(?:stock|inventory)$/i,
      /^(?:stock|inventory)\s+(?:check|status|summary|latest)/i,
      /^(?:latest|recent)\s+(?:stock|inventory)/i,
    ],
    extract: () => ({})
  },

  // ── STOCK HISTORY ──
  {
    name: 'stock_history',
    patterns: [
      /stock\s+history/i,
      /(?:all|past)\s+stock\s+checks?/i,
    ],
    extract: () => ({})
  },

  // ── REPORT MONTHLY ──
  {
    name: 'report_monthly',
    patterns: [
      /(?:monthly|month)\s+(?:report|summary)/i,
      /report\s+(?:for\s+)?(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+(\d{4})/i,
      /^report$/i,
      /^summary$/i,
    ],
    extract: (_m, text) => {
      const mm = text.match(/(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+(\d{4})/i);
      return { month: mm ? `${mm[1]} ${mm[2]}` : null };
    }
  },

  // ── TOP MATERIALS ──
  {
    name: 'report_top_materials',
    patterns: [
      /top\s+(?:materials?|parts?|items?)/i,
      /most\s+ordered/i,
      /popular\s+(?:materials?|parts?)/i,
    ],
    extract: () => ({})
  },

  // ── SPENDING ──
  {
    name: 'report_spending',
    patterns: [
      /^spending$/i,
      /total\s+(?:cost|spend|expenditure)/i,
      /how\s+much\s+(?:spent|spend)/i,
    ],
    extract: () => ({})
  },

  // ── LIST MACHINES ──
  {
    name: 'list_machines',
    patterns: [
      /^(?:list|show|view|get)\s+machines?/i,
      /^machines?$/i,
      /^machines?\s+(?:list|all)/i,
    ],
    extract: (_m, text) => {
      const mod = text.match(/(?:modality|type)\s+(\w+)/i);
      return { modality: mod?.[1] || null };
    }
  },

  // ── CONFIRM / CANCEL (stateless fallback) ──
  {
    name: 'confirm',
    patterns: [/^(?:confirm|yes|y|ok|proceed)$/i],
    extract: () => ({})
  },
  {
    name: 'cancel',
    patterns: [/^(?:cancel|no|n|abort|stop|exit|quit)$/i],
    extract: () => ({})
  },

  // ── MORE (pagination) ──
  {
    name: 'more',
    patterns: [/^(?:more|next|continue|\.\.\.)$/i],
    extract: () => ({})
  },
];

export function matchIntent(text) {
  const trimmed = text.trim();
  for (const intent of intents) {
    for (const pattern of intent.patterns) {
      const match = trimmed.match(pattern);
      if (match) {
        return {
          intent: intent.name,
          params: intent.extract(match, trimmed),
          raw: trimmed,
        };
      }
    }
  }
  return { intent: 'unknown', params: {}, raw: trimmed };
}
