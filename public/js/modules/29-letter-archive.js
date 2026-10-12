(function(){
'use strict';
const API='/api/letter-numbers';
const token=()=>document.querySelector('meta[name="csrf-token"]')?.content||'';
async function api(url,opt={}){opt.credentials='same-origin';opt.headers=Object.assign({'Accept':'application/json','Content-Type':'application/json','X-CSRF-TOKEN':token(),'X-Requested-With':'XMLHttpRequest'},opt.headers||{});const r=await fetch(url,opt),d=await r.json().catch(()=>({}));if(!r.ok)throw Error(d.message||('HTTP '+r.status));return d}
function esc(v){return String(v??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}
async function render(view){
 if(!view)return;
 const oldBox=view.querySelector('#letter-archive-panel');
 if(oldBox)oldBox.remove();

 const box=document.createElement('div');
 box.id='letter-archive-panel';
 box.className='panel';
 box.style.marginTop='18px';
 box.innerHTML=`
 <div class="panel-header" style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;">
   <div>
     <h3 style="margin:0"><i class="fa-solid fa-folder-open"></i> Riwayat Nomor Surat</h3>
     <small>Daftar nomor yang sudah dibuat. Satu nomor dapat memiliki lebih dari satu dokumen.</small>
   </div>
   <button type="button" class="btn btn-outline btn-sm" id="lnArchiveToggle"><i class="fa-solid fa-minus"></i> Minimize</button>
 </div>
 <div id="lnArchiveBody" style="padding:12px">
   <div id="lnArchiveFilters" style="display:grid;grid-template-columns:minmax(220px,2fr) minmax(150px,1fr) minmax(150px,1fr) minmax(140px,1fr) minmax(140px,1fr) auto;gap:8px;align-items:end;margin-bottom:12px">
     <label style="margin:0">Cari
       <input id="lnArchiveSearch" class="form-control" type="search" placeholder="Nomor, perihal, jenis...">
     </label>
     <label style="margin:0">Jenis Surat
       <select id="lnArchiveType" class="form-control"><option value="">Semua Jenis</option></select>
     </label>
     <label style="margin:0">Status
       <select id="lnArchiveStatus" class="form-control"><option value="">Semua Status</option></select>
     </label>
     <label style="margin:0">Dari
       <input id="lnArchiveFrom" class="form-control" type="date">
     </label>
     <label style="margin:0">Sampai
       <input id="lnArchiveTo" class="form-control" type="date">
     </label>
     <button type="button" class="btn btn-outline" id="lnArchiveReset"><i class="fa-solid fa-rotate-left"></i> Reset</button>
   </div>
   <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:8px;flex-wrap:wrap">
     <small id="lnArchiveCount" class="text-muted">Memuat...</small>
     <button type="button" class="btn btn-primary btn-sm" id="lnArchiveRefresh"><i class="fa-solid fa-rotate"></i> Refresh</button>
   </div>
   <div id="letterRows" style="overflow:auto"></div>
 </div>`;
 view.appendChild(box);

 const body=box.querySelector('#lnArchiveBody');
 const toggle=box.querySelector('#lnArchiveToggle');
 toggle.onclick=function(){
   const hidden=body.style.display==='none';
   body.style.display=hidden?'block':'none';
   toggle.innerHTML=hidden
     ? '<i class="fa-solid fa-minus"></i> Minimize'
     : '<i class="fa-solid fa-plus"></i> Tampilkan';
 };

 let rows=[];
 async function loadRows(){
   const r=await api(API+'/records');
   rows=Array.isArray(r.data)?r.data:[];
   buildFilterOptions();
   applyFilters();
 }
 function buildFilterOptions(){
   const typeSel=box.querySelector('#lnArchiveType');
   const statusSel=box.querySelector('#lnArchiveStatus');
   const oldType=typeSel.value,oldStatus=statusSel.value;
   const types=[...new Set(rows.map(x=>String(x.letter_type||'').trim()).filter(Boolean))].sort();
   const statuses=[...new Set(rows.map(x=>String(x.status||'').trim()).filter(Boolean))].sort();
   typeSel.innerHTML='<option value="">Semua Jenis</option>'+types.map(x=>'<option value="'+esc(x)+'">'+esc(x)+'</option>').join('');
   statusSel.innerHTML='<option value="">Semua Status</option>'+statuses.map(x=>'<option value="'+esc(x)+'">'+esc(x)+'</option>').join('');
   if(types.includes(oldType))typeSel.value=oldType;
   if(statuses.includes(oldStatus))statusSel.value=oldStatus;
 }
 function matches(x){
   const q=String(box.querySelector('#lnArchiveSearch').value||'').trim().toLowerCase();
   const type=box.querySelector('#lnArchiveType').value;
   const status=box.querySelector('#lnArchiveStatus').value;
   const from=box.querySelector('#lnArchiveFrom').value;
   const to=box.querySelector('#lnArchiveTo').value;
   if(type&&String(x.letter_type||'')!==type)return false;
   if(status&&String(x.status||'')!==status)return false;
   if(from&&String(x.letter_date||'')<from)return false;
   if(to&&String(x.letter_date||'')>to)return false;
   if(!q)return true;
   return [x.letter_number,x.letter_type,x.letter_date,x.subject,x.status,x.company_code]
     .map(v=>String(v??'').toLowerCase()).join(' ').includes(q);
 }
 function renderRows(){
   const filtered=rows.filter(matches);
   const count=box.querySelector('#lnArchiveCount');
   if(count)count.textContent='Menampilkan '+filtered.length+' dari '+rows.length+' nomor surat';
   const target=box.querySelector('#letterRows');
   if(!filtered.length){
     target.innerHTML='<div class="text-muted" style="padding:24px;text-align:center">Tidak ada nomor surat yang sesuai dengan pencarian/filter.</div>';
     return;
   }
   target.innerHTML='<table class="table"><thead><tr><th>No</th><th>Nomor</th><th>Jenis</th><th>Tanggal</th><th>Perihal</th><th>Status</th><th>File / Dokumen</th><th>Aksi</th></tr></thead><tbody>'+
     filtered.map((x,i)=>{
       const docs=Array.isArray(x.documents)?x.documents:[];
       const fileNames=docs.length
         ? '<div style="max-width:330px">'+docs.map(d=>{
             const id=encodeURIComponent(d.id);
             const name=esc(d.file_name||'File');
             return '<div style="display:flex;align-items:center;gap:5px;margin:3px 0;flex-wrap:wrap"><span style="min-width:0;max-width:150px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="'+name+'"><i class="fa-solid fa-paperclip"></i> '+name+'</span><a class="btn btn-sm btn-outline" target="_blank" rel="noopener" href="'+API+'/documents/'+id+'/preview"><i class="fa-solid fa-eye"></i> Preview</a><a class="btn btn-sm btn-outline" href="'+API+'/documents/'+id+'/download"><i class="fa-solid fa-download"></i> Download</a></div>';
           }).join('')+'</div>'
         : '<span class="text-muted">0 file</span>';
       return '<tr><td>'+(i+1)+'</td><td><b>'+esc(x.letter_number)+'</b></td><td>'+esc(x.letter_type)+'</td><td>'+esc(x.letter_date)+'</td><td>'+esc(x.subject||'-')+'</td><td>'+esc(x.status)+'</td><td>'+docs.length+' file'+(docs.length?'<div style="margin-top:4px">'+fileNames+'</div>':'')+'</td><td style="white-space:nowrap"><button type="button" class="btn btn-sm btn-outline" data-letter-upload="'+x.id+'"><i class="fa-solid fa-paperclip"></i> Upload File</button></td></tr>';
     }).join('')+'</tbody></table>';
   target.querySelectorAll('[data-letter-upload]').forEach(b=>b.onclick=()=>uploadMultiple(b.dataset.letterUpload,()=>loadRows()));
 }
 function applyFilters(){renderRows();}
 ['input','change'].forEach(ev=>{
   ['#lnArchiveSearch','#lnArchiveType','#lnArchiveStatus','#lnArchiveFrom','#lnArchiveTo'].forEach(sel=>{
     box.querySelector(sel).addEventListener(ev,applyFilters);
   });
 });
 box.querySelector('#lnArchiveReset').onclick=function(){
   box.querySelector('#lnArchiveSearch').value='';
   box.querySelector('#lnArchiveType').value='';
   box.querySelector('#lnArchiveStatus').value='';
   box.querySelector('#lnArchiveFrom').value='';
   box.querySelector('#lnArchiveTo').value='';
   applyFilters();
 };
 box.querySelector('#lnArchiveRefresh').onclick=()=>loadRows().catch(e=>alert(e.message));
 await loadRows();
}
async function uploadMultiple(id,refresh){
 const input=document.createElement('input');
 input.type='file';
 input.multiple=true;
 input.accept='.pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp';
 input.onchange=async()=>{
   const files=Array.from(input.files||[]);
   if(!files.length)return;
   const oversized=files.find(f=>f.size>10*1024*1024);
   if(oversized)return alert('File "'+oversized.name+'" melebihi batas 10 MB.');
   const buttonText='Mengupload '+files.length+' file...';
   let success=0,failed=[];
   for(const file of files){
     try{
       const dataUrl=await new Promise((resolve,reject)=>{
         const reader=new FileReader();
         reader.onload=()=>resolve(reader.result);
         reader.onerror=()=>reject(new Error('Gagal membaca '+file.name));
         reader.readAsDataURL(file);
       });
       await api(API+'/records/'+id+'/documents',{
         method:'POST',
         body:JSON.stringify({data_url:dataUrl,filename:file.name})
       });
       success++;
     }catch(e){
       failed.push(file.name+': '+e.message);
     }
   }
   let msg='Berhasil upload '+success+' file.';
   if(failed.length)msg+='\\nGagal: '+failed.join('\\n');
   alert(msg);
   if(typeof refresh==='function')await refresh();
 };
 input.click();
}
window.AlmaraLetterArchive={render};
document.addEventListener('DOMContentLoaded',()=>{const v=document.getElementById('letter-number-view');if(v)render(v).catch(console.error)});
})();