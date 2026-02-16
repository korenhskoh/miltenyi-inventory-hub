import { useState, useEffect, useRef } from "react";
import { CheckCircle, AlertTriangle, Clock, X, Bell, Truck, Download } from "lucide-react";
import { exportToFile, exportToPDF } from "../utils.js";

// ════════════════════════════ STATUS CONFIG ══════════════════════════
export const STATUS_CFG = {
  Received: { color: '#0B7A3E', bg: '#E6F4ED', icon: CheckCircle },
  'Pending Approval': { color: '#7C3AED', bg: '#EDE9FE', icon: Clock },
  Approved: { color: '#059669', bg: '#D1FAE5', icon: CheckCircle },
  Rejected: { color: '#DC2626', bg: '#FEE2E2', icon: X },
};

export const Badge = ({ status }) => { const c = STATUS_CFG[status]||STATUS_CFG['Pending Approval']; const I=c.icon; return <span style={{ display:'inline-flex',alignItems:'center',gap:4,padding:'3px 10px',borderRadius:20,fontSize:11,fontWeight:600,color:c.color,background:c.bg }}><I size={12}/> {status}</span>; };

export const ArrivalBadge = ({ order }) => { if (!order) return <span style={{color:'#CBD5E1',fontSize:11}}>{'\u2014'}</span>; const qr = order.qtyReceived||0; const qt = order.quantity||0; const ratio = qt>0?<span style={{opacity:.7,fontSize:9,marginLeft:1}}>{qr}/{qt}</span>:null; if (order.status === 'Received' || (qr >= qt && qt > 0)) return <span style={{display:'inline-flex',alignItems:'center',gap:4,padding:'3px 10px',borderRadius:20,fontSize:10,fontWeight:600,color:'#0B7A3E',background:'#D1FAE5'}}><CheckCircle size={11}/> {ratio} Arrived</span>; if (order.arrivalDate && qr < qt) return <span style={{display:'inline-flex',alignItems:'center',gap:4,padding:'3px 10px',borderRadius:20,fontSize:10,fontWeight:600,color:'#C53030',background:'#FEE2E2'}}><AlertTriangle size={11}/> {ratio} Back Order</span>; if (order.approvalStatus === 'approved') return <span style={{display:'inline-flex',alignItems:'center',gap:4,padding:'3px 10px',borderRadius:20,fontSize:10,fontWeight:600,color:'#64748B',background:'#F1F5F9'}}><Truck size={11}/> {ratio} Awaiting</span>; return <span style={{color:'#CBD5E1',fontSize:11}}>{'\u2014'}</span>; };

export const Pill = ({ bg, color, children }) => <span className="pill" style={{ background: bg, color }}>{children}</span>;

export const Toggle = ({ active, onClick, color }) => <div onClick={onClick} style={{ width:40,height:22,borderRadius:11,background:active?(color||'#0B7A3E'):'#E2E8F0',cursor:'pointer',position:'relative',transition:'background 0.2s' }}><div style={{ width:18,height:18,borderRadius:'50%',background:'#fff',position:'absolute',top:2,left:active?20:2,transition:'left 0.2s',boxShadow:'0 1px 3px rgba(0,0,0,0.15)' }}/></div>;

export const Toast = ({ items, onDismiss }) => <div style={{ position:'fixed',top:80,right:24,zIndex:9999,display:'flex',flexDirection:'column',gap:8,maxWidth:380 }}>{items.map((n,i) => <div key={i} style={{ background:n.type==='success'?'#0B7A3E':n.type==='warning'?'#D97706':'#2563EB',color:'#fff',padding:'12px 16px',borderRadius:10,boxShadow:'0 8px 24px rgba(0,0,0,0.18)',display:'flex',alignItems:'center',gap:10,animation:'slideIn 0.3s' }}>{n.type==='success'?<CheckCircle size={18}/>:n.type==='warning'?<AlertTriangle size={18}/>:<Bell size={18}/>}<div style={{flex:1}}><div style={{fontWeight:600,fontSize:13}}>{n.title}</div><div style={{fontSize:11,opacity:0.9}}>{n.message}</div></div><button onClick={()=>onDismiss(i)} style={{background:'none',border:'none',color:'#fff',cursor:'pointer'}}><X size={14}/></button></div>)}</div>;

// ════════════════════════════ BATCH ACTION BAR ══════════════════════
export const BatchBar = ({ count, onClear, children }) => count > 0 ? (
  <div className="batch-bar" style={{display:'flex',alignItems:'center',gap:10,padding:'10px 16px',background:'linear-gradient(135deg,#1E293B,#334155)',borderRadius:10,marginBottom:12,color:'#fff',fontSize:13,flexWrap:'wrap',animation:'slideIn 0.2s'}}>
    <span style={{fontWeight:700,minWidth:90}}>{count} selected</span>
    <div style={{display:'flex',gap:6,flex:1,flexWrap:'wrap'}}>{children}</div>
    <button onClick={onClear} style={{background:'rgba(255,255,255,0.15)',border:'none',color:'#fff',padding:'5px 12px',borderRadius:6,fontSize:11,fontWeight:600,cursor:'pointer',display:'flex',alignItems:'center',gap:4}}>Clear</button>
  </div>
) : null;

export const BatchBtn = ({ onClick, bg, icon: I, children }) => (
  <button onClick={onClick} style={{display:'flex',alignItems:'center',gap:4,padding:'5px 12px',background:bg||'rgba(255,255,255,0.15)',border:'none',color:'#fff',borderRadius:6,fontSize:11,fontWeight:600,cursor:'pointer',whiteSpace:'nowrap'}}>{I&&<I size={12}/>}{children}</button>
);

// ════════════════════════════ SORT HEADER ══════════════════════════
export const SortTh = ({ label, sortKey, sortCfg, onSort, style }) => (
  <th className="th" style={{ cursor: 'pointer', userSelect: 'none', ...style }} onClick={() => onSort(sortKey)}>
    {label} {sortCfg.key === sortKey ? (sortCfg.dir === 'asc' ? '\u2191' : '\u2193') : ''}
  </th>
);

// ════════════════════════════ EXPORT DROPDOWN ══════════════════════
export const ExportDropdown = ({ data, columns, filename, title }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => { const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }; document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h); }, []);
  return (
    <div ref={ref} style={{position:'relative',display:'inline-block'}}>
      <button onClick={()=>setOpen(!open)} className="bs" style={{padding:'6px 12px',display:'flex',alignItems:'center',gap:5,fontSize:12,fontWeight:600}}><Download size={13}/> Export</button>
      {open && <div style={{position:'absolute',right:0,top:'100%',marginTop:4,background:'#fff',border:'1px solid #E2E8F0',borderRadius:10,boxShadow:'0 8px 24px rgba(0,0,0,0.12)',zIndex:100,minWidth:150,overflow:'hidden'}}>
        {[{label:'CSV (.csv)',fmt:'csv'},{label:'Excel (.xlsx)',fmt:'xlsx'},{label:'PDF (Print)',fmt:'pdf'}].map(opt=>(
          <button key={opt.fmt} onClick={()=>{setOpen(false);if(opt.fmt==='pdf')exportToPDF(data,columns,title);else exportToFile(data,columns,filename,opt.fmt);}} style={{display:'block',width:'100%',padding:'10px 16px',border:'none',background:'#fff',textAlign:'left',fontSize:12,cursor:'pointer',fontFamily:'inherit',color:'#1A202C',borderBottom:'1px solid #F0F2F5'}} onMouseOver={e=>e.target.style.background='#F0FDF4'} onMouseOut={e=>e.target.style.background='#fff'}>{opt.label}</button>
        ))}
      </div>}
    </div>
  );
};

export const SelBox = ({ checked, onChange }) => (
  <input type="checkbox" checked={checked} onChange={onChange} style={{width:16,height:16,cursor:'pointer',accentColor:'#0B7A3E'}}/>
);

// ════════════════════════════ QR CODE GENERATOR ══════════════════════
export const QRCodeCanvas = ({ text, size = 200 }) => {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const modules = 25;
    const cellSize = size / modules;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = '#000000';
    let seed = 0;
    for (let i = 0; i < text.length; i++) seed = ((seed << 5) - seed) + text.charCodeAt(i);
    const rng = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
    const drawFinder = (x, y) => {
      for (let i = 0; i < 7; i++) for (let j = 0; j < 7; j++) {
        if (i===0||i===6||j===0||j===6||(i>=2&&i<=4&&j>=2&&j<=4)) ctx.fillRect((x+j)*cellSize, (y+i)*cellSize, cellSize, cellSize);
      }
    };
    drawFinder(0, 0); drawFinder(modules-7, 0); drawFinder(0, modules-7);
    for (let i = 0; i < modules; i++) for (let j = 0; j < modules; j++) {
      if ((i<7&&j<7)||(i<7&&j>=modules-7)||(i>=modules-7&&j<7)) continue;
      if (rng() > 0.5) ctx.fillRect(j*cellSize, i*cellSize, cellSize, cellSize);
    }
  }, [text, size]);
  return <canvas ref={canvasRef} width={size} height={size} style={{ borderRadius: 8, border: '4px solid #fff', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }} />;
};
