import React from 'react';
import { Heart, Trash2, ShoppingCart, Layers, Package } from 'lucide-react';
import Pagination from '../components/Pagination.jsx';

/**
 * The wishlist, as somewhere you can actually go.
 *
 * Adding a part to the wishlist from the Parts Catalog worked, but the list
 * itself only existed as a picker inside the New Order and Bulk Order forms —
 * so once something was added there was no way to look at it, and nothing in
 * the interface said where it had gone. This is the page the heart button
 * implies, reachable from the sidebar with a live count.
 */
const WishlistPage = ({ wishlist, pager, priceOf, onRemove, onOrderSingle, onOrderAll, currency = 'S$' }) => (
  <div>
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
      <div style={{ padding: 10, background: 'linear-gradient(135deg,#E11D48,#F43F5E)', borderRadius: 12 }}>
        <Heart size={22} color="#fff" fill="#fff" />
      </div>
      <div style={{ flex: 1 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700 }}>Wishlist</h2>
        <p style={{ fontSize: 12, color: '#94A3B8' }}>
          Parts saved for later. Turn one into an order, or send the whole list to a bulk batch.
        </p>
      </div>
      {wishlist.length > 0 && (
        <button className="bp" onClick={onOrderAll} style={{ width: 'fit-content' }}>
          <Layers size={14} /> Add All to Bulk Order
        </button>
      )}
    </div>

    {wishlist.length === 0 ? (
      <div className="card" style={{ padding: 48, textAlign: 'center' }}>
        <Heart size={36} color="#E2E8F0" style={{ marginBottom: 12 }} />
        <p style={{ fontSize: 14, fontWeight: 600, color: '#475569', marginBottom: 4 }}>Nothing saved yet</p>
        <p style={{ fontSize: 12.5, color: '#94A3B8' }}>
          Open the Parts Catalog and press the heart on any part to keep it here.
        </p>
      </div>
    ) : (
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
          <thead>
            <tr style={{ background: '#F8FAFB' }}>
              <th className="th">Material No.</th>
              <th className="th">Description</th>
              <th className="th" style={{ width: 110, textAlign: 'right' }}>
                Price
              </th>
              <th className="th" style={{ width: 130, textAlign: 'center' }}>
                Added
              </th>
              <th className="th" style={{ width: 170, textAlign: 'right' }}>
                Action
              </th>
            </tr>
          </thead>
          <tbody>
            {pager.pageItems.map((w) => {
              const price = priceOf ? priceOf(w) : Number(w.listPrice) || 0;
              return (
                <tr key={w.id} className="tr" style={{ borderBottom: '1px solid #F0F2F5' }}>
                  <td className="td mono" style={{ fontSize: 11.5, color: '#0B7A3E', fontWeight: 600 }}>
                    {w.materialNo}
                  </td>
                  <td className="td" style={{ maxWidth: 380 }}>
                    {w.description || '—'}
                  </td>
                  <td className="td" style={{ textAlign: 'right' }}>
                    {price > 0 ? `${currency}${price.toFixed(2)}` : '—'}
                  </td>
                  <td className="td" style={{ textAlign: 'center', color: '#94A3B8', fontSize: 11.5 }}>
                    {w.addedAt || w.added_at || '—'}
                  </td>
                  <td className="td" style={{ textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: 6 }}>
                      <button
                        className="bs"
                        onClick={() => onOrderSingle(w)}
                        title="Create an order for this part"
                        style={{ width: 'fit-content' }}
                      >
                        <ShoppingCart size={13} /> Order
                      </button>
                      <button
                        className="bs"
                        onClick={() => onRemove(w)}
                        title="Remove from wishlist"
                        style={{ width: 'fit-content', color: '#DC2626' }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div style={{ padding: '6px 12px 12px' }}>
          <Pagination {...pager} unit="items" />
        </div>
      </div>
    )}

    {wishlist.length > 0 && (
      <p style={{ fontSize: 11.5, color: '#94A3B8', marginTop: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
        <Package size={13} /> {wishlist.length} part{wishlist.length === 1 ? '' : 's'} saved. Nothing here is ordered
        until you create an order from it.
      </p>
    )}
  </div>
);

export default WishlistPage;
