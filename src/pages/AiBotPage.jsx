import { Bot, Database, Settings, MessageCircle, Check, DollarSign } from 'lucide-react';
import AiProviderSettings from '../components/AiProviderSettings.jsx';
import AiUsagePanel from '../components/AiUsagePanel.jsx';
import KnowledgeBasePanel from '../components/KnowledgeBasePanel.jsx';

const AiBotPage = ({
  aiAdminTab,
  setAiAdminTab,
  aiBotConfig,
  setAiBotConfig,
  aiConversationLogs,
  waAutoReply,
  notify,
  dbSync,
  api,
}) => (
  <div>
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
      <div style={{ padding: 10, background: 'linear-gradient(135deg,#006837,#00A550)', borderRadius: 12 }}>
        <Bot size={22} color="#fff" />
      </div>
      <div>
        <h2 style={{ fontSize: 18, fontWeight: 700 }}>AI Bot Administration</h2>
        <p style={{ fontSize: 12, color: '#94A3B8' }}>
          Documents the bot may quote, which model answers, what it costs, and what it has been asked
        </p>
      </div>
    </div>

    {/* Tabs */}
    <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '2px solid #E8ECF0', paddingBottom: 2 }}>
      {[
        { id: 'knowledge', label: 'Knowledge Base', icon: Database },
        { id: 'config', label: 'Bot Configuration', icon: Settings },
        { id: 'usage', label: 'Usage & Budget', icon: DollarSign },
        { id: 'logs', label: 'Conversation Logs', icon: MessageCircle },
      ].map((tab) => (
        <button
          key={tab.id}
          onClick={() => setAiAdminTab(tab.id)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '10px 16px',
            border: 'none',
            background: aiAdminTab === tab.id ? '#E6F4ED' : 'transparent',
            color: aiAdminTab === tab.id ? '#0B7A3E' : '#64748B',
            fontWeight: 600,
            fontSize: 13,
            borderRadius: '8px 8px 0 0',
            cursor: 'pointer',
            fontFamily: 'inherit',
            borderBottom: aiAdminTab === tab.id ? '2px solid #0B7A3E' : '2px solid transparent',
            marginBottom: -2,
          }}
        >
          <tab.icon size={15} /> {tab.label}
        </button>
      ))}
    </div>

    {/* Knowledge Base Tab */}
    {/*
      This used to be a file list in React state: names and sizes, kept until
      the page reloaded, never indexed and never read by the bot — while the
      screen told people the bot would answer from them. It is now a real
      corpus: chunked, embedded where a key allows it, retrieved per question
      and cited in the answer.
    */}
    {aiAdminTab === 'knowledge' && (
      <div className="card" style={{ padding: '24px' }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>Knowledge Base</h3>
        <p style={{ fontSize: 12, color: '#64748B', marginBottom: 18 }}>
          Procedures, specs and policies the assistant may quote. It names the document it used, so any answer can be
          traced back to the page it came from.
        </p>
        <KnowledgeBasePanel notify={notify} />
      </div>
    )}

    {/* Usage & Budget Tab */}
    {aiAdminTab === 'usage' && (
      <div className="card" style={{ padding: '24px' }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>Usage & Budget</h3>
        <p style={{ fontSize: 12, color: '#64748B', marginBottom: 18 }}>
          Every model call is priced and recorded here. The caps are checked before each call, so a runaway loop or a
          busy day stops at a number you chose rather than at whatever the provider is willing to bill.
        </p>
        <AiUsagePanel notify={notify} />
      </div>
    )}

    {/* Bot Configuration Tab */}
    {aiAdminTab === 'config' && (
      <div className="card" style={{ padding: '24px' }}>
        <div style={{ display: 'grid', gap: 20 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#4A5568', marginBottom: 8 }}>
              Preset Template
            </label>
            <select
              value={aiBotConfig.template}
              onChange={(e) => setAiBotConfig((prev) => ({ ...prev, template: e.target.value }))}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: 10,
                border: '1.5px solid #E2E8F0',
                fontSize: 13,
              }}
            >
              <option value="sales">Friendly Sales Agent</option>
              <option value="support">Technical Support</option>
              <option value="orders">Order Processing Only</option>
              <option value="custom">Custom (Use instructions below)</option>
            </select>
            <p style={{ fontSize: 11, color: '#94A3B8', marginTop: 6 }}>
              {aiBotConfig.template === 'sales' &&
                'Professional and helpful, focuses on product information and sales.'}
              {aiBotConfig.template === 'support' && 'Technical and detailed, focuses on troubleshooting and specs.'}
              {aiBotConfig.template === 'orders' && 'Efficient and direct, focuses only on order-related queries.'}
              {aiBotConfig.template === 'custom' && 'Fully customizable using your instructions below.'}
            </p>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#4A5568', marginBottom: 8 }}>
              Custom Instructions
            </label>
            <textarea
              value={aiBotConfig.customInstructions}
              onChange={(e) => setAiBotConfig((prev) => ({ ...prev, customInstructions: e.target.value }))}
              placeholder="Add specific instructions for the bot behavior, rules, and response style..."
              rows={5}
              style={{
                width: '100%',
                padding: '12px 14px',
                borderRadius: 10,
                border: '1.5px solid #E2E8F0',
                fontSize: 13,
                resize: 'vertical',
                fontFamily: 'inherit',
              }}
            />
            <p style={{ fontSize: 11, color: '#94A3B8', marginTop: 6 }}>
              These instructions override the template defaults.
            </p>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#4A5568', marginBottom: 8 }}>
              Greeting Message
            </label>
            <input
              type="text"
              value={aiBotConfig.greeting}
              onChange={(e) => setAiBotConfig((prev) => ({ ...prev, greeting: e.target.value }))}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: 10,
                border: '1.5px solid #E2E8F0',
                fontSize: 13,
              }}
            />
            <p style={{ fontSize: 11, color: '#94A3B8', marginTop: 6 }}>
              First message shown when users open the chat.
            </p>
          </div>

          <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: 18, marginTop: 4 }}>
            <h4 style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>AI Model</h4>
            <p style={{ fontSize: 11, color: '#94A3B8', marginBottom: 14 }}>
              Which model answers questions the built-in commands cannot match. This used to be a single key field that
              nothing read; it now drives the assistant and the WhatsApp bot.
            </p>
            <AiProviderSettings notify={notify} />
          </div>

          <div>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={aiBotConfig.semanticRouting === true}
                onChange={(e) => setAiBotConfig((prev) => ({ ...prev, semanticRouting: e.target.checked }))}
                style={{ marginTop: 3 }}
              />
              <span>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#0F172A' }}>
                  Understand loosely worded requests
                </span>
                <span style={{ display: 'block', fontSize: 11.5, color: '#64748B', marginTop: 3, lineHeight: 1.5 }}>
                  When nothing matches the built-in commands, the model works out which command was meant — so
                  &ldquo;anything still waiting for sign off?&rdquo; runs the approvals list. Commands that change data
                  are only ever suggested, never run: the bot replies with the exact command to send. Off by default,
                  because it spends a little on messages that used to cost nothing.
                </span>
              </span>
            </label>
          </div>

          <button
            className="bp"
            onClick={() => {
              dbSync(api.setConfigKey('aiBotConfig', aiBotConfig), 'Bot config not saved');
              dbSync(api.setConfigKey('waAutoReply', waAutoReply), 'Auto-reply config not saved');
              notify('Settings Saved', 'Bot configuration saved to database', 'success');
            }}
            style={{ width: 'fit-content' }}
          >
            <Check size={14} /> Save Bot Behaviour
          </button>
        </div>
      </div>
    )}

    {/* Conversation Logs Tab */}
    {aiAdminTab === 'logs' && (
      <div className="card" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700 }}>Recent Conversations</h3>
          <span style={{ fontSize: 12, color: '#94A3B8' }}>{aiConversationLogs.length} queries logged</span>
        </div>

        {aiConversationLogs.length > 0 ? (
          <div style={{ border: '1px solid #E2E8F0', borderRadius: 10, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#F8FAFB' }}>
                  <th className="th">ID</th>
                  <th className="th">User</th>
                  <th className="th">Query</th>
                  <th className="th">Type</th>
                  <th className="th">Time</th>
                </tr>
              </thead>
              <tbody>
                {aiConversationLogs
                  .slice()
                  .reverse()
                  .map((log) => (
                    <tr key={log.id} className="tr" style={{ borderBottom: '1px solid #F0F2F5' }}>
                      <td className="td mono" style={{ fontSize: 11 }}>
                        {log.id}
                      </td>
                      <td className="td">{log.user}</td>
                      <td
                        className="td"
                        style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                      >
                        {log.query}
                      </td>
                      <td className="td">
                        <Pill
                          bg={log.type === 'success' ? '#D1FAE5' : log.type === 'price' ? '#DBEAFE' : '#F3F4F6'}
                          color={log.type === 'success' ? '#059669' : log.type === 'price' ? '#2563EB' : '#64748B'}
                        >
                          {log.type}
                        </Pill>
                      </td>
                      <td className="td" style={{ color: '#94A3B8', fontSize: 11 }}>
                        {new Date(log.time).toLocaleString()}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '32px', background: '#F8FAFB', borderRadius: 10 }}>
            <MessageCircle size={32} color="#D1D5DB" style={{ marginBottom: 8 }} />
            <p style={{ fontSize: 13, color: '#9CA3AF' }}>
              No conversations logged yet. Logs will appear here when users interact with the AI assistant.
            </p>
          </div>
        )}
      </div>
    )}
  </div>
);

export default AiBotPage;
