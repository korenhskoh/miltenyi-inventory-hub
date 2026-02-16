import { Bot, Database, Settings, MessageCircle, Upload, FileText, Trash2, Check } from "lucide-react";
import { Pill } from "../components/ui.jsx";

const AiBotPage = ({
  aiAdminTab, setAiAdminTab,
  aiKnowledgeBase, setAiKnowledgeBase,
  aiBotConfig, setAiBotConfig,
  aiConversationLogs,
  waAutoReply,
  handleFileUpload,
  notify, dbSync, api
}) => (
<div>
  <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:24}}>
    <div style={{padding:10,background:'linear-gradient(135deg,#006837,#00A550)',borderRadius:12}}><Bot size={22} color="#fff"/></div>
    <div><h2 style={{fontSize:18,fontWeight:700}}>AI Bot Administration</h2><p style={{fontSize:12,color:'#94A3B8'}}>Configure knowledge base, bot behavior, and view conversation logs</p></div>
  </div>

  {/* Tabs */}
  <div style={{display:'flex',gap:4,marginBottom:20,borderBottom:'2px solid #E8ECF0',paddingBottom:2}}>
    {[{id:'knowledge',label:'Knowledge Base',icon:Database},{id:'config',label:'Bot Configuration',icon:Settings},{id:'logs',label:'Conversation Logs',icon:MessageCircle}].map(tab=>(
      <button key={tab.id} onClick={()=>setAiAdminTab(tab.id)} style={{
        display:'flex',alignItems:'center',gap:6,padding:'10px 16px',border:'none',
        background:aiAdminTab===tab.id?'#E6F4ED':'transparent',
        color:aiAdminTab===tab.id?'#0B7A3E':'#64748B',fontWeight:600,fontSize:13,
        borderRadius:'8px 8px 0 0',cursor:'pointer',fontFamily:'inherit',
        borderBottom:aiAdminTab===tab.id?'2px solid #0B7A3E':'2px solid transparent',marginBottom:-2
      }}><tab.icon size={15}/> {tab.label}</button>
    ))}
  </div>

  {/* Knowledge Base Tab */}
  {aiAdminTab==='knowledge'&&(
    <div className="card" style={{padding:'24px'}}>
      <div style={{marginBottom:20}}>
        <h3 style={{fontSize:15,fontWeight:700,marginBottom:8}}>Upload Documents</h3>
        <p style={{fontSize:12,color:'#64748B',marginBottom:16}}>Upload product manuals, spec sheets, and guides. The bot will use these to answer customer questions.</p>
        <label style={{
          display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',
          padding:'32px 24px',border:'2px dashed #D1D5DB',borderRadius:12,
          background:'#F9FAFB',cursor:'pointer',transition:'all 0.2s'
        }}>
          <input type="file" multiple accept=".pdf,.xlsx,.csv,.docx,.txt" onChange={handleFileUpload} style={{display:'none'}}/>
          <Upload size={32} color="#9CA3AF" style={{marginBottom:12}}/>
          <span style={{fontSize:14,fontWeight:600,color:'#374151',marginBottom:4}}>Drop files here or click to upload</span>
          <span style={{fontSize:12,color:'#9CA3AF'}}>PDF, XLSX, CSV, DOCX, TXT (max 10MB each)</span>
        </label>
      </div>

      {aiKnowledgeBase.length>0 && (
        <div>
          <h4 style={{fontSize:13,fontWeight:600,marginBottom:12}}>Uploaded Files ({aiKnowledgeBase.length})</h4>
          <div style={{border:'1px solid #E2E8F0',borderRadius:10,overflow:'hidden'}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
              <thead><tr style={{background:'#F8FAFB'}}><th className="th">File Name</th><th className="th">Type</th><th className="th">Size</th><th className="th">Uploaded</th><th className="th" style={{width:60}}></th></tr></thead>
              <tbody>
                {aiKnowledgeBase.map(f=>(
                  <tr key={f.id} className="tr" style={{borderBottom:'1px solid #F0F2F5'}}>
                    <td className="td" style={{display:'flex',alignItems:'center',gap:8}}><FileText size={14} color="#64748B"/>{f.name}</td>
                    <td className="td"><Pill bg="#EEF2FF" color="#4F46E5">{f.type}</Pill></td>
                    <td className="td" style={{color:'#64748B'}}>{f.size}</td>
                    <td className="td" style={{color:'#94A3B8',fontSize:11}}>{f.uploadedAt}</td>
                    <td className="td"><button onClick={()=>setAiKnowledgeBase(prev=>prev.filter(x=>x.id!==f.id))} style={{background:'none',border:'none',cursor:'pointer',color:'#DC2626'}}><Trash2 size={14}/></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {aiKnowledgeBase.length===0 && (
        <div style={{textAlign:'center',padding:'24px',background:'#F8FAFB',borderRadius:10}}>
          <Database size={32} color="#D1D5DB" style={{marginBottom:8}}/>
          <p style={{fontSize:13,color:'#9CA3AF'}}>No files uploaded yet. Upload documents to enhance the bot's knowledge.</p>
        </div>
      )}
    </div>
  )}

  {/* Bot Configuration Tab */}
  {aiAdminTab==='config'&&(
    <div className="card" style={{padding:'24px'}}>
      <div style={{display:'grid',gap:20}}>
        <div>
          <label style={{display:'block',fontSize:12,fontWeight:600,color:'#4A5568',marginBottom:8}}>Preset Template</label>
          <select value={aiBotConfig.template} onChange={e=>setAiBotConfig(prev=>({...prev,template:e.target.value}))} style={{width:'100%',padding:'10px 14px',borderRadius:10,border:'1.5px solid #E2E8F0',fontSize:13}}>
            <option value="sales">Friendly Sales Agent</option>
            <option value="support">Technical Support</option>
            <option value="orders">Order Processing Only</option>
            <option value="custom">Custom (Use instructions below)</option>
          </select>
          <p style={{fontSize:11,color:'#94A3B8',marginTop:6}}>
            {aiBotConfig.template==='sales'&&'Professional and helpful, focuses on product information and sales.'}
            {aiBotConfig.template==='support'&&'Technical and detailed, focuses on troubleshooting and specs.'}
            {aiBotConfig.template==='orders'&&'Efficient and direct, focuses only on order-related queries.'}
            {aiBotConfig.template==='custom'&&'Fully customizable using your instructions below.'}
          </p>
        </div>

        <div>
          <label style={{display:'block',fontSize:12,fontWeight:600,color:'#4A5568',marginBottom:8}}>Custom Instructions</label>
          <textarea value={aiBotConfig.customInstructions} onChange={e=>setAiBotConfig(prev=>({...prev,customInstructions:e.target.value}))} placeholder="Add specific instructions for the bot behavior, rules, and response style..." rows={5} style={{width:'100%',padding:'12px 14px',borderRadius:10,border:'1.5px solid #E2E8F0',fontSize:13,resize:'vertical',fontFamily:'inherit'}}/>
          <p style={{fontSize:11,color:'#94A3B8',marginTop:6}}>These instructions override the template defaults.</p>
        </div>

        <div>
          <label style={{display:'block',fontSize:12,fontWeight:600,color:'#4A5568',marginBottom:8}}>Greeting Message</label>
          <input type="text" value={aiBotConfig.greeting} onChange={e=>setAiBotConfig(prev=>({...prev,greeting:e.target.value}))} style={{width:'100%',padding:'10px 14px',borderRadius:10,border:'1.5px solid #E2E8F0',fontSize:13}}/>
          <p style={{fontSize:11,color:'#94A3B8',marginTop:6}}>First message shown when users open the chat.</p>
        </div>

        <div>
          <label style={{display:'block',fontSize:12,fontWeight:600,color:'#4A5568',marginBottom:8}}>AI API Key (for complex queries)</label>
          <input type="password" value={aiBotConfig.apiKey} onChange={e=>setAiBotConfig(prev=>({...prev,apiKey:e.target.value}))} placeholder="sk-..." style={{width:'100%',padding:'10px 14px',borderRadius:10,border:'1.5px solid #E2E8F0',fontSize:13,fontFamily:'monospace'}}/>
          <p style={{fontSize:11,color:'#94A3B8',marginTop:6}}>Optional. Used for AI-powered responses to complex questions. Leave empty for rule-based only.</p>
        </div>

        <button className="bp" onClick={()=>{dbSync(api.setConfigKey('aiBotConfig',aiBotConfig),'Bot config not saved');dbSync(api.setConfigKey('waAutoReply',waAutoReply),'Auto-reply config not saved');notify('Settings Saved','Bot configuration saved to database','success');}} style={{width:'fit-content'}}><Check size={14}/> Save Configuration</button>
      </div>
    </div>
  )}

  {/* Conversation Logs Tab */}
  {aiAdminTab==='logs'&&(
    <div className="card" style={{padding:'24px'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
        <h3 style={{fontSize:15,fontWeight:700}}>Recent Conversations</h3>
        <span style={{fontSize:12,color:'#94A3B8'}}>{aiConversationLogs.length} queries logged</span>
      </div>

      {aiConversationLogs.length>0 ? (
        <div style={{border:'1px solid #E2E8F0',borderRadius:10,overflow:'hidden'}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
            <thead><tr style={{background:'#F8FAFB'}}><th className="th">ID</th><th className="th">User</th><th className="th">Query</th><th className="th">Type</th><th className="th">Time</th></tr></thead>
            <tbody>
              {aiConversationLogs.slice().reverse().map(log=>(
                <tr key={log.id} className="tr" style={{borderBottom:'1px solid #F0F2F5'}}>
                  <td className="td mono" style={{fontSize:11}}>{log.id}</td>
                  <td className="td">{log.user}</td>
                  <td className="td" style={{maxWidth:200,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{log.query}</td>
                  <td className="td"><Pill bg={log.type==='success'?'#D1FAE5':log.type==='price'?'#DBEAFE':'#F3F4F6'} color={log.type==='success'?'#059669':log.type==='price'?'#2563EB':'#64748B'}>{log.type}</Pill></td>
                  <td className="td" style={{color:'#94A3B8',fontSize:11}}>{new Date(log.time).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{textAlign:'center',padding:'32px',background:'#F8FAFB',borderRadius:10}}>
          <MessageCircle size={32} color="#D1D5DB" style={{marginBottom:8}}/>
          <p style={{fontSize:13,color:'#9CA3AF'}}>No conversations logged yet. Logs will appear here when users interact with the AI assistant.</p>
        </div>
      )}
    </div>
  )}
</div>
);

export default AiBotPage;
