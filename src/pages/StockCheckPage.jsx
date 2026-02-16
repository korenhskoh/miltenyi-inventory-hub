import { Upload, Check, X, Download, Search, Trash2 } from "lucide-react";
import { fmtDate } from "../utils.js";
import { Pill, BatchBar, BatchBtn, SelBox } from "../components/ui.jsx";

const StockCheckPage = ({
  stockChecks, setStockChecks,
  stockCheckMode, setStockCheckMode,
  stockInventoryList, setStockInventoryList,
  stockCheckSearch, setStockCheckSearch,
  selStockChecks, setSelStockChecks,
  currentUser,
  addStockCheck, notify, dbSync, api,
  batchDeleteStockChecks, toggleSel, toggleAll, hasPermission
}) => (
<div>
  <div style={{display:'flex',justifyContent:'space-between',marginBottom:20}}>
    <p style={{fontSize:13,color:'#64748B'}}>Upload stock list file and perform inventory audit</p>
  </div>

  {/* Stats */}
  <div className="grid-4" style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:14,marginBottom:24}}>
    {[
      {l:'Total Checks',v:stockChecks.length,c:'#4338CA'},
      {l:'Completed',v:stockChecks.filter(s=>s.status==='Completed').length,c:'#0B7A3E'},
      {l:'In Progress',v:stockChecks.filter(s=>s.status==='In Progress').length,c:'#D97706'},
      {l:'Total Discrepancies',v:stockChecks.reduce((s,c)=>s+c.disc,0),c:'#DC2626'}
    ].map((s,i)=><div key={i} className="card" style={{padding:'18px 22px',borderLeft:`3px solid ${s.c}`}}><div style={{fontSize:11,color:'#94A3B8',textTransform:'uppercase',letterSpacing:.5,marginBottom:4}}>{s.l}</div><div className="mono" style={{fontSize:28,fontWeight:700,color:s.c}}>{s.v}</div></div>)}
  </div>

  {/* Upload Section - Show when no active check */}
  {!stockCheckMode && (
    <div className="card" style={{padding:'24px',marginBottom:20}}>
      <h3 style={{fontSize:15,fontWeight:700,marginBottom:8}}>Start New Stock Check</h3>
      <p style={{fontSize:12,color:'#64748B',marginBottom:20}}>Upload an Excel (.xlsx) or CSV file with your stock list. File should contain columns: Material No, Description, System Qty</p>

      <div className="grid-2" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:20}}>
        {/* File Upload */}
        <label style={{
          display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',
          padding:'40px 24px',border:'2px dashed #D1D5DB',borderRadius:12,
          background:'#F9FAFB',cursor:'pointer',transition:'all 0.2s'
        }}>
          <input type="file" accept=".csv,.xlsx,.xls" onChange={(e)=>{
            const file = e.target.files[0];
            if(!file) return;

            const reader = new FileReader();
            reader.onload = (evt) => {
              const text = evt.target.result;
              const lines = text.split('\n').filter(l=>l.trim());
              const headers = lines[0].split(',').map(h=>h.trim().toLowerCase());

              const matIdx = headers.findIndex(h=>h.includes('material') || h.includes('part') || h.includes('sku'));
              const descIdx = headers.findIndex(h=>h.includes('desc') || h.includes('name') || h.includes('item'));
              const qtyIdx = headers.findIndex(h=>h.includes('qty') || h.includes('quantity') || h.includes('stock') || h.includes('system'));

              const invList = lines.slice(1).map((line,i) => {
                const cols = line.split(',').map(c=>c.trim().replace(/^"|"$/g,''));
                return {
                  id: `INV-${String(i+1).padStart(3,'0')}`,
                  materialNo: matIdx>=0 ? cols[matIdx] : cols[0] || '',
                  description: descIdx>=0 ? cols[descIdx] : cols[1] || '',
                  systemQty: parseInt(qtyIdx>=0 ? cols[qtyIdx] : cols[2]) || 0,
                  physicalQty: 0,
                  checked: false
                };
              }).filter(item => item.materialNo);

              if(invList.length > 0) {
                setStockInventoryList(invList);
                setStockCheckMode(true);
                addStockCheck({
                  id:`SC-${String(stockChecks.length+1).padStart(3,'0')}`,
                  date:new Date().toISOString().slice(0,10),
                  checkedBy:currentUser.name,
                  items:invList.length,
                  disc:0,
                  status:'In Progress',
                  notes:`Uploaded: ${file.name}`,
                  inventory:invList
                });
                notify('File Uploaded',`${invList.length} items loaded for stock check`,'success');
              } else {
                notify('Invalid File','Could not parse items from file','warning');
              }
            };
            reader.readAsText(file);
            e.target.value = '';
          }} style={{display:'none'}}/>
          <Upload size={36} color="#9CA3AF" style={{marginBottom:12}}/>
          <span style={{fontSize:14,fontWeight:600,color:'#374151',marginBottom:4}}>Drop file here or click to upload</span>
          <span style={{fontSize:12,color:'#9CA3AF'}}>CSV or Excel file (.csv, .xlsx)</span>
        </label>

        {/* File Format Guide */}
        <div style={{padding:'20px',background:'#F8FAFB',borderRadius:12}}>
          <h4 style={{fontSize:13,fontWeight:600,marginBottom:12}}>Expected File Format</h4>
          <div style={{fontFamily:'monospace',fontSize:11,background:'#fff',padding:12,borderRadius:8,border:'1px solid #E2E8F0'}}>
            <div style={{color:'#64748B',marginBottom:4}}>Material No, Description, System Qty</div>
            <div>130-095-005, MACSQuant Analyzer, 5</div>
            <div>130-093-235, Pump Head Assembly, 3</div>
            <div>130-042-303, Tubing Set Sterile, 10</div>
          </div>
          <p style={{fontSize:11,color:'#94A3B8',marginTop:12}}>
            Column headers are flexible - the system will detect: material/part/sku, description/name/item, qty/quantity/stock
          </p>
        </div>
      </div>
    </div>
  )}

  {/* Active Stock Check */}
  {stockCheckMode && stockInventoryList.length>0 && (
    <div className="card" style={{padding:'24px',marginBottom:20,border:'2px solid #0B7A3E'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
        <div>
          <h3 style={{fontSize:16,fontWeight:700}}>Active Stock Check</h3>
          <p style={{fontSize:12,color:'#64748B'}}>Enter physical count for each item • {stockInventoryList.filter(i=>i.checked).length}/{stockInventoryList.length} checked</p>
        </div>
        <div style={{display:'flex',gap:8}}>
          <button className="bp" onClick={()=>{
            const discrepancies = stockInventoryList.filter(i=>i.checked && i.physicalQty !== i.systemQty).length;
            const scUpdates = {status:'Completed',disc:discrepancies,notes:`Completed by ${currentUser.name}. ${discrepancies} discrepancies found.`};
            setStockChecks(prev=>prev.map((s,idx)=>idx===0?{...s,...scUpdates}:s));
            if(stockChecks[0]) dbSync(api.updateStockCheck(stockChecks[0].id, scUpdates), 'Stock check update not saved');
            setStockCheckMode(false);
            setStockInventoryList([]);
            notify('Stock Check Completed',`${discrepancies} discrepancies found`,'success');
          }}><Check size={14}/> Complete Check</button>
          <button className="bs" onClick={()=>{setStockCheckMode(false);setStockInventoryList([]);setStockChecks(prev=>prev.slice(1));}}><X size={14}/> Cancel</button>
        </div>
      </div>

      {/* Progress Bar */}
      <div style={{height:8,background:'#E2E8F0',borderRadius:4,marginBottom:20,overflow:'hidden'}}>
        <div style={{height:'100%',width:`${(stockInventoryList.filter(i=>i.checked).length/stockInventoryList.length)*100}%`,background:'linear-gradient(90deg,#006837,#00A550)',borderRadius:4,transition:'width 0.3s'}}/>
      </div>

      <div style={{maxHeight:400,overflow:'auto'}}>
        <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
          <thead style={{position:'sticky',top:0,background:'#F8FAFB',zIndex:10}}><tr><th className="th">Material No.</th><th className="th">Description</th><th className="th" style={{width:100}}>System Qty</th><th className="th" style={{width:120}}>Physical Count</th><th className="th" style={{width:100}}>Variance</th><th className="th" style={{width:80}}>Status</th></tr></thead>
          <tbody>
            {stockInventoryList.map((item,idx)=>{
              const variance = item.checked ? item.physicalQty - item.systemQty : null;
              return (
                <tr key={item.id} style={{borderBottom:'1px solid #F0F2F5',background:item.checked?(variance!==0?'#FEF2F2':'#F0FDF4'):'#fff'}}>
                  <td className="td mono" style={{fontSize:11,color:'#0B7A3E',fontWeight:600}}>{item.materialNo}</td>
                  <td className="td" style={{maxWidth:200,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{item.description}</td>
                  <td className="td" style={{textAlign:'center',fontWeight:600}}>{item.systemQty}</td>
                  <td className="td" style={{textAlign:'center'}}>
                    <input type="number" min="0" value={item.physicalQty||''} placeholder="0" onChange={e=>{
                      const val = parseInt(e.target.value)||0;
                      setStockInventoryList(prev=>prev.map((x,i)=>i===idx?{...x,physicalQty:val,checked:true}:x));
                    }} style={{width:70,padding:'6px 8px',textAlign:'center',borderRadius:6,border:'1px solid #E2E8F0',fontSize:12}}/>
                  </td>
                  <td className="td" style={{textAlign:'center',fontWeight:700,color:variance===null?'#94A3B8':variance===0?'#059669':variance>0?'#2563EB':'#DC2626'}}>
                    {variance===null?'\u2014':variance===0?'Match':variance>0?`+${variance}`:variance}
                  </td>
                  <td className="td">
                    {item.checked ? (
                      variance===0 ? <Pill bg="#D1FAE5" color="#059669">{'\u2713'} OK</Pill> : <Pill bg="#FEE2E2" color="#DC2626">Disc.</Pill>
                    ) : <Pill bg="#F3F4F6" color="#9CA3AF">Pending</Pill>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Summary */}
      <div style={{marginTop:20,padding:16,background:'#F8FAFB',borderRadius:10,display:'flex',justifyContent:'space-between'}}>
        <div><span style={{fontSize:12,color:'#64748B'}}>Checked: </span><strong>{stockInventoryList.filter(i=>i.checked).length}</strong></div>
        <div><span style={{fontSize:12,color:'#64748B'}}>Matches: </span><strong style={{color:'#059669'}}>{stockInventoryList.filter(i=>i.checked && i.physicalQty===i.systemQty).length}</strong></div>
        <div><span style={{fontSize:12,color:'#64748B'}}>Discrepancies: </span><strong style={{color:'#DC2626'}}>{stockInventoryList.filter(i=>i.checked && i.physicalQty!==i.systemQty).length}</strong></div>
        <div><span style={{fontSize:12,color:'#64748B'}}>Pending: </span><strong style={{color:'#D97706'}}>{stockInventoryList.filter(i=>!i.checked).length}</strong></div>
      </div>
    </div>
  )}

  {/* Stock Check History */}
  {hasPermission('deleteStockChecks')&&<BatchBar count={selStockChecks.size} onClear={()=>setSelStockChecks(new Set())}>
    <BatchBtn onClick={batchDeleteStockChecks} bg="#DC2626" icon={Trash2}>Delete Selected</BatchBtn>
  </BatchBar>}
  <div className="card" style={{overflow:'hidden'}}>
    <div style={{padding:'16px 20px',borderBottom:'1px solid #E8ECF0',display:'flex',justifyContent:'space-between',alignItems:'center'}}><span style={{fontWeight:600,fontSize:14}}>Stock Check History</span><div style={{display:'flex',alignItems:'center',gap:12}}><div style={{position:'relative'}}><Search size={15} style={{position:'absolute',left:10,top:10,color:'#94A3B8'}}/><input className="header-search" type="text" placeholder="Search..." value={stockCheckSearch} onChange={e=>setStockCheckSearch(e.target.value)} style={{paddingLeft:32,width:180,height:36}}/></div>{selStockChecks.size>0&&<span style={{fontSize:11,color:'#DC2626',fontWeight:600}}>{selStockChecks.size} selected</span>}</div></div>
    <table style={{width:'100%',borderCollapse:'collapse',fontSize:12.5}}>
      <thead><tr style={{background:'#F8FAFB'}}>{hasPermission('deleteStockChecks')&&<th className="th" style={{width:36}}><SelBox checked={selStockChecks.size===stockChecks.length&&stockChecks.length>0} onChange={()=>toggleAll(selStockChecks,setSelStockChecks,stockChecks.map(r=>r.id))}/></th>}{['ID','Date','Checked By','Items','Discrepancies','Status','Notes','Action'].map(h=><th key={h} className="th">{h}</th>)}</tr></thead>
      <tbody>{(()=>{const fs=stockChecks.filter(r=>!stockCheckSearch||[r.id,r.checkedBy,r.notes||'',r.status].join(' ').toLowerCase().includes(stockCheckSearch.toLowerCase()));return fs.length===0?<tr><td colSpan={hasPermission('deleteStockChecks')?9:8} style={{padding:24,textAlign:'center',color:'#94A3B8',fontSize:13}}>{stockChecks.length===0?'No stock checks recorded yet':'No stock checks match your search.'}</td></tr>:fs.map(r=><tr key={r.id} className="tr" style={{borderBottom:'1px solid #F7FAFC',background:selStockChecks.has(r.id)?'#FEF3C7':'#fff'}}>
        {hasPermission('deleteStockChecks')&&<td className="td"><SelBox checked={selStockChecks.has(r.id)} onChange={()=>toggleSel(selStockChecks,setSelStockChecks,r.id)}/></td>}
        <td className="td mono" style={{fontSize:11,fontWeight:600,color:'#0B7A3E'}}>{r.id}</td>
        <td className="td">{fmtDate(r.date)}</td>
        <td className="td">{r.checkedBy}</td>
        <td className="td" style={{fontWeight:600,textAlign:'center'}}>{r.items}</td>
        <td className="td" style={{textAlign:'center'}}><Pill bg={r.disc>0?'#FEE2E2':'#D1FAE5'} color={r.disc>0?'#DC2626':'#059669'}>{r.disc}</Pill></td>
        <td className="td"><Pill bg={r.status==='Completed'?'#D1FAE5':'#FEF3C7'} color={r.status==='Completed'?'#059669':'#D97706'}>{r.status}</Pill></td>
        <td className="td" style={{color:'#64748B',fontSize:11,maxWidth:180,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{r.notes||'\u2014'}</td>
        <td className="td">
          <div style={{display:'flex',gap:4}}>
          {r.status==='Completed' && (
            <button className="bs" style={{padding:'4px 8px',fontSize:11}} onClick={()=>{notify('Report Downloaded',`${r.id} exported`,'success');}}><Download size={12}/></button>
          )}
          {hasPermission('deleteStockChecks')&&<button onClick={()=>{if(window.confirm(`Delete stock check ${r.id}?`)){setStockChecks(prev=>prev.filter(x=>x.id!==r.id));dbSync(api.deleteStockCheck(r.id),'Stock check delete not saved');notify('Deleted',r.id,'success');}}} style={{background:'#DC2626',color:'#fff',border:'none',borderRadius:6,padding:'4px 8px',fontSize:10,cursor:'pointer'}}><Trash2 size={11}/></button>}
          </div>
        </td>
      </tr>);})()}</tbody>
    </table>
  </div>
</div>
);

export default StockCheckPage;
