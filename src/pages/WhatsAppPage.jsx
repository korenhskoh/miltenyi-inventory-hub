import React from 'react';
import { MessageSquare, Wifi, WifiOff, QrCode, RefreshCw, Shield, Calendar, Mail, Send, Bot, Zap, CheckCircle } from 'lucide-react';
import { Pill, Toggle, QRCodeCanvas } from '../components/ui.jsx';

export default function WhatsAppPage({
  waConnected, waConnecting, waQrVisible, waQrCode, waSessionInfo,
  waMessages, waRecipient, setWaRecipient, waMessageText, setWaMessageText,
  waTemplate, setWaTemplate, waTemplates,
  waNotifyRules, setWaNotifyRules,
  scheduledNotifs, setScheduledNotifs,
  waAutoReply, setWaAutoReply,
  waAllowedSenders,
  currentUser, users,
  hasPermission,
  handleWaConnect, handleWaDisconnect, handleWaSend,
  addNotifEntry, notify,
  sendScheduledReport
}) {
  return (
<div>
  <div className="grid-2" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:24}}>
    {/* Connection Panel */}
    <div>
      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:16}}>
        <div style={{padding:8,background:'#D1FAE5',borderRadius:10}}><MessageSquare size={18} color="#059669"/></div>
        <div><h3 style={{fontSize:15,fontWeight:600}}>Baileys WhiskeySockets</h3><p style={{fontSize:11,color:'#94A3B8'}}>WhatsApp Web Multi-Device API</p></div>
      </div>

      {/* Connection Status Card */}
      <div className="card" style={{padding:'20px 24px',marginBottom:16,border:waConnected?'2px solid #25D366':'2px solid #E2E8F0'}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            {waConnected ? <Wifi size={20} color="#25D366"/> : <WifiOff size={20} color="#94A3B8"/>}
            <div>
              <div style={{fontWeight:600,fontSize:14,color:waConnected?'#0B7A3E':'#64748B'}}>{waConnected?'Connected':'Disconnected'}</div>
              <div style={{fontSize:11,color:'#94A3B8'}}>{waConnected?'Session active via Baileys Multi-Device':'Scan QR code to connect'}</div>
            </div>
          </div>
          <div style={{width:12,height:12,borderRadius:'50%',background:waConnected?'#25D366':'#E2E8F0',animation:waConnected?'pulse 2s infinite':'none'}}/>
        </div>

        {waConnected && waSessionInfo && (
          <div style={{padding:12,borderRadius:8,background:'#F0FDF4',marginBottom:16,fontSize:12}}>
            <div className="grid-2" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
              <div>Phone: <strong className="mono">{waSessionInfo.phone}</strong></div>
              <div>Name: <strong>{waSessionInfo.name}</strong></div>
              <div>Protocol: <strong className="mono" style={{fontSize:10}}>{waSessionInfo.protocol}</strong></div>
              <div>Connected: <strong style={{fontSize:10}}>{waSessionInfo.connectedAt}</strong></div>
            </div>
          </div>
        )}

        {/* QR Code Display */}
        {waQrVisible && !waConnected && (
          <div style={{textAlign:'center',padding:24,background:'#F8FAFB',borderRadius:12,marginBottom:16,border:'1px solid #E2E8F0'}}>
            {waQrCode ? (
              <div style={{marginBottom:12}}>
                {waQrCode.startsWith("data:") ? <img src={waQrCode} alt="QR Code" style={{width:220,height:220,borderRadius:10,border:'3px solid #fff',boxShadow:'0 4px 12px rgba(0,0,0,0.1)'}}/> : <QRCodeCanvas text={waQrCode} size={220}/>}
              </div>
            ) : (
              <div style={{width:220,height:220,margin:'0 auto 12px',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',background:'#fff',borderRadius:10,border:'1px solid #E8ECF0'}}>
                <RefreshCw size={28} color="#94A3B8" style={{animation:'spin 1s linear infinite',marginBottom:12}}/>
                <div style={{fontSize:12,color:'#94A3B8',fontWeight:500}}>Generating QR Code...</div>
                <div style={{fontSize:11,color:'#CBD5E1',marginTop:4}}>This may take a few seconds</div>
              </div>
            )}
            <div style={{fontSize:14,fontWeight:700,color:'#1A202C',marginBottom:4}}>{waQrCode ? 'Scan with WhatsApp' : 'Preparing Connection'}</div>
            <div style={{fontSize:12,color:'#64748B'}}>Open WhatsApp → Linked Devices → Link a Device</div>
            {waConnecting && waQrCode && <div style={{marginTop:12,display:'flex',alignItems:'center',justifyContent:'center',gap:8,fontSize:12,color:'#D97706'}}><RefreshCw size={14} style={{animation:'spin 1s linear infinite'}}/> Waiting for scan...</div>}
          </div>
        )}

        {!(hasPermission('whatsapp')||waAllowedSenders.includes(currentUser?.username)) && !waConnected && (
          <div style={{padding:12,borderRadius:8,background:'#FEF3C7',fontSize:12,color:'#92400E',marginBottom:16,display:'flex',gap:8}}><Shield size={14}/> Only authorized users can connect WhatsApp. Contact admin to be assigned as a sender.</div>
        )}

        <div style={{display:'flex',gap:8}}>
          {!waConnected ? (
            <button className="bw" onClick={handleWaConnect} disabled={!(hasPermission('whatsapp')||waAllowedSenders.includes(currentUser?.username))||waConnecting} style={{opacity:(hasPermission('whatsapp')||waAllowedSenders.includes(currentUser?.username))?1:.5,flex:1}}>
              {waConnecting?<><RefreshCw size={14} style={{animation:'spin 1s linear infinite'}}/> Connecting...</>:<><QrCode size={14}/> {hasPermission('whatsapp')?'Scan QR Code':'Admin Only'}</>}
            </button>
          ) : (
            <button className="bd" onClick={handleWaDisconnect} style={{flex:1}}><WifiOff size={14}/> Disconnect Session</button>
          )}
        </div>
      </div>

      {/* Auto-notification Rules */}
      <div className="card" style={{padding:'18px 20px'}}>
        <h4 style={{fontSize:13,fontWeight:600,marginBottom:12}}>Auto-Notify Rules via Baileys</h4>
        {[
          {key:'orderCreated',label:'New order created → Notify team'},
          {key:'bulkOrderCreated',label:'Bulk order created → Notify all engineers'},
          {key:'partArrivalDone',label:'Part arrival verified → Notify requester'},
          {key:'deliveryArrival',label:'Delivery arrival → Notify assigned engineer'},
          {key:'backOrderUpdate',label:'Back order update → Team group'},
          {key:'lowStockAlert',label:'Low stock alert → Supervisor'},
          {key:'monthlySummary',label:'Monthly summary → All engineers'},
          {key:'urgentRequest',label:'Urgent request → Broadcast to all'}
        ].map((rule,i)=>(
          <div key={i} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 0',borderBottom:i<7?'1px solid #F0F2F5':'none'}}>
            <span style={{fontSize:12.5}}>{rule.label}</span><Toggle active={waNotifyRules[rule.key]} onClick={()=>setWaNotifyRules(prev=>({...prev,[rule.key]:!prev[rule.key]}))} color="#25D366"/>
          </div>
        ))}
      </div>

      {/* Scheduled Reports & Notifications */}
      <div className="card" style={{padding:'18px 20px',marginTop:16}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <div style={{padding:8,background:'linear-gradient(135deg,#7C3AED,#8B5CF6)',borderRadius:10}}><Calendar size={18} color="#fff"/></div>
            <div>
              <h4 style={{fontSize:14,fontWeight:700}}>Scheduled Reports & Notifications</h4>
              <p style={{fontSize:11,color:'#94A3B8'}}>Auto-send reports via Email & WhatsApp</p>
            </div>
          </div>
          <Toggle active={scheduledNotifs.enabled} onClick={()=>setScheduledNotifs(prev=>({...prev,enabled:!prev.enabled}))} color="#7C3AED"/>
        </div>

        {scheduledNotifs.enabled && (
          <div style={{display:'grid',gap:14}}>
            {/* Schedule Frequency */}
            <div className="grid-2" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
              <div>
                <label style={{display:'block',fontSize:11,fontWeight:600,color:'#64748B',marginBottom:6}}>Frequency</label>
                <select value={scheduledNotifs.frequency} onChange={e=>setScheduledNotifs(prev=>({...prev,frequency:e.target.value}))} style={{width:'100%',padding:'8px 10px',borderRadius:6,border:'1px solid #E2E8F0',fontSize:12}}>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="biweekly">Bi-Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
              <div>
                <label style={{display:'block',fontSize:11,fontWeight:600,color:'#64748B',marginBottom:6}}>
                  {scheduledNotifs.frequency==='weekly'||scheduledNotifs.frequency==='biweekly'?'Day of Week':scheduledNotifs.frequency==='monthly'?'Day of Month':'Time'}
                </label>
                {(scheduledNotifs.frequency==='weekly'||scheduledNotifs.frequency==='biweekly')&&(
                  <select value={scheduledNotifs.dayOfWeek} onChange={e=>setScheduledNotifs(prev=>({...prev,dayOfWeek:parseInt(e.target.value)}))} style={{width:'100%',padding:'8px 10px',borderRadius:6,border:'1px solid #E2E8F0',fontSize:12}}>
                    {['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'].map((d,i)=><option key={i} value={i}>{d}</option>)}
                  </select>
                )}
                {scheduledNotifs.frequency==='monthly'&&(
                  <select value={scheduledNotifs.dayOfMonth} onChange={e=>setScheduledNotifs(prev=>({...prev,dayOfMonth:parseInt(e.target.value)}))} style={{width:'100%',padding:'8px 10px',borderRadius:6,border:'1px solid #E2E8F0',fontSize:12}}>
                    {Array.from({length:28},(_,i)=><option key={i+1} value={i+1}>{i+1}{i===0?'st':i===1?'nd':i===2?'rd':'th'}</option>)}
                  </select>
                )}
                {scheduledNotifs.frequency==='daily'&&(
                  <input type="time" value={scheduledNotifs.time} onChange={e=>setScheduledNotifs(prev=>({...prev,time:e.target.value}))} style={{width:'100%',padding:'8px 10px',borderRadius:6,border:'1px solid #E2E8F0',fontSize:12}}/>
                )}
              </div>
            </div>

            {/* Send Time for non-daily */}
            {scheduledNotifs.frequency!=='daily'&&(
              <div>
                <label style={{display:'block',fontSize:11,fontWeight:600,color:'#64748B',marginBottom:6}}>Send Time</label>
                <input type="time" value={scheduledNotifs.time} onChange={e=>setScheduledNotifs(prev=>({...prev,time:e.target.value}))} style={{width:150,padding:'8px 10px',borderRadius:6,border:'1px solid #E2E8F0',fontSize:12}}/>
              </div>
            )}

            {/* Delivery Channels */}
            <div>
              <label style={{display:'block',fontSize:11,fontWeight:600,color:'#64748B',marginBottom:8}}>Delivery Channels</label>
              <div style={{display:'flex',gap:16}}>
                <label style={{display:'flex',alignItems:'center',gap:6,fontSize:12,cursor:'pointer'}}>
                  <input type="checkbox" checked={scheduledNotifs.emailEnabled} onChange={e=>setScheduledNotifs(prev=>({...prev,emailEnabled:e.target.checked}))}/>
                  <Mail size={14} color={scheduledNotifs.emailEnabled?'#059669':'#9CA3AF'}/> Email
                </label>
                <label style={{display:'flex',alignItems:'center',gap:6,fontSize:12,cursor:'pointer'}}>
                  <input type="checkbox" checked={scheduledNotifs.whatsappEnabled} onChange={e=>setScheduledNotifs(prev=>({...prev,whatsappEnabled:e.target.checked}))}/>
                  <MessageSquare size={14} color={scheduledNotifs.whatsappEnabled?'#25D366':'#9CA3AF'}/> WhatsApp
                </label>
              </div>
            </div>

            {/* Report Types */}
            <div>
              <label style={{display:'block',fontSize:11,fontWeight:600,color:'#64748B',marginBottom:8}}>Reports to Include</label>
              <div className="grid-2" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                {[
                  {key:'monthlySummary',label:'Order Summary',desc:'Total orders, costs, status breakdown'},
                  {key:'backOrderReport',label:'Back Order Report',desc:'Pending items awaiting delivery'},
                  {key:'lowStockAlert',label:'Low Stock Alerts',desc:'Items below threshold'},
                  {key:'pendingApprovals',label:'Pending Approvals',desc:'Orders awaiting approval'},
                  {key:'orderStats',label:'Order Statistics',desc:'Trends and analytics'}
                ].map(r=>(
                  <label key={r.key} style={{display:'flex',alignItems:'flex-start',gap:8,padding:10,background:scheduledNotifs.reports?.[r.key]?'#EDE9FE':'#F8FAFB',borderRadius:8,cursor:'pointer',border:scheduledNotifs.reports?.[r.key]?'1px solid #C4B5FD':'1px solid #E8ECF0'}}>
                    <input type="checkbox" checked={scheduledNotifs.reports?.[r.key]} onChange={e=>setScheduledNotifs(prev=>({...prev,reports:{...prev.reports,[r.key]:e.target.checked}}))} style={{marginTop:2}}/>
                    <div>
                      <div style={{fontSize:12,fontWeight:600,color:scheduledNotifs.reports?.[r.key]?'#5B21B6':'#374151'}}>{r.label}</div>
                      <div style={{fontSize:10,color:'#94A3B8'}}>{r.desc}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Recipients */}
            <div>
              <label style={{display:'block',fontSize:11,fontWeight:600,color:'#64748B',marginBottom:8}}>Recipients</label>
              <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                {users.filter(u=>u.status==='active').map(u=>(
                  <label key={u.id} style={{display:'flex',alignItems:'center',gap:4,padding:'4px 10px',background:scheduledNotifs.recipients?.includes(u.email)?'#D1FAE5':'#F8FAFB',borderRadius:16,fontSize:11,cursor:'pointer',border:'1px solid #E8ECF0'}}>
                    <input type="checkbox" checked={scheduledNotifs.recipients?.includes(u.email)} onChange={e=>{
                      if(e.target.checked) setScheduledNotifs(prev=>({...prev,recipients:[...(prev.recipients||[]),u.email]}));
                      else setScheduledNotifs(prev=>({...prev,recipients:(prev.recipients||[]).filter(r=>r!==u.email)}));
                    }} style={{display:'none'}}/>
                    <span style={{color:scheduledNotifs.recipients?.includes(u.email)?'#059669':'#64748B'}}>{u.name}</span>
                    {scheduledNotifs.recipients?.includes(u.email)&&<CheckCircle size={12} color="#059669"/>}
                  </label>
                ))}
              </div>
            </div>

            {/* Schedule Summary & Actions */}
            <div style={{padding:12,background:'#F8FAFB',borderRadius:8,marginTop:4}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                <div>
                  <div style={{fontSize:12,fontWeight:600,color:'#374151'}}>
                    Next Report: {scheduledNotifs.frequency==='daily'?'Today':scheduledNotifs.frequency==='weekly'?['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][scheduledNotifs.dayOfWeek]:scheduledNotifs.frequency==='monthly'?'Day '+scheduledNotifs.dayOfMonth:'Every 2 weeks'} at {scheduledNotifs.time}
                  </div>
                  <div style={{fontSize:11,color:'#94A3B8',marginTop:2}}>
                    {Object.values(scheduledNotifs.reports).filter(Boolean).length} reports • {(scheduledNotifs.recipients||[]).length} recipients • {[scheduledNotifs.emailEnabled&&'Email',scheduledNotifs.whatsappEnabled&&'WhatsApp'].filter(Boolean).join(' & ')}
                  </div>
                </div>
                <button onClick={()=>{
                  const recipientCount = (scheduledNotifs.recipients||[]).length;
                  if(recipientCount===0){notify('No Recipients','Please select at least one recipient','warning');return;}
                  const reportCount = Object.values(scheduledNotifs.reports||{}).filter(Boolean).length;
                  if(reportCount===0){notify('No Reports','Please select at least one report to include','warning');return;}
                  if(!scheduledNotifs.emailEnabled&&!scheduledNotifs.whatsappEnabled){notify('No Channel','Please enable at least one delivery channel','warning');return;}
                  sendScheduledReport();
                  notify('Report Sent','Scheduled report sent to '+recipientCount+' recipient(s) via '+ [scheduledNotifs.emailEnabled&&'Email',scheduledNotifs.whatsappEnabled&&'WhatsApp'].filter(Boolean).join(' & '),'success');
                }} style={{padding:'8px 16px',background:'linear-gradient(135deg,#7C3AED,#8B5CF6)',color:'#fff',border:'none',borderRadius:8,fontSize:12,fontWeight:600,cursor:'pointer',display:'flex',alignItems:'center',gap:6}}>
                  <Send size={14}/> Send Now
                </button>
              </div>
              {scheduledNotifs.lastRun&&(
                <div style={{marginTop:8,fontSize:10,color:'#94A3B8'}}>
                  Last sent: {new Date(scheduledNotifs.lastRun).toLocaleString()}
                </div>
              )}
            </div>
          </div>
        )}
        {!scheduledNotifs.enabled && (
          <div style={{fontSize:12,color:'#9CA3AF',fontStyle:'italic'}}>Enable to automatically send scheduled reports to your team via Email and WhatsApp.</div>
        )}
      </div>

      {/* AI Bot Auto-Reply */}
      <div className="card" style={{padding:'18px 20px',marginTop:16,border:waAutoReply?'2px solid #0B7A3E':'2px solid transparent'}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14}}>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <div style={{padding:6,background:waAutoReply?'#D1FAE5':'#F3F4F6',borderRadius:8}}><Bot size={16} color={waAutoReply?'#059669':'#9CA3AF'}/></div>
            <div>
              <h4 style={{fontSize:13,fontWeight:600}}>AI Bot Auto-Reply</h4>
              <p style={{fontSize:11,color:'#94A3B8'}}>Automatically respond to customer keywords</p>
            </div>
          </div>
          <Toggle active={waAutoReply} onClick={()=>setWaAutoReply(!waAutoReply)} color="#0B7A3E"/>
        </div>
        {waAutoReply && (
          <div style={{background:'#F8FAFB',borderRadius:8,padding:12}}>
            <div style={{fontSize:11,fontWeight:600,color:'#64748B',marginBottom:8}}>Active Keyword Triggers:</div>
            {[
              {keyword:'"price" + part number',response:'Returns SG/Dist/Transfer prices'},
              {keyword:'"status" + order ID',response:'Returns order status details'},
              {keyword:'"help"',response:'Lists available commands'},
              {keyword:'"stock"',response:'Returns recent stock check info'}
            ].map((k,i)=>(
              <div key={i} style={{display:'flex',justifyContent:'space-between',padding:'6px 0',borderBottom:i<3?'1px solid #E8ECF0':'none',fontSize:12}}>
                <span style={{fontFamily:'monospace',color:'#0B7A3E'}}>{k.keyword}</span>
                <span style={{color:'#64748B'}}>{k.response}</span>
              </div>
            ))}
            <div style={{marginTop:10,fontSize:11,color:'#94A3B8',display:'flex',alignItems:'center',gap:6}}><Zap size={12}/> Bot uses same logic as in-app AI Assistant</div>
          </div>
        )}
        {!waAutoReply && (
          <div style={{fontSize:12,color:'#9CA3AF',fontStyle:'italic'}}>Enable to let the bot automatically reply to incoming WhatsApp messages based on keywords.</div>
        )}
      </div>
    </div>

    {/* Send Messages */}
    <div>
      <div className="card" style={{padding:'20px 24px',marginBottom:16}}>
        <h4 style={{fontSize:14,fontWeight:600,marginBottom:14}}>Send Message via Baileys</h4>
        {!waConnected && <div style={{padding:12,borderRadius:8,background:'#FEE2E2',fontSize:12,color:'#DC2626',marginBottom:14,display:'flex',gap:6}}><WifiOff size={13}/> Connect WhatsApp first to send messages</div>}
        <div style={{display:'flex',flexDirection:'column',gap:12}}>
          <div>
            <label style={{display:'block',fontSize:12,fontWeight:600,color:'#4A5568',marginBottom:6}}>Template</label>
            <select value={waTemplate} onChange={e=>{setWaTemplate(e.target.value);if(e.target.value!=='custom')setWaMessageText(waTemplates[e.target.value]?.() || '');}} style={{width:'100%'}}>
              <option value="custom">Custom Message</option>
              <option value="backOrder">Back Order Alert</option>
              <option value="deliveryArrived">Delivery Arrived</option>
              <option value="stockAlert">Stock Level Warning</option>
              <option value="monthlyUpdate">Monthly Update</option>
            </select>
          </div>
          <div>
            <label style={{display:'block',fontSize:12,fontWeight:600,color:'#4A5568',marginBottom:6}}>Recipient</label>
            <select value={waRecipient} onChange={e=>setWaRecipient(e.target.value)} style={{width:'100%'}}>
              <option value="">Select recipient...</option>
              {users.filter(u=>u.status==='active'&&u.phone).map(u=><option key={u.id} value={`${u.phone} (${u.name})`}>{u.name} — {u.phone}</option>)}
              <option value="SG Service Team Group">SG Service Team Group</option>
            </select>
          </div>
          <div><label style={{display:'block',fontSize:12,fontWeight:600,color:'#4A5568',marginBottom:6}}>Message</label><textarea value={waMessageText} onChange={e=>setWaMessageText(e.target.value)} rows={5} style={{width:'100%',resize:'vertical',fontFamily:'monospace',fontSize:12}}/></div>
          <button className="bw" onClick={handleWaSend} disabled={!waConnected} style={{opacity:waConnected?1:.5}}><Send size={14}/> Send via Baileys</button>
        </div>
      </div>

      {/* Message Log */}
      <div className="card" style={{padding:'18px 20px'}}>
        <h4 style={{fontSize:13,fontWeight:600,marginBottom:12}}>Message History</h4>
        <div style={{maxHeight:300,overflow:'auto'}}>
          {waMessages.map(m=>(
            <div key={m.id} style={{padding:'10px 12px',borderBottom:'1px solid #F0F2F5',fontSize:12}}>
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
                <span style={{fontWeight:600,color:'#1A202C'}}>{m.to}</span>
                <Pill bg={m.status==='read'?'#DBEAFE':m.status==='delivered'?'#D1FAE5':'#FEF3C7'} color={m.status==='read'?'#2563EB':m.status==='delivered'?'#059669':'#D97706'}>{m.status==='read'?'✓✓':'✓'} {m.status}</Pill>
              </div>
              <div style={{color:'#64748B',fontSize:11,marginBottom:2}}>{m.message.slice(0,80)}{m.message.length>80?'...':''}</div>
              <div style={{color:'#94A3B8',fontSize:10}}>{m.time}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
</div>
  );
}
