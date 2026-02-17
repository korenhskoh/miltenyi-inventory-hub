import {
  Package,
  Upload,
  X,
  Shield,
  Mail,
  MessageSquare,
  Layers,
  Bell,
  AlertTriangle,
  BarChart3,
  CheckCircle,
  ChevronDown,
  FileText,
  Database,
  Trash2,
  RefreshCw,
  Plus,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { fmt } from '../utils.js';
import { Pill, Toggle, SelBox } from '../components/ui.jsx';

export default function SettingsPage({
  customLogo,
  setCustomLogo,
  emailConfig,
  setEmailConfig,
  priceConfig,
  setPriceConfig,
  waConnected,
  waMessageTemplates,
  setWaMessageTemplates,
  waAllowedSenders,
  setWaAllowedSenders,
  partsCatalog,
  setPartsCatalog,
  showCatalogMapper,
  setShowCatalogMapper,
  catalogColumnMap,
  setCatalogColumnMap,
  catalogMapperData,
  setCatalogMapperData,
  editingTemplate,
  setEditingTemplate,
  emailTemplates,
  setEmailTemplates,
  pendingApprovals,
  selApprovals,
  setSelApprovals,
  orders,
  setOrders,
  bulkGroups,
  setBulkGroups,
  notifLog,
  setNotifLog,
  setPendingApprovals,
  currentUser,
  users,
  hasPermission,
  notify,
  dbSync,
  handleApprovalAction,
  batchApprovalAction,
  toggleSel,
  toggleAll,
  handleHistoryImport,
  setPage,
  waNotifyRules,
  scheduledNotifs,
  LS_KEYS,
  api,
}) {
  return (
    <div style={{ maxWidth: 700 }}>
      {/* Logo Settings - Admin Only */}
      {hasPermission('settings') && (
        <div className="card" style={{ padding: '24px 28px', marginBottom: 16 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 20 }}>App Logo & Branding</h3>
          <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
            <div
              style={{
                width: 80,
                height: 80,
                borderRadius: 16,
                background: customLogo ? '#fff' : 'linear-gradient(135deg,#006837,#00A550)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '2px solid #E2E8F0',
                overflow: 'hidden',
              }}
            >
              {customLogo ? (
                <img src={customLogo} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              ) : (
                <Package size={36} color="#fff" />
              )}
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 12, color: '#64748B', marginBottom: 12 }}>
                Upload a custom logo (PNG, JPG, SVG). Recommended size: 200x200px
              </p>
              <div style={{ display: 'flex', gap: 8 }}>
                <label
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '8px 16px',
                    background: '#0B7A3E',
                    color: '#fff',
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = async (evt) => {
                          setCustomLogo(evt.target.result);
                          const ok = await api.setConfigKey('customLogo', evt.target.result);
                          if (ok) {
                            notify('Logo Updated', 'New logo saved', 'success');
                          } else {
                            notify('Upload Failed', 'Logo not saved to database', 'error');
                          }
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                    style={{ display: 'none' }}
                  />
                  <Upload size={14} /> Upload Logo
                </label>
                {customLogo && (
                  <button
                    className="bs"
                    onClick={async () => {
                      setCustomLogo(null);
                      const ok = await api.setConfigKey('customLogo', null);
                      if (ok) {
                        notify('Logo Reset', 'Default logo restored', 'info');
                      } else {
                        notify('Reset Failed', 'Logo not cleared from database', 'error');
                      }
                    }}
                  >
                    <X size={14} /> Remove
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="card" style={{ padding: '24px 28px', marginBottom: 16 }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 20 }}>General</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#4A5568', marginBottom: 6 }}>
              Company
            </label>
            <input type="text" defaultValue="Miltenyi Biotec Asia Pacific Pte Ltd" style={{ width: '100%' }} />
          </div>
          <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#4A5568', marginBottom: 6 }}>
                Region
              </label>
              <select defaultValue="Singapore" style={{ width: '100%' }}>
                <option>Singapore</option>
                <option>Malaysia</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#4A5568', marginBottom: 6 }}>
                Currency
              </label>
              <select defaultValue="SGD" style={{ width: '100%' }}>
                <option>SGD</option>
                <option>USD</option>
                <option>EUR</option>
              </select>
            </div>
          </div>
        </div>
      </div>
      <div className="card" style={{ padding: '24px 28px', marginBottom: 16 }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 20 }}>Price Config (Yearly Update)</h3>
        <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {[
            { l: 'Year', k: 'year', s: 1 },
            { l: 'EUR/SGD Rate', k: 'exchangeRate', s: 0.01 },
            { l: 'SG Markup', k: 'sgMarkup', s: 0.1 },
            { l: 'GST', k: 'gst', s: 0.01 },
            { l: 'Dist Markup', k: 'distMarkup', s: 0.1 },
            { l: 'Special Rate', k: 'specialRate', s: 0.1 },
          ].map((f) => (
            <div key={f.k}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#4A5568', marginBottom: 6 }}>
                {f.l}
              </label>
              <input
                type="number"
                step={f.s}
                value={priceConfig[f.k]}
                onChange={(e) => setPriceConfig((p) => ({ ...p, [f.k]: parseFloat(e.target.value) }))}
                style={{ width: '100%' }}
              />
            </div>
          ))}
        </div>
      </div>
      <div className="card" style={{ padding: '24px 28px', marginBottom: 16 }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 20 }}>WhatsApp Baileys Config</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13 }}>Session Status</span>
            <Pill bg={waConnected ? '#D1FAE5' : '#FEE2E2'} color={waConnected ? '#059669' : '#DC2626'}>
              {waConnected ? 'Connected' : 'Disconnected'}
            </Pill>
          </div>
          <div style={{ fontSize: 12, color: '#64748B', lineHeight: 1.6 }}>
            Baileys WhiskeySockets connects to WhatsApp via the Multi-Device protocol. The admin must scan a QR code to
            authorize the session. Go to{' '}
            <button
              onClick={() => setPage('whatsapp')}
              style={{
                background: 'none',
                border: 'none',
                color: '#0B7A3E',
                cursor: 'pointer',
                fontFamily: 'inherit',
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              WhatsApp page
            </button>{' '}
            to manage.
          </div>
        </div>
      </div>

      {/* Email Configuration - Admin Only */}
      {hasPermission('settings') && (
        <div className="card" style={{ padding: '24px 28px', marginBottom: 16 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 20 }}>Email Sender Configuration</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13 }}>Email Notifications</span>
              <Toggle
                active={emailConfig.enabled}
                onClick={() => setEmailConfig((prev) => ({ ...prev, enabled: !prev.enabled }))}
                color="#0B7A3E"
              />
            </div>
            <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#4A5568', marginBottom: 6 }}>
                  Sender Name
                </label>
                <input
                  type="text"
                  value={emailConfig.senderName}
                  onChange={(e) => setEmailConfig((prev) => ({ ...prev, senderName: e.target.value }))}
                  placeholder="Company Name"
                  style={{ width: '100%' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#4A5568', marginBottom: 6 }}>
                  Sender Email
                </label>
                <input
                  type="email"
                  value={emailConfig.senderEmail}
                  onChange={(e) => setEmailConfig((prev) => ({ ...prev, senderEmail: e.target.value }))}
                  placeholder="noreply@company.com"
                  style={{ width: '100%' }}
                />
              </div>
            </div>
            <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#4A5568', marginBottom: 6 }}>
                  SMTP Host (Optional)
                </label>
                <input
                  type="text"
                  value={emailConfig.smtpHost}
                  onChange={(e) => setEmailConfig((prev) => ({ ...prev, smtpHost: e.target.value }))}
                  placeholder="smtp.gmail.com"
                  style={{ width: '100%' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#4A5568', marginBottom: 6 }}>
                  SMTP Port
                </label>
                <input
                  type="number"
                  value={emailConfig.smtpPort}
                  onChange={(e) => setEmailConfig((prev) => ({ ...prev, smtpPort: parseInt(e.target.value) }))}
                  style={{ width: '100%' }}
                />
              </div>
            </div>
            <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 8 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#4A5568', marginBottom: 6 }}>
                  SMTP Username
                </label>
                <input
                  type="text"
                  value={emailConfig.smtpUser || ''}
                  onChange={(e) => setEmailConfig((prev) => ({ ...prev, smtpUser: e.target.value }))}
                  placeholder="your-email@gmail.com"
                  style={{ width: '100%' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#4A5568', marginBottom: 6 }}>
                  SMTP Password
                </label>
                <input
                  type="password"
                  value={emailConfig.smtpPass || ''}
                  onChange={(e) => setEmailConfig((prev) => ({ ...prev, smtpPass: e.target.value }))}
                  placeholder="App password"
                  style={{ width: '100%' }}
                />
              </div>
            </div>
            <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 6 }}>
              Configure SMTP to send HTML emails with styled tables. Without SMTP, approval emails open in your default
              mail client (plain text).
            </div>
          </div>
        </div>
      )}

      {/* Order Approval Email Configuration - Admin Only */}
      {hasPermission('settings') && (
        <div className="card" style={{ padding: '24px 28px', marginBottom: 16 }}>
          <h3
            style={{ fontSize: 15, fontWeight: 600, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}
          >
            <Shield size={18} color="#7C3AED" /> Order Approval Workflow
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <span style={{ fontSize: 13, fontWeight: 500 }}>Require Approval for Orders</span>
                <div style={{ fontSize: 11, color: '#64748B' }}>Orders require approval before processing</div>
              </div>
              <Toggle
                active={emailConfig.approvalEnabled}
                onClick={() => setEmailConfig((prev) => ({ ...prev, approvalEnabled: !prev.approvalEnabled }))}
                color="#7C3AED"
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#4A5568', marginBottom: 6 }}>
                Approver Email (Hotmail/Outlook)
              </label>
              <input
                type="email"
                value={emailConfig.approverEmail || ''}
                onChange={(e) => setEmailConfig((prev) => ({ ...prev, approverEmail: e.target.value }))}
                placeholder="approver@hotmail.com or approver@outlook.com"
                style={{ width: '100%' }}
              />
              <div style={{ fontSize: 11, color: '#64748B', marginTop: 4 }}>
                Approval requests will be sent to this email address
              </div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#4A5568', marginBottom: 6 }}>
                Approval Trigger Keywords
              </label>
              <input
                type="text"
                value={(emailConfig.approvalKeywords || []).join(', ')}
                onChange={(e) =>
                  setEmailConfig((prev) => ({
                    ...prev,
                    approvalKeywords: e.target.value
                      .split(',')
                      .map((k) => k.trim().toLowerCase())
                      .filter((k) => k),
                  }))
                }
                placeholder="approve, approved, yes, confirm"
                style={{ width: '100%' }}
              />
              <div style={{ fontSize: 11, color: '#64748B', marginTop: 4 }}>
                Keywords in reply that trigger approval (comma-separated)
              </div>
            </div>
            <div style={{ background: '#F8FAFC', borderRadius: 10, padding: 16, border: '1px solid #E2E8F0' }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: '#334155' }}>
                Auto-Send Channels (when "Order Approval & Notify" is pressed)
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Mail size={15} color="#2563EB" />
                    <div>
                      <span style={{ fontSize: 12, fontWeight: 500 }}>Auto-Send Email</span>
                      <div style={{ fontSize: 10, color: '#64748B' }}>
                        {emailConfig.smtpHost ? 'SMTP configured — sends HTML email' : 'No SMTP — opens mailto client'}
                      </div>
                    </div>
                  </div>
                  <Toggle
                    active={emailConfig.approvalAutoEmail !== false}
                    onClick={() => setEmailConfig((prev) => ({ ...prev, approvalAutoEmail: !prev.approvalAutoEmail }))}
                    color="#2563EB"
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <MessageSquare size={15} color="#25D366" />
                    <div>
                      <span style={{ fontSize: 12, fontWeight: 500 }}>Auto-Send WhatsApp</span>
                      <div style={{ fontSize: 10, color: '#64748B' }}>
                        {waConnected
                          ? 'Connected — sends table message to approver'
                          : 'Not connected — enable in WhatsApp tab'}
                      </div>
                    </div>
                  </div>
                  <Toggle
                    active={emailConfig.approvalAutoWhatsApp !== false}
                    onClick={() =>
                      setEmailConfig((prev) => ({ ...prev, approvalAutoWhatsApp: !prev.approvalAutoWhatsApp }))
                    }
                    color="#25D366"
                  />
                </div>
              </div>
            </div>
            {pendingApprovals.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#4A5568', marginBottom: 8 }}>
                  Pending Approvals ({pendingApprovals.filter((a) => a.status === 'pending').length})
                  {selApprovals.size > 0 && (
                    <span style={{ color: '#2563EB', marginLeft: 8 }}>{selApprovals.size} selected</span>
                  )}
                </label>
                {selApprovals.size > 0 && (
                  <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                    <button
                      onClick={() => batchApprovalAction('approved')}
                      style={{
                        padding: '5px 12px',
                        background: '#059669',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 6,
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <CheckCircle size={12} /> Approve All ({selApprovals.size})
                    </button>
                    <button
                      onClick={() => batchApprovalAction('rejected')}
                      style={{
                        padding: '5px 12px',
                        background: '#DC2626',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 6,
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <X size={12} /> Reject All ({selApprovals.size})
                    </button>
                    <button
                      onClick={() => setSelApprovals(new Set())}
                      style={{
                        padding: '5px 12px',
                        background: '#64748B',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 6,
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Clear
                    </button>
                  </div>
                )}
                <div style={{ maxHeight: 250, overflow: 'auto', border: '1px solid #E8ECF0', borderRadius: 8 }}>
                  {pendingApprovals
                    .filter((a) => a.status === 'pending')
                    .map((a) => (
                      <div
                        key={a.id}
                        style={{
                          padding: 12,
                          borderBottom: '1px solid #F1F5F9',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          background: selApprovals.has(a.id) ? '#EDE9FE' : '#fff',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <SelBox
                            checked={selApprovals.has(a.id)}
                            onChange={() => toggleSel(selApprovals, setSelApprovals, a.id)}
                          />
                          <div>
                            <div style={{ fontSize: 12, fontWeight: 600 }}>
                              {a.orderId} - {a.description}
                            </div>
                            <div style={{ fontSize: 11, color: '#64748B' }}>
                              By: {a.requestedBy} | Qty: {a.quantity} | S${a.totalCost?.toFixed(2) || '0.00'}
                            </div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            onClick={() => handleApprovalAction(a.id, 'approved')}
                            style={{
                              padding: '6px 12px',
                              background: '#D1FAE5',
                              color: '#059669',
                              border: 'none',
                              borderRadius: 6,
                              fontSize: 11,
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleApprovalAction(a.id, 'rejected')}
                            style={{
                              padding: '6px 12px',
                              background: '#FEE2E2',
                              color: '#DC2626',
                              border: 'none',
                              borderRadius: 6,
                              fontSize: 11,
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            Reject
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}
            <div style={{ fontSize: 11, color: '#94A3B8', background: '#F8FAFB', padding: 12, borderRadius: 8 }}>
              <strong>How it works:</strong> When an order is created, an approval email opens in your mail client. The
              approver replies with a trigger keyword. Use the manual approval buttons above, or integrate with
              Microsoft Graph API for automatic reply detection.
            </div>
          </div>
        </div>
      )}

      {/* Email & Notification Templates - Admin Only */}
      {hasPermission('settings') && (
        <div className="card" style={{ padding: '24px 28px', marginBottom: 16 }}>
          <h3
            style={{ fontSize: 15, fontWeight: 600, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}
          >
            <FileText size={18} color="#2563EB" /> Email & Notification Templates
          </h3>
          <p style={{ fontSize: 12, color: '#64748B', marginBottom: 16 }}>
            Customize email templates for approvals, notifications, and alerts. Use {'{placeholder}'} variables that get
            replaced with actual data.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {(typeof emailTemplates === 'object' && emailTemplates ? Object.entries(emailTemplates) : []).map(
              ([key, tmpl]) => {
                const labels = {
                  orderApproval: 'Order Approval',
                  bulkApproval: 'Bulk Order Approval',
                  orderNotification: 'Order Notification',
                  backOrderAlert: 'Back Order Alert',
                  monthlySummary: 'Monthly Summary',
                  partArrivalDone: 'Part Arrival Verified',
                };
                const icons = {
                  orderApproval: Shield,
                  bulkApproval: Layers,
                  orderNotification: Bell,
                  backOrderAlert: AlertTriangle,
                  monthlySummary: BarChart3,
                  partArrivalDone: CheckCircle,
                };
                const Icon = icons[key] || Mail;
                return (
                  <div key={key} style={{ border: '1px solid #E8ECF0', borderRadius: 10, overflow: 'hidden' }}>
                    <div
                      onClick={() => setEditingTemplate(editingTemplate === key ? null : key)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '12px 16px',
                        cursor: 'pointer',
                        background: editingTemplate === key ? '#EEF2FF' : '#F8FAFB',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Icon size={14} color={editingTemplate === key ? '#4338CA' : '#64748B'} />
                        <span
                          style={{
                            fontSize: 13,
                            fontWeight: 600,
                            color: editingTemplate === key ? '#4338CA' : '#374151',
                          }}
                        >
                          {labels[key] || key}
                        </span>
                      </div>
                      <ChevronDown
                        size={14}
                        color="#64748B"
                        style={{
                          transform: editingTemplate === key ? 'rotate(180deg)' : 'none',
                          transition: 'transform 0.2s',
                        }}
                      />
                    </div>
                    {editingTemplate === key && (
                      <div style={{ padding: 16, borderTop: '1px solid #E8ECF0' }}>
                        <div style={{ marginBottom: 12 }}>
                          <label
                            style={{
                              display: 'block',
                              fontSize: 11,
                              fontWeight: 600,
                              color: '#4A5568',
                              marginBottom: 4,
                            }}
                          >
                            Subject Line
                          </label>
                          <input
                            value={tmpl.subject}
                            onChange={(e) =>
                              setEmailTemplates((prev) => ({
                                ...prev,
                                [key]: { ...prev[key], subject: e.target.value },
                              }))
                            }
                            style={{
                              width: '100%',
                              padding: '8px 10px',
                              borderRadius: 6,
                              border: '1.5px solid #E2E8F0',
                              fontSize: 12,
                              boxSizing: 'border-box',
                            }}
                          />
                        </div>
                        <div style={{ marginBottom: 12 }}>
                          <label
                            style={{
                              display: 'block',
                              fontSize: 11,
                              fontWeight: 600,
                              color: '#4A5568',
                              marginBottom: 4,
                            }}
                          >
                            Body
                          </label>
                          <textarea
                            value={tmpl.body}
                            onChange={(e) =>
                              setEmailTemplates((prev) => ({ ...prev, [key]: { ...prev[key], body: e.target.value } }))
                            }
                            rows={8}
                            style={{
                              width: '100%',
                              padding: '8px 10px',
                              borderRadius: 6,
                              border: '1.5px solid #E2E8F0',
                              fontSize: 11,
                              fontFamily: 'monospace',
                              resize: 'vertical',
                              boxSizing: 'border-box',
                              lineHeight: 1.5,
                            }}
                          />
                        </div>
                        <div
                          style={{ padding: 8, background: '#F0FDF4', borderRadius: 6, fontSize: 10, color: '#065F46' }}
                        >
                          <strong>Variables:</strong> {'{orderId}'}, {'{description}'}, {'{materialNo}'}, {'{quantity}'}
                          , {'{totalQty}'}, {'{totalCost}'}, {'{orderBy}'}, {'{date}'}, {'{month}'}, {'{orderCount}'},{' '}
                          {'{batchCount}'}, {'{itemCount}'}, {'{received}'}, {'{pending}'}, {'{backOrders}'},{' '}
                          {'{totalOrders}'}, {'{totalValue}'}, {'{orderTable}'}
                        </div>
                      </div>
                    )}
                  </div>
                );
              },
            )}
          </div>
          <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
            <button
              className="bp"
              style={{ fontSize: 12 }}
              onClick={async () => {
                const ok = await api.setConfigKey('emailTemplates', emailTemplates);
                if (ok) {
                  notify('Templates Saved', 'Email templates saved to database', 'success');
                } else {
                  notify('Save Failed', 'Email templates not saved to database', 'error');
                }
              }}
            >
              Save Templates
            </button>
            <button
              className="bs"
              style={{ fontSize: 12 }}
              onClick={() => {
                setEmailTemplates({
                  orderApproval: {
                    subject: '[APPROVAL] Batch Order Request - {orderCount} Orders (S${totalCost})',
                    body: 'Order Approval Request\n\nRequested By: {orderBy}\nDate: {date}\nTotal Orders: {orderCount}\nTotal Quantity: {totalQty}\nTotal Cost: S${totalCost}\n\n{orderTable}\n\nReply APPROVE to approve all orders or REJECT to decline.\n\n-Miltenyi Inventory Hub SG',
                  },
                  bulkApproval: {
                    subject: '[APPROVAL] Bulk Order Batch - {batchCount} Batches (S${totalCost})',
                    body: 'Bulk Order Approval Request\n\nRequested By: {orderBy}\nDate: {date}\nBatches: {batchCount}\nTotal Items: {itemCount}\nTotal Cost: S${totalCost}\n\n{orderTable}\n\nReply APPROVE to approve or REJECT to decline.\n\n-Miltenyi Inventory Hub SG',
                  },
                  orderNotification: {
                    subject: 'New Order: {orderId} - {description}',
                    body: 'A new order has been created.\n\nOrder ID: {orderId}\nItem: {description}\nMaterial: {materialNo}\nQuantity: {quantity}\nTotal: S${totalCost}\nOrdered By: {orderBy}\nDate: {date}\n\n-Miltenyi Inventory Hub SG',
                  },
                  backOrderAlert: {
                    subject: 'Back Order Alert: {description}',
                    body: 'Back Order Alert\n\nThe following item is on back order:\n\nOrder ID: {orderId}\nItem: {description}\nOrdered: {quantity}\nReceived: {received}\nPending: {pending}\n\nPlease follow up with HQ.\n\n-Miltenyi Inventory Hub SG',
                  },
                  monthlySummary: {
                    subject: 'Monthly Summary - {month}',
                    body: 'Monthly Inventory Summary\n\nMonth: {month}\nTotal Orders: {totalOrders}\nReceived: {received}\nPending: {pending}\nBack Orders: {backOrders}\nTotal Value: S${totalValue}\n\n-Miltenyi Inventory Hub SG',
                  },
                });
                notify('Templates Reset', 'Restored default templates', 'info');
              }}
            >
              Reset Defaults
            </button>
          </div>
        </div>
      )}

      {/* WhatsApp Message Templates - Admin Only */}
      {hasPermission('settings') && (
        <div className="card" style={{ padding: '24px 28px', marginBottom: 16 }}>
          <h3
            style={{ fontSize: 15, fontWeight: 600, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}
          >
            <MessageSquare size={18} color="#25D366" /> WhatsApp Message Templates
          </h3>
          <p style={{ fontSize: 12, color: '#64748B', marginBottom: 16 }}>
            Customize WhatsApp message templates. Use {'{placeholder}'} variables that get replaced with actual data.
            WhatsApp formatting: *bold*, _italic_, ~strikethrough~, {'```monospace```'}.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {Object.entries(waMessageTemplates).map(([key, tmpl]) => {
              const icons = {
                orderApproval: Shield,
                bulkApproval: Layers,
                backOrder: AlertTriangle,
                deliveryArrived: null,
                stockAlert: Bell,
                monthlyUpdate: BarChart3,
                partArrival: CheckCircle,
              };
              const Icon = icons[key] || MessageSquare;
              return (
                <div key={key} style={{ border: '1px solid #E8ECF0', borderRadius: 10, overflow: 'hidden' }}>
                  <div
                    onClick={() => setEditingTemplate(editingTemplate === 'wa_' + key ? null : 'wa_' + key)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 16px',
                      cursor: 'pointer',
                      background: editingTemplate === 'wa_' + key ? '#ECFDF5' : '#F8FAFB',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Icon size={14} color={editingTemplate === 'wa_' + key ? '#059669' : '#64748B'} />
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: editingTemplate === 'wa_' + key ? '#059669' : '#374151',
                        }}
                      >
                        {tmpl.label || key}
                      </span>
                    </div>
                    <ChevronDown
                      size={14}
                      color="#64748B"
                      style={{
                        transform: editingTemplate === 'wa_' + key ? 'rotate(180deg)' : 'none',
                        transition: 'transform 0.2s',
                      }}
                    />
                  </div>
                  {editingTemplate === 'wa_' + key && (
                    <div style={{ padding: 16, borderTop: '1px solid #E8ECF0' }}>
                      <div style={{ marginBottom: 12 }}>
                        <label
                          style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#4A5568', marginBottom: 4 }}
                        >
                          Template Label
                        </label>
                        <input
                          value={tmpl.label || ''}
                          onChange={(e) =>
                            setWaMessageTemplates((prev) => ({
                              ...prev,
                              [key]: { ...prev[key], label: e.target.value },
                            }))
                          }
                          style={{
                            width: '100%',
                            padding: '8px 10px',
                            borderRadius: 6,
                            border: '1.5px solid #E2E8F0',
                            fontSize: 12,
                            boxSizing: 'border-box',
                          }}
                        />
                      </div>
                      <div style={{ marginBottom: 12 }}>
                        <label
                          style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#4A5568', marginBottom: 4 }}
                        >
                          Message Body
                        </label>
                        <textarea
                          value={tmpl.message || ''}
                          onChange={(e) =>
                            setWaMessageTemplates((prev) => ({
                              ...prev,
                              [key]: { ...prev[key], message: e.target.value },
                            }))
                          }
                          rows={8}
                          style={{
                            width: '100%',
                            padding: '8px 10px',
                            borderRadius: 6,
                            border: '1.5px solid #E2E8F0',
                            fontSize: 11,
                            fontFamily: 'monospace',
                            resize: 'vertical',
                            boxSizing: 'border-box',
                            lineHeight: 1.5,
                          }}
                        />
                      </div>
                      <div
                        style={{ padding: 8, background: '#ECFDF5', borderRadius: 6, fontSize: 10, color: '#065F46' }}
                      >
                        <strong>Variables:</strong> {'{orderBy}'}, {'{date}'}, {'{orderCount}'}, {'{totalQty}'},{' '}
                        {'{totalCost}'}, {'{orderTable}'}, {'{batchCount}'}, {'{itemCount}'}, {'{items}'}, {'{item}'},{' '}
                        {'{month}'}, {'{totalItems}'}, {'{received}'}, {'{backOrders}'}, {'{verifiedBy}'}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
            <button
              className="bw"
              style={{ fontSize: 12, background: '#25D366', color: '#fff', border: 'none' }}
              onClick={async () => {
                const ok = await api.setConfigKey('waMessageTemplates', waMessageTemplates);
                if (ok) {
                  notify('Templates Saved', 'WhatsApp templates saved to database', 'success');
                } else {
                  notify('Save Failed', 'WhatsApp templates not saved to database', 'error');
                }
              }}
            >
              Save WhatsApp Templates
            </button>
            <button
              className="bs"
              style={{ fontSize: 12 }}
              onClick={() => {
                setWaMessageTemplates({
                  orderApproval: {
                    label: 'Order Approval Request',
                    message:
                      '*\u{1F4CB} Order Approval Request*\n\nRequested By: {orderBy}\nDate: {date}\nOrders: {orderCount}\nTotal Qty: {totalQty} units\nTotal: *S${totalCost}*\n\n{orderTable}\n\n_Reply *APPROVE* or *REJECT*_\n_Miltenyi Inventory Hub SG_',
                  },
                  bulkApproval: {
                    label: 'Bulk Order Approval',
                    message:
                      '*\u{1F4CB} Bulk Order Approval Request*\n\nRequested By: {orderBy}\nDate: {date}\nBatches: {batchCount}\nItems: {itemCount}\nTotal Qty: {totalQty} units\nTotal: *S${totalCost}*\n\n{orderTable}\n\n_Reply *APPROVE* or *REJECT*_\n_Miltenyi Inventory Hub SG_',
                  },
                  backOrder: {
                    label: 'Back Order Alert',
                    message:
                      '\u26A0\uFE0F *Back Order Alert*\n\nThe following items are on back order:\n{items}\n\nPlease follow up with HQ.\n\n_Miltenyi Biotec SG Service_',
                  },
                  deliveryArrived: {
                    label: 'Delivery Arrived',
                    message:
                      '\u{1F4E6} *Delivery Arrived*\n\nA new shipment has arrived at the warehouse. Please verify the items against the order list.\n\nCheck the Inventory Hub for details.\n\n_Miltenyi Biotec SG Service_',
                  },
                  stockAlert: {
                    label: 'Stock Level Warning',
                    message:
                      '\u{1F514} *Stock Level Warning*\n\n{item} is running low.\nCurrent stock: Below threshold\n\nPlease initiate reorder.\n\n_Miltenyi Biotec SG Service_',
                  },
                  monthlyUpdate: {
                    label: 'Monthly Update',
                    message:
                      '\u{1F4CA} *Monthly Inventory Update \u2014 {month}*\n\nAll received orders have been verified.\nBack orders: See Inventory Hub\n\nPlease review and confirm.\n\n_Miltenyi Biotec SG Service_',
                  },
                  partArrival: {
                    label: 'Part Arrival Verified',
                    message:
                      '\u2705 *Part Arrival Verified*\n\nMonth: {month}\nDate: {date}\nItems: {totalItems}\nReceived: {received}\nBack Orders: {backOrders}\nVerified By: {verifiedBy}\n\n{itemsList}\n\n_Miltenyi Biotec SG Service_',
                  },
                });
                notify('Templates Reset', 'Restored default WhatsApp templates', 'info');
              }}
            >
              Reset Defaults
            </button>
          </div>
        </div>
      )}

      {/* WhatsApp Sender Assignment - Admin Only */}
      {hasPermission('settings') && (
        <div className="card" style={{ padding: '24px 28px', marginBottom: 16 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 20 }}>WhatsApp Sender Assignment</h3>
          <p style={{ fontSize: 12, color: '#64748B', marginBottom: 16 }}>
            Assign users who can connect their WhatsApp to send notifications on behalf of the system.
          </p>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#4A5568', marginBottom: 8 }}>
              Allowed Senders
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
              {(Array.isArray(waAllowedSenders) ? waAllowedSenders : []).map((username) => {
                const user = users.find((u) => u.username === username);
                return (
                  <div
                    key={username}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '6px 12px',
                      background: '#E6F4ED',
                      borderRadius: 20,
                      fontSize: 12,
                    }}
                  >
                    <span style={{ fontWeight: 600, color: '#0B7A3E' }}>{user?.name || username}</span>
                    {username !== 'admin' && (
                      <button
                        onClick={() => setWaAllowedSenders((prev) => prev.filter((u) => u !== username))}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: '#DC2626',
                          padding: 0,
                          display: 'flex',
                        }}
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <select id="addWaSender" style={{ flex: 1 }} defaultValue="">
                <option value="" disabled>
                  Select user to add...
                </option>
                {users
                  .filter((u) => u.status === 'active' && !waAllowedSenders.includes(u.username))
                  .map((u) => (
                    <option key={u.id} value={u.username}>
                      {u.name} ({u.username})
                    </option>
                  ))}
              </select>
              <button
                className="bp"
                style={{ padding: '8px 16px' }}
                onClick={() => {
                  const select = document.getElementById('addWaSender');
                  if (select.value) {
                    setWaAllowedSenders((prev) => [...prev, select.value]);
                    notify('Sender Added', `${select.value} can now connect WhatsApp`, 'success');
                    select.value = '';
                  }
                }}
              >
                <Plus size={14} /> Add
              </button>
            </div>
          </div>

          <div style={{ padding: 12, background: '#F8FAFB', borderRadius: 8, fontSize: 12, color: '#64748B' }}>
            <strong>How it works:</strong> Assigned users can go to the WhatsApp page and scan QR code with their phone.
            Their WhatsApp will be used to send system notifications.
          </div>
        </div>
      )}

      {/* History Data Import - Admin Only */}
      {hasPermission('settings') && (
        <div className="card" style={{ padding: '24px 28px', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <div style={{ padding: 8, background: 'linear-gradient(135deg,#4338CA,#6366F1)', borderRadius: 10 }}>
              <Database size={18} color="#fff" />
            </div>
            <div>
              <h3 style={{ fontSize: 15, fontWeight: 600 }}>Import Historical Data</h3>
              <p style={{ fontSize: 11, color: '#64748B' }}>Upload Excel/CSV files to import past order records</p>
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '28px 24px',
                border: '2px dashed #C7D2FE',
                borderRadius: 12,
                background: '#EEF2FF',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              <input type="file" accept=".csv,.xlsx,.xls" onChange={handleHistoryImport} style={{ display: 'none' }} />
              <Upload size={28} color="#6366F1" style={{ marginBottom: 10 }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: '#4338CA', marginBottom: 4 }}>
                Drop Excel or CSV file to upload
              </span>
              <span style={{ fontSize: 11, color: '#6B7280' }}>Supports .xlsx (multi-sheet) and .csv formats</span>
            </label>
          </div>

          <div style={{ padding: 14, background: '#F8FAFB', borderRadius: 10, fontSize: 12 }}>
            <div style={{ fontWeight: 600, marginBottom: 8, color: '#374151' }}>Expected CSV Columns:</div>
            <div
              className="grid-3"
              style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6, fontSize: 11, color: '#64748B' }}
            >
              <div>{'\u2022'} Material No</div>
              <div>{'\u2022'} Description</div>
              <div>{'\u2022'} Quantity</div>
              <div>{'\u2022'} Price / List Price</div>
              <div>{'\u2022'} Total Cost</div>
              <div>{'\u2022'} Order Date</div>
              <div>{'\u2022'} Order By / Created By</div>
              <div>{'\u2022'} Status</div>
              <div>{'\u2022'} Month / Batch</div>
              <div>{'\u2022'} Received / Qty Received</div>
              <div>{'\u2022'} Arrival Date</div>
              <div>{'\u2022'} Remark / Notes</div>
            </div>
            <div
              style={{
                marginTop: 10,
                padding: 8,
                background: '#DBEAFE',
                borderRadius: 6,
                fontSize: 11,
                color: '#1E40AF',
              }}
            >
              <strong>Excel multi-sheet:</strong> Each sheet tab name becomes a bulk order month batch. Orders are
              auto-grouped by sheet.
            </div>
            <div
              style={{
                marginTop: 6,
                padding: 8,
                background: '#FEF3C7',
                borderRadius: 6,
                fontSize: 11,
                color: '#92400E',
              }}
            >
              <strong>Tip:</strong> Column headers are flexible and auto-mapped. Use any of the expected column names
              above.
            </div>
          </div>

          {orders.length > 0 && (
            <div style={{ marginTop: 16, padding: 12, background: '#E6F4ED', borderRadius: 8, fontSize: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <div>
                  <strong style={{ color: '#0B7A3E' }}>{orders.length}</strong> orders currently in system |{' '}
                  <strong style={{ color: '#4338CA' }}>{bulkGroups.length}</strong> bulk batches
                </div>
                <div style={{ color: '#64748B', fontSize: 11 }}>Last import will add to existing records</div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={async () => {
                    if (
                      window.confirm('Clear ALL orders? This cannot be undone. Bulk group totals will be reset to 0.')
                    ) {
                      setOrders([]);
                      setBulkGroups((prev) => prev.map((bg) => ({ ...bg, items: 0, totalCost: 0 })));
                      const ok = await api.clearOrders();
                      if (ok) {
                        bulkGroups.forEach((bg) =>
                          dbSync(api.updateBulkGroup(bg.id, { items: 0, totalCost: 0 }), 'Bulk group reset'),
                        );
                        notify('Orders Cleared', 'All orders removed, bulk group totals reset', 'info');
                      } else {
                        notify('Clear Failed', 'Orders not cleared from database', 'error');
                      }
                    }
                  }}
                  style={{
                    padding: '6px 14px',
                    background: '#DC2626',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 6,
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <Trash2 size={12} /> Clear All Orders
                </button>
                <button
                  onClick={async () => {
                    if (window.confirm('Clear ALL bulk batches and their linked orders? This cannot be undone.')) {
                      const bgOrderIds = orders.filter((o) => o.bulkGroupId).map((o) => o.id);
                      setOrders((prev) => prev.filter((o) => !o.bulkGroupId));
                      setBulkGroups([]);
                      const deleteResults = await Promise.all([
                        api.clearBulkGroups(),
                        ...bgOrderIds.map((id) => api.deleteOrder(id)),
                      ]);
                      const failed = deleteResults.filter((r) => !r).length;
                      if (failed === 0) {
                        notify(
                          'Bulk Orders Cleared',
                          `All bulk batches + ${bgOrderIds.length} linked orders removed`,
                          'info',
                        );
                      } else {
                        notify('Partial Clear', `Bulk batches cleared but ${failed} order deletes failed`, 'warning');
                      }
                    }
                  }}
                  style={{
                    padding: '6px 14px',
                    background: '#7C3AED',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 6,
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <Trash2 size={12} /> Clear Bulk Batches
                </button>
                <button
                  onClick={async () => {
                    if (
                      window.confirm('Clear ALL data (orders + bulk batches + notifications)? This cannot be undone.')
                    ) {
                      setOrders([]);
                      setBulkGroups([]);
                      setNotifLog([]);
                      setPendingApprovals([]);
                      const results = await Promise.all([
                        api.clearOrders(),
                        api.clearBulkGroups(),
                        api.clearNotifLog(),
                        api.clearApprovals(),
                      ]);
                      Object.values(LS_KEYS).forEach((k) => localStorage.removeItem(k));
                      const failed = results.filter((r) => !r).length;
                      if (failed === 0) {
                        notify('All Data Cleared', 'System reset complete', 'info');
                      } else {
                        notify(
                          'Partial Clear',
                          `${results.length - failed}/${results.length} clears succeeded. Some data may not be cleared from database.`,
                          'warning',
                        );
                      }
                    }
                  }}
                  style={{
                    padding: '6px 14px',
                    background: '#374151',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 6,
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <RefreshCw size={12} /> Reset All Data
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Admin Parts Catalog Management ── */}
      {hasPermission('settings') && (
        <div
          style={{
            background: '#fff',
            borderRadius: 12,
            padding: 20,
            boxShadow: '0 1px 3px rgba(0,0,0,.06)',
            marginBottom: 20,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1E293B', margin: 0 }}>Parts Catalog Management</h3>
              <div style={{ fontSize: 12, color: '#64748B', marginTop: 4 }}>
                Current catalog: {partsCatalog.length} parts
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <label
              style={{
                padding: '8px 16px',
                background: 'linear-gradient(135deg,#4338CA,#6366F1)',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Upload size={14} /> Upload Catalog (.xlsx/.csv)
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                style={{ display: 'none' }}
                onChange={async (e) => {
                  const file = e.target.files[0];
                  if (!file) return;
                  const data = await file.arrayBuffer();
                  const wb = XLSX.read(data, { type: 'array' });
                  const ws = wb.Sheets[wb.SheetNames[0]];
                  const rows = XLSX.utils.sheet_to_json(ws);
                  if (!rows.length) {
                    notify('Upload Failed', 'No data found in file', 'warning');
                    e.target.value = '';
                    return;
                  }
                  const headers = Object.keys(rows[0]);
                  const hm = {
                    'material no': 'm',
                    material_no: 'm',
                    materialno: 'm',
                    'mat no': 'm',
                    'material number': 'm',
                    'part no': 'm',
                    'part number': 'm',
                    description: 'd',
                    desc: 'd',
                    name: 'd',
                    category: 'c',
                    cat: 'c',
                    'sg price': 'sg',
                    'singapore price': 'sg',
                    sg_price: 'sg',
                    sgprice: 'sg',
                    'dist price': 'dist',
                    'distributor price': 'dist',
                    dist_price: 'dist',
                    distprice: 'dist',
                    'transfer price': 'tp',
                    transfer_price: 'tp',
                    transferprice: 'tp',
                    'rsp eur': 'rsp',
                    rsp_eur: 'rsp',
                    rspeur: 'rsp',
                    rsp: 'rsp',
                    'list price': 'tp',
                    listprice: 'tp',
                    price: 'tp',
                    'unit price': 'tp',
                  };
                  const autoMap = { m: '', d: '', c: '', sg: '', dist: '', tp: '', rsp: '' };
                  headers.forEach((h) => {
                    const nk = hm[h.toLowerCase().trim()];
                    if (nk && !autoMap[nk]) autoMap[nk] = h;
                  });
                  setCatalogMapperData({ rows, headers, fileName: file.name });
                  setCatalogColumnMap(autoMap);
                  setShowCatalogMapper(true);
                  e.target.value = '';
                }}
              />
            </label>
            <button
              onClick={async () => {
                if (
                  window.confirm(
                    `Clear all ${partsCatalog.length} parts from catalog? You will need to re-upload a catalog file.`,
                  )
                ) {
                  setPartsCatalog([]);
                  const ok = await api.clearCatalog();
                  if (ok) {
                    notify('Catalog Cleared', 'Parts catalog cleared from database', 'success');
                  } else {
                    notify(
                      'Warning',
                      'Catalog cleared locally but failed to clear from database. Changes may not persist.',
                      'error',
                    );
                  }
                }
              }}
              style={{
                padding: '8px 16px',
                background: '#DC2626',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Trash2 size={14} /> Clear Catalog
            </button>
            <button
              onClick={async () => {
                const cat = await api.getCatalog();
                if (cat && cat.length) {
                  setPartsCatalog(
                    cat.map((p) => ({
                      m: p.materialNo,
                      d: p.description,
                      c: p.category,
                      sg: p.sgPrice,
                      dist: p.distPrice,
                      tp: p.transferPrice,
                      rsp: p.rspEur,
                    })),
                  );
                  notify('Catalog Reloaded', `${cat.length} parts loaded from database`, 'success');
                } else {
                  notify('No Catalog', 'No parts found in database. Please upload a catalog file.', 'error');
                }
              }}
              style={{
                padding: '8px 16px',
                background: '#059669',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <RefreshCw size={14} /> Reload from DB
            </button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 10 }}>
        <button
          className="bp"
          onClick={async () => {
            const results = await Promise.all([
              api.setConfigKey('emailConfig', emailConfig),
              api.setConfigKey('emailTemplates', emailTemplates),
              api.setConfigKey('priceConfig', priceConfig),
              api.setConfigKey('waNotifyRules', waNotifyRules),
              api.setConfigKey('scheduledNotifs', scheduledNotifs),
              api.setConfigKey('customLogo', customLogo),
              api.setConfigKey('waAllowedSenders', waAllowedSenders),
            ]);
            const failed = results.filter((r) => !r).length;
            if (failed === 0) {
              notify('Saved', 'All settings saved to database', 'success');
            } else if (failed === results.length) {
              notify('Save Failed', 'Could not connect to database. Settings saved locally only.', 'error');
            } else {
              notify(
                'Partial Save',
                `${results.length - failed}/${results.length} settings saved to database`,
                'warning',
              );
            }
          }}
        >
          Save
        </button>
        <button className="bs">Reset</button>
      </div>
    </div>
  );
}
