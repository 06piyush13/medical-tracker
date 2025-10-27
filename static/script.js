/* -------------- script.js --------------
   Purpose:
   - Keep the original front-end logic (chips, predictions, map, quick-symptoms).
   - When the user runs a prediction, store the history locally (localStorage) AND POST the history entry to /api/history (backend).
   - On load, fetch /api/history from backend and render those entries (merge/show).
   - Be resilient to a variety of backend response shapes and date field names.
-----------------------------------------*/

// ---------- Helpers ----------
function escapeHtml(s){ return String(s || '').replace(/[&<>"']/g, function(m){ return ({ "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;" })[m]; }); }
function toLowerTrim(s){ return String(s||'').toLowerCase().trim(); }
function normalizeSymptoms(text){
  return String(text||'').toLowerCase()
    .split(/[,;\/\\|\n]+|\s+and\s+/)
    .map(function(s){ return s.trim().replace(/[^a-z0-9 ]/g,''); })
    .filter(Boolean);
}
function haversineKm(lat1, lon1, lat2, lon2){
  var R=6371; function toRad(d){ return d*Math.PI/180; }
  var dLat = toRad(lat2 - lat1); var dLon = toRad(lon2 - lon1);
  var a = Math.sin(dLat/2)*Math.sin(dLat/2) + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)*Math.sin(dLon/2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// ---------- Expanded disease DB (same as original) ----------
var CONDITIONS_DB = [
  { id:"common_cold", name:"Common Cold", description:"A mild viral infection of the nose and throat.", causes:"Many types of viruses (rhinoviruses most common).", symptoms:["sneezing","sore throat","runny nose","congestion","cough","mild fever"], meds:["Rest","Paracetamol/Ibuprofen","Decongestants (short-term)"] },
  { id:"influenza", name:"Influenza (Flu)", description:"A contagious respiratory illness caused by influenza viruses.", causes:"Influenza A and B viruses (seasonal).", symptoms:["fever","body ache","chills","headache","cough","fatigue"], meds:["Antivirals (early, consult doctor)","Paracetamol/Ibuprofen","Rest & fluids"] },
  { id:"covid19", name:"COVID-19", description:"Respiratory infection by SARS-CoV-2 with variable severity.", causes:"SARS-CoV-2 virus transmitted via respiratory droplets/aerosols.", symptoms:["fever","dry cough","loss of taste","loss of smell","fatigue","sore throat","shortness of breath"], meds:["Follow local testing guidance","Symptomatic care","Seek medical care if breathing difficulty"] },
  { id:"migraine", name:"Migraine", description:"A neurological condition causing severe, recurring headaches.", causes:"Often genetic and environmental triggers (food, stress, sleep).", symptoms:["headache","nausea","light sensitivity","sound sensitivity","visual aura"], meds:["Triptans (prescription)","NSAIDs/Paracetamol","Dark quiet room"] },
  { id:"gastroenteritis", name:"Gastroenteritis (Stomach infection)", description:"Inflammation of stomach and intestines causing diarrhea and vomiting.", causes:"Viral (norovirus), bacterial, or parasitic infections; foodborne toxins.", symptoms:["diarrhea","vomiting","stomach pain","fever","nausea"], meds:["Oral rehydration","Antiemetic (doctor advice)","Rest"] },
  { id:"pneumonia", name:"Pneumonia", description:"Infection of the lungs causing inflammation and possible difficulty breathing.", causes:"Bacterial (e.g. Streptococcus), viral, or fungal organisms.", symptoms:["fever","productive cough","shortness of breath","chest pain","fatigue"], meds:["Antibiotics (if bacterial)","Supportive oxygen/fluids","Seek medical care"] },
  { id:"dengue", name:"Dengue", description:"Mosquito-borne viral infection that can cause high fever and bleeding.", causes:"Dengue virus transmitted by Aedes mosquitoes.", symptoms:["high fever","severe headache","joint pain","rash","bleeding tendencies"], meds:["Hydration","Paracetamol (avoid NSAIDs if bleeding risk)","Seek medical care"] },
  { id:"malaria", name:"Malaria", description:"Parasitic infection transmitted by mosquitoes causing cyclical fevers.", causes:"Plasmodium species carried by Anopheles mosquitoes.", symptoms:["fever","chills","sweats","headache","muscle pain"], meds:["Antimalarial drugs (prescription)","Prompt medical treatment"] },
  { id:"typhoid", name:"Typhoid Fever", description:"Systemic bacterial infection from Salmonella typhi.", causes:"Contaminated food/water with Salmonella typhi.", symptoms:["sustained fever","abdominal pain","constipation/diarrhea","headache"], meds:["Antibiotics (prescription)","Hydration and supportive care"] },
  { id:"asthma", name:"Asthma (Exacerbation)", description:"Chronic lung condition with reversible airway narrowing.", causes:"Allergic triggers, infections, exercise, irritants.", symptoms:["wheezing","shortness of breath","chest tightness","cough"], meds:["Inhaled bronchodilators (salbutamol)","Inhaled steroids (maintenance)","Seek emergency care if severe"] },
  { id:"hypertension", name:"Hypertension (High blood pressure)", description:"Chronic elevation of blood pressure, often without symptoms.", causes:"Genetics, diet, obesity, sedentary lifestyle, other conditions.", symptoms:["often asymptomatic","headache (occasionally)"], meds:["Lifestyle changes","Antihypertensive medications (prescription)"] },
  { id:"diabetes", name:"Diabetes Mellitus", description:"Disorder of blood glucose regulation; type 1 and type 2 exist.", causes:"Autoimmune (type 1) or insulin resistance/defects (type 2).", symptoms:["increased thirst","frequent urination","weight loss","fatigue","blurred vision"], meds:["Insulin (type 1)","Oral hypoglycemics (type 2)","Diet & exercise"] },
  { id:"anemia", name:"Anemia", description:"Low hemoglobin reducing oxygen-carrying capacity of blood.", causes:"Iron deficiency, chronic disease, B12/folate deficiency, blood loss.", symptoms:["fatigue","pallor","shortness of breath","palpitations"], meds:["Iron supplementation (if iron deficiency)","Treat underlying cause"] },
  { id:"arthritis", name:"Arthritis (Osteoarthritis/Rheumatoid)", description:"Joint inflammation causing pain and stiffness.", causes:"Wear-and-tear (osteoarthritis) or autoimmune (rheumatoid).", symptoms:["joint pain","stiffness","reduced range of motion","swelling"], meds:["Analgesics/NSAIDs","Physiotherapy","Disease-modifying drugs (rheumatoid)"] },
  { id:"food_poisoning", name:"Food Poisoning", description:"Illness from ingesting contaminated food or drinks.", causes:"Bacteria, viruses, parasites, toxins in food.", symptoms:["nausea","vomiting","diarrhea","stomach cramps","fever"], meds:["Hydration","Rest","Seek care if severe or prolonged"] },
  { id:"urinary_tract_infection", name:"Urinary Tract Infection (UTI)", description:"Infection of urinary tract, often causing painful urination.", causes:"Bacterial infection (commonly E. coli).", symptoms:["dysuria","frequency","urgency","lower abdominal pain","fever"], meds:["Antibiotics (prescription)","Hydration","Urine culture as advised"] }
];

// ---------- Symptom chips (persisted) ----------
var DEFAULT_QUICK = ["fever","cough","sore throat","runny nose","headache","fatigue","nausea","diarrhea","loss of taste","loss of smell","shortness of breath","sneezing"];
var QUICK_KEY = 'med_quick_symptoms_v1';
function loadQuickSymptoms(){
  try{ var raw = localStorage.getItem(QUICK_KEY); if(!raw){ return DEFAULT_QUICK.slice(0); } var arr = JSON.parse(raw); if(!Array.isArray(arr) || arr.length===0) return DEFAULT_QUICK.slice(0); return arr; }catch(e){ return DEFAULT_QUICK.slice(0); }
}
function saveQuickSymptoms(arr){ try{ localStorage.setItem(QUICK_KEY, JSON.stringify(arr.slice(0,120))); }catch(e){} }

var quickSymptoms = loadQuickSymptoms();

// ---------- UI refs ----------
var quickWrap = document.getElementById('quickSymptoms');
var chipFilter = document.getElementById('chipFilter');
var clearFilter = document.getElementById('clearFilter');
var addSymBtn = document.getElementById('addSymBtn');
var symptomText = document.getElementById('symptomText');
var predictBtn = document.getElementById('predictBtn');
var resetBtn = document.getElementById('resetBtn');
var findDoctorsBtn = document.getElementById('findDoctorsBtn');
var predList = document.getElementById('predList');
var medsDiv = document.getElementById('medications');
var historyList = document.getElementById('historyList');
var errorDiv = document.getElementById('error');
var placesList = document.getElementById('placesList');

var selectedQuick = {}; // set-like object
var userLat = null, userLon = null;

// ---------- Render chips ----------
function renderChips(filter){
  quickWrap.innerHTML = '';
  var filterLc = toLowerTrim(filter || '');
  for(var i=0;i<quickSymptoms.length;i++){
    (function(s){
      var lc = toLowerTrim(s);
      if(filterLc && lc.indexOf(filterLc) === -1) return;
      var b = document.createElement('button');
      b.className = 'chip';
      b.textContent = s;
      b.addEventListener('click', function(){
        if(selectedQuick[lc]){ delete selectedQuick[lc]; b.classList.remove('selected'); }
        else{ selectedQuick[lc] = true; b.classList.add('selected'); }
      });
      quickWrap.appendChild(b);
    })(quickSymptoms[i]);
  }
}
renderChips('');

chipFilter.addEventListener('input', function(){ renderChips(chipFilter.value); });
clearFilter.addEventListener('click', function(){ chipFilter.value=''; renderChips(''); });

addSymBtn.addEventListener('click', function(){
  var typed = toLowerTrim(symptomText.value).split(/[,;\/\\|\n]+/)[0] || '';
  typed = typed.replace(/[^a-z0-9 ]/g,'').trim();
  if(!typed){ errorDiv.style.display='block'; errorDiv.textContent='Type a symptom to add.'; setTimeout(function(){ errorDiv.style.display='none'; },2500); return; }
  addQuickSymptom(typed);
  symptomText.value = '';
  renderChips('');
});
function addQuickSymptom(sym){
  var lc = toLowerTrim(sym);
  for(var i=0;i<quickSymptoms.length;i++){ if(toLowerTrim(quickSymptoms[i]) === lc) return; }
  quickSymptoms.unshift(sym);
  saveQuickSymptoms(quickSymptoms);
  renderChips(chipFilter.value);
}

// ---------- Score & predictions (client-side unchanged) ----------
function scoreConditions(inputSymptoms){
  var results = [];
  for(var i=0;i<CONDITIONS_DB.length;i++){
    var cond = CONDITIONS_DB[i];
    var matchCount = 0;
    for(var j=0;j<cond.symptoms.length;j++){
      var s = toLowerTrim(cond.symptoms[j]);
      if(inputSymptoms.indexOf(s) !== -1) matchCount++;
    }
    var score = matchCount / Math.max(cond.symptoms.length, 1);
    results.push({ id: cond.id, name: cond.name, description: cond.description, causes: cond.causes || cond.causes, symptoms: cond.symptoms.slice(), meds: cond.meds.slice(), score: score, matchCount: matchCount });
  }
  results.sort(function(a,b){ return (b.score - a.score) || (b.matchCount - a.matchCount); });
  return results;
}

function renderPredictions(allSymptoms){
  predList.innerHTML = '';
  medsDiv.textContent = 'Run a prediction to see suggested supportive medications.';
  var scored = scoreConditions(allSymptoms);
  var positive = [];
  for(var i=0;i<scored.length;i++){ if(scored[i].score > 0) positive.push(scored[i]); }
  if(positive.length === 0){ predList.innerHTML = '<div class="small">No conditions matched your symptoms.</div>'; return scored; }

  var medsSet = {};
  for(var pI=0;pI<Math.min(10, positive.length); pI++){
    (function(p){
      var card = document.createElement('div'); card.className = 'pred-card';
      var head = document.createElement('div'); head.className = 'pred-head';
      head.innerHTML = '<div class="pred-name">' + escapeHtml(p.name) + '</div><div class="pred-meta">' + Math.round(p.score*100) + '%</div>';

      var progress = document.createElement('div'); progress.className = 'pred-progress';
      var inner = document.createElement('span'); inner.style.width = '0%';
      progress.appendChild(inner);

      var meta = document.createElement('div'); meta.className='small'; meta.style.marginTop='8px';
      meta.textContent = 'Matches ' + p.matchCount + ' symptom(s)';

      var details = document.createElement('div'); details.className = 'pred-details';
      var orig = null;
      for(var ii=0; ii<CONDITIONS_DB.length; ii++){ if(CONDITIONS_DB[ii].id === p.id){ orig = CONDITIONS_DB[ii]; break; } }
      var causesHtml = orig && orig.causes ? ('<div class="small"><strong>Causes:</strong> ' + escapeHtml(orig.causes) + '</div>') : '';
      details.innerHTML = '<div style="font-weight:600;margin-bottom:6px">Description</div>'
                        + '<div style="margin-bottom:8px">' + escapeHtml(p.description) + '</div>'
                        + causesHtml
                        + '<div class="small" style="margin-top:8px"><strong>Symptoms:</strong> ' + escapeHtml(p.symptoms.join(', ')) + '</div>'
                        + '<div class="small" style="margin-top:8px"><strong>Suggested supportive treatments:</strong> ' + escapeHtml(p.meds.join(', ')) + '</div>';

      head.addEventListener('click', function(){
        if(details.style.display === 'block'){ details.style.display = 'none'; }
        else { details.style.display = 'block'; card.scrollIntoView({behavior: 'smooth', block: 'center'}); }
      });

      card.appendChild(head);
      card.appendChild(progress);
      card.appendChild(meta);
      card.appendChild(details);
      predList.appendChild(card);

      // animate progress after insertion
      setTimeout(function(){ inner.style.width = Math.round(p.score*100) + '%'; },50);

      // collect meds
      if(p.meds && p.meds.length){ for(var mi=0; mi<p.meds.length; mi++){ medsSet[p.meds[mi]] = true; } }
    })(positive[pI]);
  }

  // show combined meds
  var medsArr = Object.keys(medsSet);
  if(medsArr.length){ medsDiv.innerHTML = '<div style="font-weight:600">Suggested supportive medications / steps</div><div class="small" style="margin-top:6px">' + escapeHtml(medsArr.join(', ')) + '</div>'; }

  return scored;
}

// ---------- History (localStorage + server sync) ----------
var HISTORY_KEY = 'med_tracker_history_v1';
function loadHistoryLocal(){ try{ var raw = localStorage.getItem(HISTORY_KEY); if(!raw) return []; return JSON.parse(raw)||[]; }catch(e){ return []; } }
function saveHistoryLocal(arr){ try{ localStorage.setItem(HISTORY_KEY, JSON.stringify(arr.slice(0,50))); }catch(e){} }

function addHistory(entry){
  // entry = { query, when, top }
  var h = loadHistoryLocal();
  h.unshift(entry);
  saveHistoryLocal(h);
  renderHistory();  // render from localStorage to ensure immediate UI feedback

  // Also POST to server to store in DB (non-blocking)
  try{
    fetch('/api/history', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({
        query: entry.query,
        when: entry.when,   // ISO string or locale string; backend should handle/convert
        top: entry.top
      })
    }).then(function(res){
      // optional: if backend returns updated list, we might refresh; keep simple
      // If you prefer fetch result used to refresh UI, uncomment below:
      // if(res.ok) fetchAndRenderServerHistory();
    }).catch(function(err){
      console.warn('Failed to POST history to server:', err);
    });
  }catch(e){
    console.warn('Failed to POST history to server (exception):', e);
  }
}

function renderHistory(){
  var h = loadHistoryLocal();
  historyList.innerHTML = '';
  if(!h || h.length===0){
    historyList.innerHTML = '<div class="small muted">No saved history.</div>';
    return;
  }
  for(var i=0;i<h.length;i++){
    (function(item){
      var div = document.createElement('div'); div.className='history-item';
      div.innerHTML = '<div style="font-weight:600">' + escapeHtml(item.query) + '</div><div class="small muted">' + escapeHtml(item.when) + ' — Top: ' + escapeHtml(item.top || '—') + '</div>';
      historyList.appendChild(div);
    })(h[i]);
  }
}
renderHistory();

// ---------- Fetch and render history from server and merge with local ----------
function normalizeServerEntry(e){
  // Accept lots of field name variants and produce {query, when, top}
  if(!e) return null;
  var q = e.query || e.symptoms || e.history || e.symptom || e.symptom_text || null;
  var top = e.top || e.top_disease || e.topDisease || e.result || null;
  var when = e.when || e.when_ts || e.checked_at || e.created_at || e.timestamp || null;
  // If 'when' is in SQL datetime format without timezone, keep as-is — rendering will try to parse
  return { query: q, when: when || (new Date()).toLocaleString(), top: top };
}

function fetchAndRenderServerHistory(){
  return fetch('/api/history').then(function(resp){
    if(!resp.ok) return Promise.reject('history fetch failed');
    return resp.json();
  }).then(function(json){
    // backend may return { history: [...] } or [...] directly
    var arr = [];
    if(Array.isArray(json)) arr = json;
    else if(Array.isArray(json.history)) arr = json.history;
    else if(json && json.rows && Array.isArray(json.rows)) arr = json.rows; // some backends
    else arr = [];

    // Normalize and merge: server entries first (newest), then local entries that are not duplicates
    var normalized = arr.map(normalizeServerEntry).filter(Boolean);

    // Get local entries
    var local = loadHistoryLocal();

    // Simple duplicate avoidance based on query + when
    var keys = {};
    var merged = [];

    normalized.forEach(function(item){
      var k = (item.query || '') + '||' + (item.when || '');
      if(!keys[k]){ keys[k]=true; merged.push(item); }
    });

    local.forEach(function(item){
      var k = (item.query || '') + '||' + (item.when || '');
      if(!keys[k]){ keys[k]=true; merged.push(item); }
    });

    // Save merged to local so UI uses it and persists
    saveHistoryLocal(merged);
    renderHistory();
    return merged;
  }).catch(function(err){
    // network or server error: fallback to local only
    console.warn('Could not fetch server history:', err);
    renderHistory();
    return loadHistoryLocal();
  });
}

// On page load try to get server history and merge
fetchAndRenderServerHistory();

// ---------- Predict / Reset handlers ----------
predictBtn.addEventListener('click', function(){
  var typed = normalizeSymptoms(symptomText.value);
  for(var k in selectedQuick){ if(selectedQuick.hasOwnProperty(k)) typed.push(k); }
  var unique = Array.from(new Set(typed));
  if(unique.length===0){ errorDiv.style.display='block'; errorDiv.textContent='Please enter or select at least one symptom.'; setTimeout(function(){ errorDiv.style.display='none'; },2500); return; }
  var scored = renderPredictions(unique);
  var top = (scored && scored.length>0 && scored[0].score>0) ? scored[0].name : null;
  var whenStr = (new Date()).toLocaleString();
  addHistory({ query: unique.join(', '), when: whenStr, top: top });
});

resetBtn.addEventListener('click', function(){ symptomText.value=''; selectedQuick = {}; renderChips(''); predList.innerHTML='No predictions yet.'; medsDiv.textContent = 'Run a prediction to see suggested supportive medications.'; });

// ---------- Map & Nearby places (Overpass) ----------
var map = L.map('map', { zoomControl:true }).setView([20.5937,78.9629], 5); // India default
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{ maxZoom:19, attribution:'© OpenStreetMap contributors' }).addTo(map);
var markersLayer = L.layerGroup().addTo(map);

function setUserLocation(lat, lon, zoom){ userLat = lat; userLon = lon; map.setView([lat, lon], zoom||13); markersLayer.clearLayers(); L.circle([lat,lon],{radius:60,color:varOr('--accent','#2563eb'),fill:false}).addTo(markersLayer); }

function varOr(name, fallback){ try{ return getComputedStyle(document.documentElement).getPropertyValue(name) || fallback; }catch(e){ return fallback; } }

function findNearbyMedical(lat, lon, radiusMeters){
  // Keep client-side Overpass call (same as original). If you prefer proxying through /api/nearby,
  // you can swap this to POST /api/nearby with JSON {lat, lon, radiusMeters} which your backend proxies.
  radiusMeters = radiusMeters || 5000;
  var query = '[out:json][timeout:25];(node["amenity"~"clinic|doctors|hospital|pharmacy"](around:' + radiusMeters + ',' + lat + ',' + lon + ');way["amenity"~"clinic|doctors|hospital|pharmacy"](around:' + radiusMeters + ',' + lat + ',' + lon + ');relation["amenity"~"clinic|doctors|hospital|pharmacy"](around:' + radiusMeters + ',' + lat + ',' + lon + '););out center;';
  return fetch('https://overpass-api.de/api/interpreter', { method:'POST', body:query, headers:{'Content-Type':'text/plain'} }).then(function(r){ return r.json(); });
}

function renderPlacesFromOverpass(osmJson){
  markersLayer.clearLayers(); placesList.innerHTML = '';
  if(!osmJson || !osmJson.elements || osmJson.elements.length===0){ placesList.innerHTML = '<div class="small muted">No nearby clinics found.</div>'; return; }
  var places = [];
  for(var i=0;i<osmJson.elements.length;i++){
    var e = osmJson.elements[i];
    var lat = e.lat || (e.center && e.center.lat);
    var lon = e.lon || (e.center && e.center.lon);
    if(!lat || !lon) continue;
    var name = (e.tags && (e.tags.name || e.tags['healthcare'] || e.tags['operator'])) || 'Clinic / Medical';
    var type = (e.tags && (e.tags.amenity || 'medical'));
    var distance = haversineKm(userLat, userLon, lat, lon);
    places.push({name:name, type:type, lat:lat, lon:lon, distance:distance, tags:e.tags||{}});
  }
  places.sort(function(a,b){ return a.distance - b.distance; });

  for(var j=0;j<places.length;j++){
    (function(p){
      var m = L.marker([p.lat,p.lon]).addTo(markersLayer).bindPopup('<strong>'+escapeHtml(p.name)+'</strong><div class="small muted">'+escapeHtml(p.type)+' — '+(Math.round(p.distance*1000))+' m</div>');
      var el = document.createElement('div'); el.className='place';
      el.innerHTML = '<h4>' + escapeHtml(p.name) + '</h4><div class="meta">' + escapeHtml(p.type) + ' — ' + (Math.round(p.distance*1000)) + ' m</div>';
      var actions = document.createElement('div'); actions.className='actions';
      var btn1 = document.createElement('a'); btn1.className='link-btn'; btn1.href = 'https://www.openstreetmap.org/?mlat='+p.lat+'&mlon='+p.lon+'#map=18/'+p.lat+'/'+p.lon; btn1.target='_blank'; btn1.textContent='Open OSM';
      var btn2 = document.createElement('button'); btn2.className='link-btn'; btn2.textContent='Go to map'; btn2.addEventListener('click', function(){ map.setView([p.lat,p.lon],17); m.openPopup(); });
      actions.appendChild(btn1); actions.appendChild(btn2); el.appendChild(actions);
      placesList.appendChild(el);
    })(places[j]);
  }
}

// ---------- Find doctors button ----------
findDoctorsBtn.addEventListener('click', function(){
  if(!navigator.geolocation){ errorDiv.style.display='block'; errorDiv.textContent='Geolocation not supported.'; setTimeout(function(){ errorDiv.style.display='none'; },2500); return; }
  findDoctorsBtn.disabled = true; findDoctorsBtn.textContent='Searching...';
  navigator.geolocation.getCurrentPosition(function(pos){
    var lat = pos.coords.latitude; var lon = pos.coords.longitude; setUserLocation(lat, lon, 13);
    findNearbyMedical(lat, lon, 5000).then(function(json){ renderPlacesFromOverpass(json); findDoctorsBtn.disabled=false; findDoctorsBtn.textContent='📍 Find Doctors'; }).catch(function(e){ console.error(e); errorDiv.style.display='block'; errorDiv.textContent='Nearby search failed.'; setTimeout(function(){ errorDiv.style.display='none'; },2500); findDoctorsBtn.disabled=false; findDoctorsBtn.textContent='📍 Find Doctors'; });
  }, function(err){ errorDiv.style.display='block'; errorDiv.textContent='Permission denied or location unavailable.'; setTimeout(function(){ errorDiv.style.display='none'; },2500); findDoctorsBtn.disabled=false; findDoctorsBtn.textContent='📍 Find Doctors'; });
});

// ---------- Theme toggle & clock ----------
var THEME_KEY = 'med_tracker_theme_v1';
function setTheme(dark){ if(dark){ document.body.classList.add('dark'); localStorage.setItem(THEME_KEY,'dark'); } else { document.body.classList.remove('dark'); localStorage.removeItem(THEME_KEY); } }
var themeToggle = document.getElementById('themeToggle'); themeToggle.addEventListener('click', function(){ setTheme(!document.body.classList.contains('dark')); });
(function(){ if(localStorage.getItem(THEME_KEY)==='dark') setTheme(true); else setTheme(false); })();

function updateClock(){ var d=new Date(); var s=d.toLocaleTimeString(); document.getElementById('clock').textContent=s; }
updateClock(); setInterval(updateClock,1000);

// ---------- Initial optional geolocation attempt (silent) ----------
if(navigator.geolocation){ navigator.geolocation.getCurrentPosition(function(p){ userLat=p.coords.latitude; userLon=p.coords.longitude; map.setView([userLat,userLon],12); }, function(){}, {timeout:3000}); }

// ---------- Accessibility: keyboard support for chips ----------
quickWrap.addEventListener('keydown', function(e){ if(e.key==='Enter' && document.activeElement && document.activeElement.classList.contains('chip')){ document.activeElement.click(); } });

// ---------- Minor polish: prevent accidental form submit on Enter inside textarea when ctrl not pressed ----------
symptomText.addEventListener('keydown', function(e){ if(e.key==='Enter' && !e.ctrlKey && !e.shiftKey){ e.preventDefault(); predictBtn.click(); } });
