<!doctype html>
<html lang="id">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Compliance Rule Center — MC Almara</title>
    <style>
        body{font-family:Inter,system-ui,-apple-system,Segoe UI,sans-serif;margin:0;background:#f4f6f8;color:#18212f}
        .wrap{max-width:1400px;margin:30px auto;padding:0 20px}.head{display:flex;justify-content:space-between;align-items:center;margin-bottom:20px}
        h1{margin:0;font-size:25px}.sub{color:#697586;margin-top:5px}.card{background:#fff;border:1px solid #e3e7ed;border-radius:14px;padding:20px;margin-bottom:18px;box-shadow:0 3px 14px #00000008}
        .grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}.field{display:flex;flex-direction:column;gap:6px}.field label{font-size:12px;font-weight:700;color:#5b6575}.field input,.field select,.field textarea{min-height:38px;border:1px solid #ccd3dd;border-radius:8px;padding:8px 10px;box-sizing:border-box;font:inherit}.field textarea{min-height:70px}
        .wide{grid-column:span 2}.actions{display:flex;gap:8px;align-items:end}.btn{height:38px;border:0;border-radius:8px;padding:0 14px;font-weight:700;cursor:pointer}.primary{background:#1677ff;color:#fff}.muted{background:#eef1f5;color:#344054}
        table{width:100%;border-collapse:collapse;font-size:13px}th,td{padding:11px 9px;border-bottom:1px solid #edf0f3;text-align:left;vertical-align:top}th{font-size:11px;text-transform:uppercase;color:#667085;background:#fafbfc}
        .pill{display:inline-flex;padding:4px 8px;border-radius:999px;font-size:11px;font-weight:700}.green{background:#e8f7ed;color:#16733a}.orange{background:#fff3db;color:#9a5b00}.gray{background:#eef1f5;color:#667085}.blue{background:#e8f1ff;color:#145dcc}
        .alert{padding:12px;border-radius:9px;margin-bottom:12px}.ok{background:#eaf8ef;color:#176b37}.err{background:#fff0f0;color:#a32121}.note{font-size:12px;color:#667085}.modal{position:fixed;inset:0;background:#0008;display:none;align-items:center;justify-content:center;padding:20px;z-index:20}.modal.show{display:flex}.modalbox{background:#fff;border-radius:14px;max-width:1100px;width:100%;max-height:90vh;overflow:auto;padding:22px}.detailgrid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:16px}.stat{background:#f7f9fb;border:1px solid #e6eaf0;border-radius:10px;padding:10px}.stat b{display:block;font-size:16px}.smallbtn{height:32px;border:0;border-radius:7px;padding:0 10px;font-weight:700;cursor:pointer}.reviewbtn{background:#fff3db;color:#8a5200}.secondary{background:#eef1f5;color:#344054}.danger{background:#fff0f0;color:#a32121}
        @media(max-width:1000px){.grid{grid-template-columns:1fr 1fr}.wide{grid-column:span 2}} @media(max-width:600px){.grid{grid-template-columns:1fr}.wide{grid-column:span 1}.detailgrid{grid-template-columns:1fr 1fr}}
    </style>
</head>
<body>
<div class="wrap">
    <div class="head">
        <div><h1>Compliance Rule Center</h1><div class="sub">Pengaturan internal ketentuan BI / APU-PPT / PPATK dan monitoring MC Almara</div></div>
        <a href="/" class="btn muted" style="text-decoration:none;display:flex;align-items:center">← Dashboard</a>
    </div>

    <div id="msg"></div>

    <div class="card">
        <h3 id="formTitle" style="margin-top:0">Tambah Rule</h3>
        <input type="hidden" id="rule_id">
        <div class="grid">
            <div class="field wide"><label>Nama Rule</label><input id="name" value=""></div>
            <div class="field"><label>Kode Rule</label><input id="code" placeholder="BI-... / IM-..."></div>
            <div class="field"><label>Jenis Rule</label><select id="rule_type"><option value="REGULATORY">REGULATORY</option><option value="INTERNAL_MONITORING">INTERNAL MONITORING</option></select></div>
            <div class="field"><label>Target</label><select id="target"><option value="CUSTOMER">CUSTOMER / NASABAH</option></select></div>
            <div class="field"><label>Sumber Regulasi</label><input id="regulation_source" placeholder="BI / PPATK / Internal"></div>
            <div class="field"><label>Nomor Regulasi</label><input id="regulation_no" placeholder="PBI ... / PADG ..."></div>
            <div class="field"><label>Pasal / Ketentuan</label><input id="regulation_article" placeholder="Pasal / bagian"></div>
            <div class="field"><label>Berlaku Mulai</label><input id="effective_from" type="date"></div>
            <div class="field"><label>Berlaku Sampai</label><input id="effective_until" type="date"></div>
            <div class="field"><label>Minimal Transaksi</label><input id="min_transactions" type="number" min="1" placeholder="Kosongkan jika tidak dipakai"></div>
            <div class="field"><label>Periode (hari)</label><input id="period_days" type="number" min="1" placeholder="Kosongkan jika tidak dipakai"></div>
            <div class="field"><label>Total Nominal IDR</label><input id="total_amount_idr" type="number" min="0" placeholder="0"></div>
            <div class="field"><label>Operator Nominal</label><select id="amount_operator"><option>></option><option>>=</option><option>=</option><option><</option><option><=</option></select></div>
            <div class="field"><label>Metode Pembayaran</label><input id="payment_method" placeholder="CASH / TRANSFER / kosong = semua"></div>
            <div class="field"><label>Jenis Transaksi</label><select id="transaction_type"><option value="">Semua JUAL/BELI</option><option value="JUAL">JUAL</option><option value="BELI">BELI</option></select></div>
            <div class="field"><label>Hasil Jika Terpenuhi</label><select id="result_type">
                <option value="LTKT">Kandidat LTKT</option>
                <option value="LTKM">Kandidat LTKM</option>
                <option value="LTKL">Kandidat LTKL</option>
                <option value="LKU_BI">Masuk LKU BI</option>
                <option value="CDD">Wajib / Cek CDD</option>
                <option value="UNDERLYING">Cek Underlying</option>
                <option value="COMPLIANCE_REVIEW" selected>Compliance Review</option>
                <option value="INTERNAL_ALERT">Internal Alert</option>
            </select></div>
            <div class="field"><label>Severity</label><select id="severity"><option>INFO</option><option selected>WARNING</option><option>REVIEW</option><option>BLOCK</option></select></div>
            <div class="field"><label>Action</label><select id="action"><option>ALERT</option><option selected>REVIEW</option><option>FLAG</option><option>REQUIRE_APPROVAL</option><option>BLOCK</option></select></div>
            <div class="field"><label>Priority</label><input id="priority" type="number" value="100" min="1"></div>
            <div class="field wide"><label>Catatan Internal</label><textarea id="internal_note" placeholder="Catatan interpretasi internal / sumber / cara pemeriksaan"></textarea></div>
            <div class="field actions"><button class="btn primary" onclick="saveRule()">Simpan Rule</button><button class="btn muted" onclick="resetForm()">Batal / Rule Baru</button></div>
        </div>
        <p class="note">Untuk monitoring LTKM, JUAL dan BELI dapat dipisahkan. Jika <b>Jenis Transaksi</b> dipilih, agregasi hanya menghitung transaksi jenis tersebut; JUAL dan BELI tidak digabung. Rule LTKM Rp500 juta adalah <b>monitoring internal</b>, bukan threshold otomatis LTKM.</p>
        <p class="note">Rule hanya menghasilkan temuan/kandidat internal. Sistem tidak mengirim laporan ke GoAML. Keputusan akhir tetap oleh Compliance.</p>
    </div>

    <div class="card">
        <h3 style="margin-top:0">Rule Aktif / Tersimpan</h3>
        <div id="rules">Memuat...</div>
    </div>

    <div class="card">
        <h3 style="margin-top:0">Temuan Compliance Terbaru</h3>
        <div id="alerts">Memuat...</div>
    </div>

    <div id="detailModal" class="modal" onclick="if(event.target===this)closeDetail()">
        <div class="modalbox">
            <div style="display:flex;justify-content:space-between;gap:12px;align-items:center">
                <div><h2 id="detailTitle" style="margin:0">Detail Temuan</h2><div id="detailSub" class="sub"></div></div>
                <button class="smallbtn secondary" onclick="closeDetail()">Tutup</button>
            </div>
            <div id="detailBody" style="margin-top:18px"></div>
        </div>
    </div>
</div>
<script>
(function(){
'use strict';
const api=(p,o={})=>fetch('/api'+p,{credentials:'same-origin',cache:'no-store',headers:{'Accept':'application/json','Content-Type':'application/json',...(o.headers||{})},...o}).then(async r=>{const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.message||'HTTP '+r.status);return j});

const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const el=id=>document.getElementById(id);
function show(type,text){el('msg').innerHTML='<div class="alert '+(type==='ok'?'ok':'err')+'">'+esc(text)+'</div>';setTimeout(()=>el('msg').innerHTML='',4000)}
function resetForm(){el('rule_id').value='';el('formTitle').textContent='Tambah Rule';['name','code','regulation_source','regulation_no','regulation_article','effective_from','effective_until','min_transactions','period_days','total_amount_idr','payment_method','internal_note'].forEach(id=>el(id).value='');el('transaction_type').value='';el('rule_type').value='REGULATORY';el('target').value='CUSTOMER';el('amount_operator').value='>';el('result_type').value='COMPLIANCE_REVIEW';el('severity').value='WARNING';el('action').value='REVIEW';el('priority').value='100')}
function editRule(id){
 api('/goaml/rules').then(rows=>{const r=rows.find(x=>Number(x.id)===Number(id));if(!r)return;
  el('rule_id').value=r.id;el('formTitle').textContent='Edit Rule v'+r.version;
  ['name','code','regulation_source','regulation_no','regulation_article','effective_from','effective_until','min_transactions','period_days','total_amount_idr','payment_method','internal_note'].forEach(k=>el(k).value=r[k]??'');
  el('transaction_type').value=(r.conditions&&r.conditions.transaction_type)||'';
  el('rule_type').value=r.rule_type||'REGULATORY';el('target').value=r.target||'CUSTOMER';el('amount_operator').value=r.amount_operator||'>';el('result_type').value=r.result_type||'COMPLIANCE_REVIEW';el('severity').value=r.severity||'WARNING';el('action').value=r.action||'REVIEW';el('priority').value=r.priority||100;window.scrollTo({top:0,behavior:'smooth'});
 }).catch(e=>show('err',e.message))
}
async function loadRules(){
 const rows=await api('/goaml/rules');
 el('rules').innerHTML='<table><thead><tr><th>Rule / Regulasi</th><th>Kriteria</th><th>Hasil</th><th>Severity</th><th>Status</th><th>Versi</th><th>Aksi</th></tr></thead><tbody>'+
 rows.map(r=>'<tr><td><b>'+esc(r.name)+'</b><br><span class="note">'+esc(r.code)+' · '+esc(r.rule_type)+'</span><br><span class="note">'+esc(r.regulation_source||'')+' '+esc(r.regulation_no||'')+(r.regulation_article?' · '+esc(r.regulation_article):'')+'</span></td>'+
 '<td>'+esc(r.min_transactions??'—')+' transaksi / '+esc(r.period_days??'—')+' hari<br>'+esc(r.amount_operator||'')+' Rp '+Number(r.total_amount_idr||0).toLocaleString('id-ID')+(r.payment_method?' · '+esc(r.payment_method):'')+((r.conditions&&r.conditions.transaction_type)?' · '+esc(r.conditions.transaction_type):'')+'</td>'+
 '<td><span class="pill blue">'+esc(r.result_type||'COMPLIANCE_REVIEW')+'</span></td><td>'+esc(r.severity)+'</td><td>'+(r.is_active?'<span class="pill green">AKTIF</span>':'<span class="pill gray">NONAKTIF</span>')+'</td><td>'+esc(r.version)+'</td>'+
 '<td><button class="smallbtn secondary" onclick="editRule('+Number(r.id)+')">Edit</button></td></tr>').join('')+'</tbody></table>';
}
async function loadAlerts(){
 const rows=await api('/goaml/alerts');
 if(!rows.length){el('alerts').innerHTML='<div class="note">Belum ada temuan.</div>';return}
 el('alerts').innerHTML='<table><thead><tr><th>Temuan / Invoice</th><th>Customer</th><th>Rule</th><th>Hasil</th><th>Total</th><th>Status</th><th>Aksi</th></tr></thead><tbody>'+
 rows.map(a=>'<tr><td><b>'+esc(a.alert_no)+'</b><br><span class="note">'+esc(a.invoice_summary||'—')+'</span></td><td>'+esc(a.customer_name||'—')+'<br><span class="note">'+esc(a.customer_id||'—')+'</span></td><td>'+esc(a.rule?.name||'—')+'</td><td><span class="pill blue">'+esc(a.result_type||'COMPLIANCE_REVIEW')+'</span></td><td>Rp '+Number(a.total_amount_idr||0).toLocaleString('id-ID')+'</td><td><span class="pill '+(a.status==='OPEN'?'orange':'gray')+'">'+esc(a.status)+'</span></td><td><button class="smallbtn secondary" onclick="showDetail('+Number(a.id)+')">Detail</button> <button class="smallbtn reviewbtn" onclick="reviewAlert('+Number(a.id)+')">Review</button></td></tr>').join('')+'</tbody></table>';
}
function closeDetail(){el('detailModal').classList.remove('show')}
async function showDetail(id){
 try{
  const rows=await api('/goaml/alerts');const a=rows.find(x=>Number(x.id)===Number(id));if(!a)return;
  el('detailTitle').textContent=a.alert_no;el('detailSub').textContent=(a.customer_name||'—')+' · '+(a.customer_id||'—');
  const tx=(a.transactions||[]).map(x=>x.transaction||{});
  el('detailBody').innerHTML='<div class="detailgrid"><div class="stat"><span class="note">Hasil</span><b>'+esc(a.result_type||'—')+'</b></div><div class="stat"><span class="note">Status</span><b>'+esc(a.status)+'</b></div><div class="stat"><span class="note">Transaksi</span><b>'+esc(a.transaction_count)+'</b></div><div class="stat"><span class="note">Total</span><b>Rp '+Number(a.total_amount_idr||0).toLocaleString('id-ID')+'</b></div></div>'+
  '<p><b>Rule:</b> '+esc(a.rule?.name||'—')+'</p><p><b>Regulasi:</b> '+esc(a.rule?.regulation_source||'—')+' '+esc(a.rule?.regulation_no||'')+' '+esc(a.rule?.regulation_article||'')+'</p><p><b>Alasan:</b> '+esc(a.reason||'—')+'</p>'+
  '<table><thead><tr><th>No. Invoice</th><th>Tanggal</th><th>Valuta</th><th>Nominal</th><th>Total IDR</th></tr></thead><tbody>'+
  tx.map(t=>'<tr><td><b>'+esc(t.id||'—')+'</b></td><td>'+esc(t.timestamp||'—')+'</td><td>'+esc(t.valuta||'—')+'</td><td>'+Number(t.nominal||0).toLocaleString('id-ID')+'</td><td>Rp '+Number(t.total||0).toLocaleString('id-ID')+'</td></tr>').join('')+
  '</tbody></table><div style="margin-top:16px"><b>Catatan Review</b><div class="note" style="margin-top:5px">'+esc(a.review_note||'Belum ada review')+'</div></div>';
  el('detailModal').classList.add('show');
 }catch(e){show('err',e.message)}
}
async function reviewAlert(id){
 const status=prompt('Status review: IN_REVIEW / APPROVED / REJECTED / ESCALATED','IN_REVIEW');if(!status)return;
 const note=prompt('Catatan Compliance (opsional):','');
 try{await api('/goaml/alerts/'+id+'/review',{method:'POST',body:JSON.stringify({status:status.toUpperCase(),review_note:note||null})});show('ok','Review berhasil disimpan');loadAlerts()}catch(e){show('err',e.message)}
}
async function saveRule(){
 try{
  const id=el('rule_id').value;
  const body={name:el('name').value,code:el('code').value,rule_type:el('rule_type').value,regulation_source:el('regulation_source').value||null,regulation_no:el('regulation_no').value||null,regulation_article:el('regulation_article').value||null,effective_from:el('effective_from').value||null,effective_until:el('effective_until').value||null,target:el('target').value,classification:el('rule_type').value==='INTERNAL_MONITORING'?'INTERNAL_WARNING':null,severity:el('severity').value,action:el('action').value,result_type:el('result_type').value,min_transactions:el('min_transactions').value?Number(el('min_transactions').value):null,period_days:el('period_days').value?Number(el('period_days').value):null,total_amount_idr:el('total_amount_idr').value?Number(el('total_amount_idr').value):null,amount_operator:el('amount_operator').value,payment_method:el('payment_method').value||null,internal_note:el('internal_note').value||null,priority:Number(el('priority').value||100),is_active:true,conditions:{logic:'AND',aggregation:'CUSTOMER',amount_basis:'IDR_TOTAL',transaction_type:el('transaction_type').value||null}};
  await api(id?'/goaml/rules/'+id:'/goaml/rules',{method:id?'PUT':'POST',body:JSON.stringify(body)});show('ok',id?'Rule diperbarui dan versinya dinaikkan':'Rule berhasil disimpan');resetForm();loadRules();
 }catch(e){show('err',e.message)}
}
function setLoading(id,text){const node=el(id);if(node)node.innerHTML='<div class="note">'+esc(text)+'</div>'}
function renderError(id,label,error,fn){
 const node=el(id); if(!node)return;
 node.innerHTML='<div class="alert err"><b>'+esc(label)+'</b><br>'+esc(error?.message||error||'Terjadi kesalahan')+'<br><button class="smallbtn secondary" style="margin-top:8px" onclick="'+fn+'()">Coba Lagi</button></div>';
}
async function boot(){
 try{resetForm();setLoading('rules','Memuat rule compliance...');setLoading('alerts','Memuat temuan compliance...');}
 catch(e){console.error('[GOAML] init error',e)}
 try{await loadRules();}catch(e){console.error('[GOAML] loadRules failed',e);renderError('rules','Gagal memuat Rule Compliance',e,'loadRules')}
 try{await loadAlerts();}catch(e){console.error('[GOAML] loadAlerts failed',e);renderError('alerts','Gagal memuat Temuan Compliance',e,'loadAlerts')}
}
window.addEventListener('error',function(e){console.error('[GOAML] JavaScript error',e.error||e.message)});
window.addEventListener('unhandledrejection',function(e){console.error('[GOAML] Promise error',e.reason)});
if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',boot,{once:true})}else{boot()}
setInterval(function(){loadAlerts().catch(e=>console.error('[GOAML] refresh alerts failed',e))},15000);
})(); 
</script>
</body>
</html>