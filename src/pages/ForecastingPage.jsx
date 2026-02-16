import { TrendingUp, Settings, ClipboardList, Search, Plus, Check, Trash2 } from "lucide-react";
import { ResponsiveContainer, LineChart, CartesianGrid, XAxis, YAxis, Tooltip, Line } from "recharts";
import { fmt, fmtDate } from "../utils.js";
import { Pill, ExportDropdown } from "../components/ui.jsx";

const ForecastingPage = ({
  orders, machines, setMachines,
  forecastMaterial, setForecastMaterial,
  forecastTab, setForecastTab,
  machineSearch, setMachineSearch,
  showAddMachine, setShowAddMachine,
  newMachine, setNewMachine,
  notify, logAction, dbSync, api
}) => {
  // Build material history: { materialNo -> { months: [{name, qty}], totalQty, description } }
  const materialHistory = {};
  const monthOrder = {jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,oct:9,nov:10,dec:11};
  orders.forEach(o => {
    if (!o.materialNo) return;
    if (!materialHistory[o.materialNo]) materialHistory[o.materialNo] = { materialNo: o.materialNo, description: o.description, monthMap: {}, totalQty: 0, totalCost: 0, orderCount: 0 };
    const h = materialHistory[o.materialNo];
    h.totalQty += (Number(o.quantity)||0);
    h.totalCost += (Number(o.totalCost)||0);
    h.orderCount++;
    if (o.month) {
      const norm = o.month.replace(/^\d+_/,'').replace(/_/g,' ');
      const parts = norm.split(' ');
      const shortLabel = parts.length >= 2 ? `${parts[0].slice(0,3)} '${parts[1].slice(2)}` : norm;
      if (!h.monthMap[shortLabel]) h.monthMap[shortLabel] = { name: shortLabel, qty: 0, _sortKey: norm };
      h.monthMap[shortLabel].qty += (Number(o.quantity)||0);
    }
  });
  const allMaterials = Object.values(materialHistory).sort((a,b) => b.orderCount - a.orderCount);
  const selectedMat = forecastMaterial || (allMaterials[0]?.materialNo || '');
  const matData = materialHistory[selectedMat];
  const matMonthly = matData ? Object.values(matData.monthMap).sort((a,b) => {
    const [am,ay] = a._sortKey.toLowerCase().split(' ');
    const [bm,by] = b._sortKey.toLowerCase().split(' ');
    return (parseInt(ay)||0) - (parseInt(by)||0) || (monthOrder[am?.slice(0,3)]||0) - (monthOrder[bm?.slice(0,3)]||0);
  }) : [];

  // Weighted moving average forecast
  const forecastMonths = [];
  if (matMonthly.length >= 2) {
    const vals = matMonthly.map(m => m.qty);
    const machineGrowth = machines.length > 0 ? 1 + (machines.filter(m=>m.status==='Active').length * 0.02) : 1;
    const futureMonths = ['Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec','Jan','Feb'];
    for (let i = 0; i < 6; i++) {
      const n = vals.length + i;
      const recent = [...vals, ...forecastMonths.map(f=>f.qty)];
      const w1 = recent[recent.length - 1] || 0;
      const w2 = recent[recent.length - 2] || w1;
      const w3 = recent[recent.length - 3] || w2;
      const predicted = Math.round((0.5 * w1 + 0.3 * w2 + 0.2 * w3) * machineGrowth);
      const monthIdx = (new Date().getMonth() + i + 1) % 12;
      forecastMonths.push({ name: `${futureMonths[monthIdx]} '26`, qty: predicted, forecast: true });
    }
  }
  const chartData = [...matMonthly.map(m=>({...m, forecast: false})), ...forecastMonths];

  // Summary forecast for all materials
  const forecastSummary = allMaterials.slice(0, 20).map(mat => {
    const vals = Object.values(mat.monthMap).sort((a,b) => {
      const [am,ay] = a._sortKey.toLowerCase().split(' ');
      const [bm,by] = b._sortKey.toLowerCase().split(' ');
      return (parseInt(ay)||0) - (parseInt(by)||0) || (monthOrder[am?.slice(0,3)]||0) - (monthOrder[bm?.slice(0,3)]||0);
    }).map(m => m.qty);
    const avg = vals.length > 0 ? Math.round(vals.reduce((s,v)=>s+v,0)/vals.length) : 0;
    const lastVal = vals[vals.length - 1] || 0;
    const prevVal = vals[vals.length - 2] || lastVal;
    const trend = lastVal > prevVal ? 'up' : lastVal < prevVal ? 'down' : 'stable';
    const w1 = vals[vals.length-1]||0, w2 = vals[vals.length-2]||w1, w3 = vals[vals.length-3]||w2;
    const predicted = Math.round(0.5*w1 + 0.3*w2 + 0.2*w3);
    const variance = vals.length >= 3 ? Math.sqrt(vals.slice(-3).reduce((s,v)=>s+Math.pow(v-avg,2),0)/3) : 999;
    const confidence = variance < avg * 0.3 ? 'High' : variance < avg * 0.7 ? 'Medium' : 'Low';
    return { ...mat, avgMonthly: avg, trend, predicted, confidence, monthCount: vals.length };
  });

  // Modality stats
  const modalityCounts = {};
  machines.forEach(m => { if (m.status === 'Active') modalityCounts[m.modality] = (modalityCounts[m.modality]||0)+1; });

  return (<div>
    <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:24}}>
      <div style={{padding:10,background:'linear-gradient(135deg,#D97706,#F59E0B)',borderRadius:12}}><TrendingUp size={22} color="#fff"/></div>
      <div><h2 style={{fontSize:18,fontWeight:700,margin:0}}>Material Forecasting</h2><p style={{fontSize:12,color:'#94A3B8',margin:0}}>Predict future material needs based on historical data and machine fleet</p></div>
    </div>

    {/* Tabs */}
    <div style={{display:'flex',gap:4,marginBottom:20,borderBottom:'2px solid #E8ECF0',paddingBottom:2}}>
      {[{id:'forecast',label:'Forecast Dashboard',icon:TrendingUp},{id:'machines',label:'Machine Fleet',icon:Settings},{id:'summary',label:'All Materials Forecast',icon:ClipboardList}].map(tab=>(
        <button key={tab.id} onClick={()=>setForecastTab(tab.id)} style={{display:'flex',alignItems:'center',gap:6,padding:'10px 16px',border:'none',background:forecastTab===tab.id?'#FEF3C7':'transparent',color:forecastTab===tab.id?'#92400E':'#64748B',fontWeight:600,fontSize:13,borderRadius:'8px 8px 0 0',cursor:'pointer',fontFamily:'inherit',borderBottom:forecastTab===tab.id?'2px solid #D97706':'2px solid transparent',marginBottom:-2}}><tab.icon size={15}/> {tab.label}</button>
      ))}
    </div>

    {/* Forecast Dashboard */}
    {forecastTab==='forecast'&&(<div>
      <div className="grid-4" style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:14,marginBottom:20}}>
        {[
          {l:'Unique Materials',v:allMaterials.length,c:'#D97706'},
          {l:'Active Machines',v:machines.filter(m=>m.status==='Active').length,c:'#0B7A3E'},
          {l:'Modalities',v:Object.keys(modalityCounts).length,c:'#2563EB'},
          {l:'Data Months',v:matMonthly.length,c:'#7C3AED'}
        ].map((s,i)=><div key={i} className="card" style={{padding:'18px 22px',borderLeft:`3px solid ${s.c}`}}><div style={{fontSize:11,color:'#94A3B8',textTransform:'uppercase',letterSpacing:.5,marginBottom:4}}>{s.l}</div><div className="mono" style={{fontSize:28,fontWeight:700,color:s.c}}>{s.v}</div></div>)}
      </div>

      <div className="card" style={{padding:'20px 24px',marginBottom:16}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
          <h3 style={{fontSize:15,fontWeight:600,margin:0}}>Material Forecast</h3>
          <select value={selectedMat} onChange={e=>{setForecastMaterial(e.target.value);}} style={{padding:'8px 14px',borderRadius:8,border:'1.5px solid #E2E8F0',fontSize:12,fontFamily:'inherit',minWidth:250}}>
            {allMaterials.map(m=><option key={m.materialNo} value={m.materialNo}>{m.materialNo} — {(m.description||'').slice(0,40)}</option>)}
          </select>
        </div>
        {matData && <div style={{marginBottom:12,padding:'12px 16px',background:'#FEF3C7',borderRadius:10,fontSize:12}}>
          <strong>{matData.description}</strong> — Total ordered: {matData.totalQty} units across {matData.orderCount} orders ({fmt(matData.totalCost)} total)
          {forecastMonths.length>0&&<span style={{marginLeft:8,color:'#92400E'}}> | Next month forecast: <strong>{forecastMonths[0]?.qty} units</strong></span>}
        </div>}
        {chartData.length>0?<ResponsiveContainer width="100%" height={300}><LineChart data={chartData}><CartesianGrid strokeDasharray="3 3" stroke="#F0F2F5"/><XAxis dataKey="name" tick={{fontSize:11,fill:'#94A3B8'}} axisLine={false} tickLine={false}/><YAxis tick={{fontSize:11,fill:'#94A3B8'}} axisLine={false} tickLine={false}/><Tooltip/><Line type="monotone" dataKey="qty" stroke="#D97706" strokeWidth={2.5} dot={(props)=>{const{cx,cy,payload}=props;return payload.forecast?<circle cx={cx} cy={cy} r={5} fill="#fff" stroke="#DC2626" strokeWidth={2} strokeDasharray="3 3"/>:<circle cx={cx} cy={cy} r={4} fill="#D97706"/>;}} name="Quantity"/></LineChart></ResponsiveContainer>:<div style={{height:300,display:'flex',alignItems:'center',justifyContent:'center',color:'#94A3B8'}}>Select a material to view forecast</div>}
        <div style={{display:'flex',gap:16,justifyContent:'center',marginTop:8,fontSize:11,color:'#64748B'}}>
          <span style={{display:'flex',alignItems:'center',gap:4}}><div style={{width:10,height:10,borderRadius:'50%',background:'#D97706'}}/> Historical</span>
          <span style={{display:'flex',alignItems:'center',gap:4}}><div style={{width:10,height:10,borderRadius:'50%',border:'2px dashed #DC2626',background:'#fff'}}/> Forecast</span>
        </div>
      </div>

      {/* Machine Modality Correlation */}
      {machines.length>0&&Object.keys(modalityCounts).length>0&&(
        <div className="card" style={{padding:'20px 24px'}}>
          <h3 style={{fontSize:15,fontWeight:600,marginBottom:16}}>Machine Fleet Overview</h3>
          <div style={{display:'flex',gap:12,flexWrap:'wrap'}}>
            {Object.entries(modalityCounts).map(([mod,cnt])=>(
              <div key={mod} style={{padding:'12px 18px',background:'#F0FDF4',border:'1px solid #BBF7D0',borderRadius:10,minWidth:120}}>
                <div style={{fontSize:11,color:'#64748B',textTransform:'uppercase',letterSpacing:.5,marginBottom:2}}>{mod}</div>
                <div className="mono" style={{fontSize:22,fontWeight:700,color:'#0B7A3E'}}>{cnt}</div>
                <div style={{fontSize:10,color:'#94A3B8'}}>active machines</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>)}

    {/* Machine Fleet Management */}
    {forecastTab==='machines'&&(<div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
        <p style={{fontSize:13,color:'#64748B',margin:0}}>Manage your local machine fleet. Machine count affects forecast predictions.</p>
        <div style={{display:'flex',gap:10,alignItems:'center'}}>
          <div style={{position:'relative'}}><Search size={15} style={{position:'absolute',left:10,top:10,color:'#94A3B8'}}/><input className="header-search" type="text" placeholder="Search machines..." value={machineSearch} onChange={e=>setMachineSearch(e.target.value)} style={{paddingLeft:32,width:200,height:36}}/></div>
          <button className="bp" onClick={()=>setShowAddMachine(true)}><Plus size={14}/> Add Machine</button>
        </div>
      </div>

      <div className="grid-3" style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:14,marginBottom:20}}>
        {[{l:'Total Machines',v:machines.length,c:'#0B7A3E'},{l:'Active',v:machines.filter(m=>m.status==='Active').length,c:'#2563EB'},{l:'Modalities',v:Object.keys(modalityCounts).length,c:'#7C3AED'}].map((s,i)=>(
          <div key={i} className="card" style={{padding:'18px 22px',borderLeft:`3px solid ${s.c}`}}><div style={{fontSize:11,color:'#94A3B8',textTransform:'uppercase',letterSpacing:.5,marginBottom:4}}>{s.l}</div><div className="mono" style={{fontSize:28,fontWeight:700,color:s.c}}>{s.v}</div></div>
        ))}
      </div>

      {showAddMachine&&(
        <div className="card" style={{padding:'20px 24px',marginBottom:16,border:'2px solid #D97706'}}>
          <h4 style={{fontSize:14,fontWeight:600,marginBottom:12}}>Add New Machine</h4>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12}}>
            <div><label style={{display:'block',fontSize:11,fontWeight:600,color:'#4A5568',marginBottom:4}}>Machine Name *</label><input value={newMachine.name} onChange={e=>setNewMachine(p=>({...p,name:e.target.value}))} placeholder="e.g. MACSQuant Analyzer 16" style={{width:'100%',padding:'8px 12px',borderRadius:8,border:'1.5px solid #E2E8F0',fontSize:12}}/></div>
            <div><label style={{display:'block',fontSize:11,fontWeight:600,color:'#4A5568',marginBottom:4}}>Modality *</label><input value={newMachine.modality} onChange={e=>setNewMachine(p=>({...p,modality:e.target.value}))} placeholder="e.g. Cell Analysis, Cell Sorting" style={{width:'100%',padding:'8px 12px',borderRadius:8,border:'1.5px solid #E2E8F0',fontSize:12}}/></div>
            <div><label style={{display:'block',fontSize:11,fontWeight:600,color:'#4A5568',marginBottom:4}}>Location</label><input value={newMachine.location} onChange={e=>setNewMachine(p=>({...p,location:e.target.value}))} placeholder="e.g. Lab A, Singapore" style={{width:'100%',padding:'8px 12px',borderRadius:8,border:'1.5px solid #E2E8F0',fontSize:12}}/></div>
            <div><label style={{display:'block',fontSize:11,fontWeight:600,color:'#4A5568',marginBottom:4}}>Install Date</label><input type="date" value={newMachine.installDate} onChange={e=>setNewMachine(p=>({...p,installDate:e.target.value}))} style={{width:'100%',padding:'8px 12px',borderRadius:8,border:'1.5px solid #E2E8F0',fontSize:12}}/></div>
            <div><label style={{display:'block',fontSize:11,fontWeight:600,color:'#4A5568',marginBottom:4}}>Status</label><select value={newMachine.status} onChange={e=>setNewMachine(p=>({...p,status:e.target.value}))} style={{width:'100%',padding:'8px 12px',borderRadius:8,border:'1.5px solid #E2E8F0',fontSize:12}}><option>Active</option><option>Inactive</option><option>Decommissioned</option></select></div>
            <div><label style={{display:'block',fontSize:11,fontWeight:600,color:'#4A5568',marginBottom:4}}>Notes</label><input value={newMachine.notes} onChange={e=>setNewMachine(p=>({...p,notes:e.target.value}))} placeholder="Optional notes" style={{width:'100%',padding:'8px 12px',borderRadius:8,border:'1.5px solid #E2E8F0',fontSize:12}}/></div>
          </div>
          <div style={{display:'flex',gap:8,marginTop:12}}>
            <button className="bp" onClick={()=>{
              if(!newMachine.name||!newMachine.modality){notify('Missing Fields','Name and Modality are required','warning');return;}
              const m = {...newMachine};
              dbSync(api.createMachine(m).then(saved=>{if(saved){setMachines(prev=>[saved,...prev]);logAction('create','machine',String(saved.id),{name:m.name,modality:m.modality});}}),'Machine not saved');
              setNewMachine({name:'',modality:'',location:'',installDate:'',status:'Active',notes:''});
              setShowAddMachine(false);
              notify('Machine Added',`${m.name} (${m.modality})`,'success');
            }}><Check size={14}/> Save Machine</button>
            <button className="bs" onClick={()=>setShowAddMachine(false)}>Cancel</button>
          </div>
        </div>
      )}

      <div className="card" style={{overflow:'hidden'}}>
        <table style={{width:'100%',borderCollapse:'collapse',fontSize:12.5}}>
          <thead><tr style={{background:'#F8FAFB'}}>{['Name','Modality','Location','Install Date','Status','Actions'].map(h=><th key={h} className="th">{h}</th>)}</tr></thead>
          <tbody>{(()=>{const fm=machines.filter(m=>!machineSearch||[m.name,m.modality,m.location,m.status].join(' ').toLowerCase().includes(machineSearch.toLowerCase()));return fm.length===0?<tr><td colSpan={6} style={{padding:24,textAlign:'center',color:'#94A3B8',fontSize:13}}>{machines.length===0?'No machines added yet. Add machines to improve forecast accuracy.':'No machines match your search.'}</td></tr>:fm.map(m=>(
            <tr key={m.id} className="tr" style={{borderBottom:'1px solid #F7FAFC'}}>
              <td className="td" style={{fontWeight:600}}>{m.name}</td>
              <td className="td"><Pill bg="#EDE9FE" color="#7C3AED">{m.modality}</Pill></td>
              <td className="td" style={{color:'#64748B'}}>{m.location||'\u2014'}</td>
              <td className="td" style={{fontSize:11,color:'#94A3B8'}}>{m.installDate?fmtDate(m.installDate):'\u2014'}</td>
              <td className="td"><Pill bg={m.status==='Active'?'#D1FAE5':m.status==='Inactive'?'#FEF3C7':'#F3F4F6'} color={m.status==='Active'?'#059669':m.status==='Inactive'?'#D97706':'#64748B'}>{m.status}</Pill></td>
              <td className="td"><button onClick={()=>{if(window.confirm(`Delete machine "${m.name}"?`)){setMachines(prev=>prev.filter(x=>x.id!==m.id));dbSync(api.deleteMachine(m.id),'Machine delete failed');logAction('delete','machine',String(m.id),{name:m.name});notify('Deleted',m.name,'success');}}} style={{background:'#DC2626',color:'#fff',border:'none',borderRadius:6,padding:'4px 8px',fontSize:10,cursor:'pointer',display:'flex',alignItems:'center',gap:3}}><Trash2 size={11}/> Delete</button></td>
            </tr>
          ));})()}</tbody>
        </table>
      </div>
    </div>)}

    {/* All Materials Forecast Summary */}
    {forecastTab==='summary'&&(<div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
        <p style={{fontSize:13,color:'#64748B',margin:0}}>Predicted material needs for next month based on historical trends</p>
        <ExportDropdown data={forecastSummary} columns={[{key:'materialNo',label:'Material No'},{key:'description',label:'Description'},{key:'orderCount',label:'Orders'},{key:'totalQty',label:'Total Qty'},{key:'avgMonthly',label:'Avg Monthly'},{key:'predicted',label:'Predicted Next'},{key:'trend',label:'Trend'},{key:'confidence',label:'Confidence'}]} filename="forecast-summary" title="Material Forecast Summary"/>
      </div>
      <div className="card" style={{overflow:'hidden'}}>
        <div style={{maxHeight:600,overflowY:'auto'}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:12.5}}>
            <thead><tr style={{background:'#F8FAFB',position:'sticky',top:0,zIndex:1}}>{['Material No','Description','Total Orders','Total Qty','Avg Monthly','Trend','Predicted Next Month','Confidence'].map(h=><th key={h} className="th">{h}</th>)}</tr></thead>
            <tbody>{forecastSummary.length===0?<tr><td colSpan={8} style={{padding:24,textAlign:'center',color:'#94A3B8',fontSize:13}}>No order history available for forecasting</td></tr>:forecastSummary.map((m,i)=>(
              <tr key={m.materialNo} className="tr" style={{borderBottom:'1px solid #F7FAFC',background:i%2===0?'#fff':'#FCFCFD',cursor:'pointer'}} onClick={()=>{setForecastMaterial(m.materialNo);setForecastTab('forecast');}}>
                <td className="td mono" style={{fontSize:11,fontWeight:600,color:'#0B7A3E'}}>{m.materialNo}</td>
                <td className="td" style={{maxWidth:200,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{m.description}</td>
                <td className="td" style={{textAlign:'center',fontWeight:600}}>{m.orderCount}</td>
                <td className="td" style={{textAlign:'center'}}>{m.totalQty}</td>
                <td className="td" style={{textAlign:'center'}}>{m.avgMonthly}</td>
                <td className="td" style={{textAlign:'center'}}>{m.trend==='up'?<span style={{color:'#DC2626'}}>↑ Up</span>:m.trend==='down'?<span style={{color:'#059669'}}>↓ Down</span>:<span style={{color:'#64748B'}}>→ Stable</span>}</td>
                <td className="td" style={{textAlign:'center'}}><span className="mono" style={{fontWeight:700,fontSize:14,color:'#D97706'}}>{m.predicted}</span></td>
                <td className="td"><Pill bg={m.confidence==='High'?'#D1FAE5':m.confidence==='Medium'?'#FEF3C7':'#FEE2E2'} color={m.confidence==='High'?'#059669':m.confidence==='Medium'?'#D97706':'#DC2626'}>{m.confidence}</Pill></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </div>
    </div>)}
  </div>);
};

export default ForecastingPage;
