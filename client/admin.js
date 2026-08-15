const keyInput=document.querySelector('#key');
const reloadBtn=document.querySelector('#reload');
const flushBtn=document.querySelector('#flush');
const statusEl=document.querySelector('#status');
const metrics=document.querySelector('#metrics');
const packagesEl=document.querySelector('#packages');
const paymentsEl=document.querySelector('#payments');
const eventsEl=document.querySelector('#events');
keyInput.value=sessionStorage.getItem('ludo.adminKey')||'';
const labels={STORE_VIEW:'Store Views',PACKAGE_CLICK:'Package Clicks',PAYMENT_METHOD_SELECTED:'Payment Selected',PURCHASE_INTENT:'Purchase Intents',PURCHASE_CANCELLED:'Cancelled'};
const packageLabels={starter:'Starter',popular:'Popular',pro:'Pro',king:'King'};
const paymentLabels={vodafone_cash:'Vodafone Cash',instapay:'InstaPay'};
function bars(data,labelsMap){const max=Math.max(1,...Object.values(data));return Object.entries(data).map(([k,v])=>`<div class="bar-row"><span>${labelsMap[k]||k}</span><div class="track"><i style="width:${(v/max)*100}%"></i></div><b>${v}</b></div>`).join('')}
async function load(){const key=keyInput.value.trim();sessionStorage.setItem('ludo.adminKey',key);statusEl.textContent='جاري التحميل…';try{const r=await fetch(`/api/analytics/summary${key?`?key=${encodeURIComponent(key)}`:''}`);const d=await r.json();if(!r.ok)throw new Error(d.error||r.status);metrics.innerHTML=[['Unique Visitors',d.uniqueVisitors],['Store Views',d.totals.STORE_VIEW],['Purchase Intents',d.totals.PURCHASE_INTENT],['Intent Conversion',`${d.purchaseIntentConversion}%`]].map(([a,b])=>`<div class="card metric"><small>${a}</small><strong>${b}</strong></div>`).join('');packagesEl.innerHTML=bars(d.packages,packageLabels);paymentsEl.innerHTML=bars(d.payments,paymentLabels);eventsEl.innerHTML=(d.lastEvents||[]).map(e=>`<tr><td>${labels[e.event]||e.event}</td><td>${e.packageId||'—'}</td><td>${paymentLabels[e.paymentMethod]||e.paymentMethod||'—'}</td><td>${new Date(e.at).toLocaleString('ar-EG')}</td></tr>`).join('')||'<tr><td colspan="4">مفيش أحداث لسه.</td></tr>';statusEl.textContent=`Persistence: ${d.persistence} • Updated: ${d.updatedAt||'—'} • Last GitHub save: ${d.lastFlushAt||'—'}${d.persistenceError?` • ERROR: ${d.persistenceError}`:''}`}catch(e){statusEl.textContent=`تعذر التحميل: ${e.message}`}}
flushBtn?.addEventListener('click',async()=>{const key=keyInput.value.trim();flushBtn.disabled=true;statusEl.textContent='جاري الحفظ على GitHub…';try{const r=await fetch(`/api/analytics/flush${key?`?key=${encodeURIComponent(key)}`:''}`,{method:'POST'});const d=await r.json();if(!r.ok)throw new Error(d.message||d.error||r.status);statusEl.textContent=`GitHub save: ${d.flushed?'تم الحفظ ✅':'مفيش تغييرات جديدة'} • ${d.lastFlushAt||'—'}`;}catch(e){statusEl.textContent=`فشل الحفظ على GitHub: ${e.message}`;}finally{flushBtn.disabled=false;}});reloadBtn.addEventListener('click',load);load();
