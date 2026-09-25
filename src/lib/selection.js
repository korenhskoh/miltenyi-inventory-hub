/**
 * Batch-selection helpers shared by every table with a header select-all.
 *
 * Two rules, both learned the hard way:
 *
 *  1. Select-all spans exactly the rows the table body renders — the FILTERED
 *     list, never the whole dataset. Stock Check History mapped over every
 *     stock check in the database while its tbody showed the search results,
 *     so filtering to three rows, ticking the box above them and pressing the
 *     batch Delete removed all of them. Each stock check is an hour of counting
 *     that cannot be redone.
 *
 *  2. Whether everything is already selected is decided by MEMBERSHIP, not by
 *     comparing counts. `selected.size === ids.length` treated a same-sized
 *     selection left over from a previous filter as "all selected" and cleared
 *     it instead of selecting the rows actually on screen.
 */

/** Are all of `ids` currently selected? False for an empty list. */
export function allSelected(selected, ids) {
  return ids.length > 0 && ids.every((id) => selected.has(id));
}

/** The next selection after clicking a header select-all over `ids`. */
export function nextSelection(selected, ids) {
  return allSelected(selected, ids) ? new Set() : new Set(ids);
}
