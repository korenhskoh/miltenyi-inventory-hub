import React, { useState } from 'react';
import { KeyRound, Eye, EyeOff, AlertTriangle } from 'lucide-react';
import api from '../api.js';

/**
 * Change your own password.
 *
 * Two modes. Normally it is a dialog you open and can dismiss. When `forced` is
 * set — the account still carries the password the seeder gave it — it cannot
 * be dismissed and the app is not usable behind it, because the whole point is
 * that a known default password must not survive first use.
 */
export default function ChangePasswordModal({ open, forced = false, onClose, onChanged, notify }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (!open) return null;

  // Mirrors the server's rules so the user is told before a round trip, not
  // after. The server still enforces them — this is convenience, not the check.
  const tooShort = next.length > 0 && next.length < 8;
  const mismatch = confirm.length > 0 && next !== confirm;
  const sameAsOld = next.length > 0 && next === current;
  const canSubmit = current && next.length >= 8 && next === confirm && !sameAsOld && !busy;

  const submit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError('');
    const res = await api.changePassword(current, next);
    setBusy(false);
    if (!res.ok) {
      setError(res.error || 'Could not change the password');
      return;
    }
    setCurrent('');
    setNext('');
    setConfirm('');
    notify?.('Password Changed', 'Your new password is active now.', 'success');
    onChanged?.();
  };

  const field = {
    width: '100%',
    padding: '10px 12px',
    borderRadius: 9,
    border: '1.5px solid #E2E8F0',
    fontSize: 13,
    marginTop: 5,
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15,23,42,0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        padding: 16,
      }}
      onClick={forced ? undefined : onClose}
    >
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#fff',
          borderRadius: 14,
          padding: '22px 24px',
          width: '100%',
          maxWidth: 420,
          boxShadow: '0 24px 60px rgba(0,0,0,0.28)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <div style={{ padding: 8, background: '#D1FAE5', borderRadius: 10 }}>
            <KeyRound size={17} color="#0B7A3E" />
          </div>
          <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>
            {forced ? 'Choose a new password' : 'Change password'}
          </h3>
        </div>

        {forced && (
          <div
            style={{
              display: 'flex',
              gap: 8,
              background: '#FEF3C7',
              border: '1px solid #FDE68A',
              borderRadius: 9,
              padding: '9px 11px',
              margin: '10px 0 14px',
              fontSize: 12,
              color: '#92400E',
            }}
          >
            <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>
              This account is still using the password it was created with. Choose your own before continuing.
            </span>
          </div>
        )}

        <label style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>
          Current password
          <input
            type={show ? 'text' : 'password'}
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            style={field}
            autoFocus
            autoComplete="current-password"
          />
        </label>

        <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginTop: 12 }}>
          New password
          <input
            type={show ? 'text' : 'password'}
            value={next}
            onChange={(e) => setNext(e.target.value)}
            style={{ ...field, borderColor: tooShort || sameAsOld ? '#FCA5A5' : '#E2E8F0' }}
            autoComplete="new-password"
          />
        </label>
        {tooShort && <div style={{ fontSize: 11, color: '#DC2626', marginTop: 4 }}>At least 8 characters.</div>}
        {sameAsOld && (
          <div style={{ fontSize: 11, color: '#DC2626', marginTop: 4 }}>
            That is your current password — pick a different one.
          </div>
        )}

        <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginTop: 12 }}>
          Confirm new password
          <input
            type={show ? 'text' : 'password'}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            style={{ ...field, borderColor: mismatch ? '#FCA5A5' : '#E2E8F0' }}
            autoComplete="new-password"
          />
        </label>
        {mismatch && <div style={{ fontSize: 11, color: '#DC2626', marginTop: 4 }}>The two entries do not match.</div>}

        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            marginTop: 12,
            background: 'none',
            border: 'none',
            padding: 0,
            fontSize: 11.5,
            color: '#64748B',
            cursor: 'pointer',
          }}
        >
          {show ? <EyeOff size={13} /> : <Eye size={13} />} {show ? 'Hide' : 'Show'} passwords
        </button>

        {error && (
          <div
            style={{
              marginTop: 12,
              padding: '9px 11px',
              background: '#FEE2E2',
              border: '1px solid #FECACA',
              borderRadius: 9,
              fontSize: 12,
              color: '#B91C1C',
            }}
          >
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 18 }}>
          {!forced && (
            <button type="button" className="bs" onClick={onClose} style={{ padding: '9px 14px', fontSize: 12.5 }}>
              Cancel
            </button>
          )}
          <button
            type="submit"
            className="bp"
            disabled={!canSubmit}
            style={{ padding: '9px 16px', fontSize: 12.5, opacity: canSubmit ? 1 : 0.55 }}
          >
            {busy ? 'Saving…' : 'Change password'}
          </button>
        </div>
      </form>
    </div>
  );
}
