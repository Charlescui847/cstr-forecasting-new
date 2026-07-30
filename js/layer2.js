// ─────────────── LAYER 2 TRAINING ───────────────
function startLayer2Training(){
  if(l2Running&&!l2Paused)return;
  if(l2Paused){togglePauseL2();return}
  resetLayer2(true);
  l2Running=true;l2Paused=false;
  l2PausedAt=0;l2PausedMs=0;
  document.getElementById('btnL2Start').disabled=true;
  document.getElementById('btnL2Pause').disabled=false;
  document.getElementById('btnL2Reset').disabled=true;
  
  buildStatusGrid('l2StatusGrid',L2_MODELS);
  l2StartTime=performance.now();

  L2_MODELS.forEach(m=>{
    document.getElementById('sc-'+m.id).classList.add('running');
    document.getElementById('st-'+m.id).textContent='▶ Simulating...';document.getElementById('st-'+m.id).className='s-status running';
    runModelL2(m);
  });
  let timerId=setInterval(()=>{if(!l2Running){clearInterval(timerId);return}
    let el=document.getElementById('l2Timer');
    el.textContent='⏱ '+elapsedSeconds(l2StartTime,l2PausedAt,l2PausedMs).toFixed(1)+'s (×'+simSpeed+')';
  },200);
  l2Intervals.push(timerId);
}

function runModelL2(m){
  let tick=0,losses=[],progress=0,lastTickAt=performance.now();
  let id=setInterval(()=>{
    const now=performance.now();
    if(l2Paused){lastTickAt=now;return}
    progress+=((now-lastTickAt)*simSpeed)/(m.realSec*1000);
    lastTickAt=now;
    const nextTick=Math.min(m.totalTicks,Math.floor(progress*m.totalTicks));
    if(nextTick<=tick)return;
    tick=nextTick;
    const pct=Math.min(100,Math.round(progress*100));
    document.getElementById('bar-'+m.id).style.width=pct+'%';
    document.getElementById('ep-'+m.id).textContent='Progress '+pct+'%';
    losses=m.genLoss(tick);
    if(losses.length>0){
      let last=losses[losses.length-1];
      document.getElementById('loss-'+m.id).textContent=last.val.toFixed(4);
    }
    if(tick>=m.totalTicks){
      clearInterval(id);
      document.getElementById('sc-'+m.id).classList.remove('running');document.getElementById('sc-'+m.id).classList.add('done');
      document.getElementById('bar-'+m.id).style.width='100%';
      document.getElementById('ep-'+m.id).textContent='Done';
      document.getElementById('st-'+m.id).textContent='✓ Complete ('+(m.realSec).toFixed(1)+'s real)';
      document.getElementById('st-'+m.id).className='s-status done';
      m._losses=losses;
      checkL2Complete();
    }
  },30);
  l2Intervals.push(id);
  m._interval=id;
}

function checkL2Complete(){
  let allDone=L2_MODELS.every(m=>document.getElementById('sc-'+m.id).classList.contains('done'));
  if(allDone){
    l2Running=false;l2Paused=false;
    document.getElementById('btnL2Start').disabled=false;document.getElementById('btnL2Start').textContent='✓ DEMO COMPLETE';
    document.getElementById('btnL2Pause').disabled=true;
    document.getElementById('btnL2Reset').disabled=false;
    document.getElementById('l2Timer').textContent='✅ Done in '+elapsedSeconds(l2StartTime,l2PausedAt,l2PausedMs).toFixed(1)+'s';
    showToast('Layer 2 simulation complete! Improved models ready for comparison.');
    populateL2Results();
    initL2ResultCharts();
    document.getElementById('layer2results').scrollIntoView({behavior:'smooth'});
  }
}

function togglePauseL2(){
  if(!l2Running)return;
  l2Paused=!l2Paused;
  if(l2Paused)l2PausedAt=performance.now();
  else{l2PausedMs+=performance.now()-l2PausedAt;l2PausedAt=0}
  document.getElementById('btnL2Pause').textContent=l2Paused?'▶ RESUME':'⏸ PAUSE';
}

function resetLayer2(silent){
  l2Running=false;l2Paused=false;
  l2PausedAt=0;l2PausedMs=0;
  l2Intervals.forEach(id=>clearInterval(id));l2Intervals=[];
  document.getElementById('btnL2Start').disabled=false;document.getElementById('btnL2Start').textContent='▶ RUN IMPROVED DEMO';
  document.getElementById('btnL2Pause').disabled=true;document.getElementById('btnL2Pause').textContent='⏸ PAUSE';
  document.getElementById('btnL2Reset').disabled=true;
  document.getElementById('l2Timer').textContent='Ready';
  if(!silent){
    document.getElementById('l2StatusGrid').innerHTML='';
    document.getElementById('tblL2').querySelector('tbody').innerHTML='';
    ['chartL2NRMSE','chartL2Delta','chartL2Radar','chartL2Warnings','chartL2ScatterXGB','chartL2ScatterLSTM','chartL2Attn'].forEach(id=>destroyChart(id));
  }
}

// ─────────────── LAYER 2 RESULTS ───────────────
function populateL2Results(){
  let tbody=document.getElementById('tblL2').querySelector('tbody');
  let rows=[
    {name:'Persistence (reference)',f:{nrmse:0.5673,b30:'—',event:'—',nonEvent:'—',skill:0,recall:'—',missed:'—',sec:'0.0'},cls:'',hl:''},
    {name:'XGBoost Baseline',f:{nrmse:0.1152,b30:0.1684,event:0.1190,nonEvent:0.1081,skill:0.797,recall:0.894,missed:22,sec:'48.2'},cls:'',hl:''},
    {name:'<strong>XGBoost_improved</strong>',f:{nrmse:0.1062,b30:0.1558,event:0.1104,nonEvent:0.0996,skill:0.813,recall:0.919,missed:17,sec:'98.4'},cls:'cell-good',hl:' style="background:rgba(16,185,129,0.05)"'},
    {name:'LSTM Baseline',f:{nrmse:0.1057,b30:0.1583,event:0.1088,nonEvent:0.1016,skill:0.814,recall:0.910,missed:19,sec:'262.0'},cls:'',hl:''},
    {name:'<strong>LSTM_improved (BiLSTM-Attn)</strong>',f:{nrmse:0.0984,b30:0.1487,event:0.1009,nonEvent:0.0942,skill:0.827,recall:0.972,missed:6,sec:'485.3'},cls:'cell-best',hl:' style="background:rgba(6,182,212,0.05)"'},
  ];
  tbody.innerHTML=rows.map(r=>`<tr${r.hl}><td>${r.name}</td><td class="${r.cls}">${r.f.nrmse}</td><td>${r.f.b30}</td><td>${r.f.event}</td><td>${r.f.nonEvent}</td><td>${r.f.skill.toFixed(3)}</td><td>${r.f.recall}</td><td>${r.f.missed}</td><td>${r.f.sec}</td></tr>`).join('');
}

function initL2ResultCharts(){
  createChart('chartL2NRMSE',{
    type:'bar',data:{labels:['XGBoost\nBaseline','XGBoost\nImproved','LSTM\nBaseline','LSTM\nImproved'],
      datasets:[
        {label:'Overall NRMSE',data:[0.1152,0.1062,0.1057,0.0984],backgroundColor:[C.green+'99',C.green,C.cyan+'99',C.cyan],borderRadius:8},
        {label:'Event NRMSE',data:[0.1190,0.1104,0.1088,0.1009],backgroundColor:'rgba(255,255,255,0.03)',borderColor:[C.green+'99',C.green,C.cyan+'99',C.cyan],borderWidth:2,borderRadius:8}]},
    options:{responsive:true,plugins:{legend:{position:'top'}},scales:{y:{title:{display:true,text:'NRMSE'},beginAtZero:true,max:0.14,grid:{color:'rgba(148,163,184,0.06)'}},x:{grid:{display:false}}}}
  });
  createChart('chartL2Delta',{
    type:'bar',data:{labels:['XGBoost → XGBoost_imp','LSTM → LSTM_imp'],
      datasets:[
        {label:'NRMSE Reduction',data:[0.0090,0.0073],backgroundColor:[C.green,C.cyan],borderRadius:8,yAxisID:'y'},
        {label:'Relative Improvement %',data:[7.8,6.9],backgroundColor:[C.green+'99',C.cyan+'99'],borderRadius:8,yAxisID:'y1'}]},
    options:{responsive:true,plugins:{legend:{position:'top'}},scales:{y:{position:'left',title:{display:true,text:'Absolute Reduction'},grid:{color:'rgba(148,163,184,0.06)'}},y1:{position:'right',title:{display:true,text:'Relative (%)'},grid:{display:false},min:0,max:12},x:{grid:{display:false}}}}
  });
  createChart('chartL2Radar',{
    type:'radar',data:{labels:['1 min','5 min','15 min','30 min'],
      datasets:[
        {label:'XGBoost Baseline',data:[0.108,0.112,0.116,0.119],borderColor:C.green+'88',backgroundColor:'rgba(16,185,129,0.08)',borderWidth:1.5},
        {label:'XGBoost_imp',data:[0.100,0.104,0.108,0.111],borderColor:C.green,backgroundColor:'rgba(16,185,129,0.14)',borderWidth:3},
        {label:'LSTM Baseline',data:[0.098,0.102,0.107,0.110],borderColor:C.cyan+'88',backgroundColor:'rgba(6,182,212,0.06)',borderWidth:1.5},
        {label:'LSTM_imp',data:[0.091,0.095,0.100,0.103],borderColor:C.cyan,backgroundColor:'rgba(6,182,212,0.10)',borderWidth:3}]},
    options:{responsive:true,plugins:{legend:{position:'top'}},scales:{r:{min:0.08,max:0.14,grid:{color:'rgba(148,163,184,0.12)'},pointLabels:{color:'#94a3b8'}}}}
  });
  createChart('chartL2Warnings',{
    type:'bar',data:{labels:['XGB Base\n15m','XGB Imp\n15m','LSTM Base\n15m','LSTM Imp\n15m','XGB Imp\n30m','LSTM Imp\n30m'],
      datasets:[
        {label:'High Temp Recall',data:[0.894,0.919,0.910,0.972,0.901,0.960],backgroundColor:[C.green+'99',C.green,C.cyan+'99',C.cyan,C.green+'66',C.cyan+'66'],borderRadius:6},
        {label:'Off-spec B Recall',data:[0.485,0.510,0.497,0.521,0.532,0.548],backgroundColor:['rgba(239,68,68,0.3)','rgba(239,68,68,0.5)','rgba(239,68,68,0.3)','rgba(239,68,68,0.5)','rgba(239,68,68,0.25)','rgba(239,68,68,0.4)'],borderRadius:6}]},
    options:{responsive:true,plugins:{legend:{position:'top'}},scales:{y:{min:0.3,max:1,title:{display:true,text:'Recall'},grid:{color:'rgba(148,163,184,0.06)'}},x:{grid:{display:false}}}}
  });
  let sX=[],sY=[];
  for(let i=0;i<200;i++){let t=0.05+seededUnit(301,i,1)*0.15;sX.push(t);sY.push(t+(seededUnit(301,i,2)-0.5)*0.015)}
  createChart('chartL2ScatterXGB',{
    type:'scatter',data:{datasets:[
      {label:'XGBoost_imp',data:sX.map((x,i)=>({x,y:sY[i]})),backgroundColor:'rgba(16,185,129,0.45)',pointRadius:4},
      {label:'Perfect',data:[{x:0.04,y:0.04},{x:0.22,y:0.22}],borderColor:'rgba(255,255,255,0.25)',borderDash:[5,5],pointRadius:0,showLine:true}]},
    options:{responsive:true,plugins:{legend:{position:'top'}},scales:{x:{title:{display:true,text:'Actual B [mol/L]'},grid:{color:'rgba(148,163,184,0.06)'}},y:{title:{display:true,text:'Predicted B [mol/L]'},grid:{color:'rgba(148,163,184,0.06)'}}}}
  });
  let sX2=[],sY2=[];
  for(let i=0;i<200;i++){let t=0.05+seededUnit(401,i,1)*0.15;sX2.push(t);sY2.push(t+(seededUnit(401,i,2)-0.5)*0.009)}
  createChart('chartL2ScatterLSTM',{
    type:'scatter',data:{datasets:[
      {label:'LSTM_imp',data:sX2.map((x,i)=>({x,y:sY2[i]})),backgroundColor:'rgba(6,182,212,0.45)',pointRadius:4},
      {label:'Perfect',data:[{x:0.04,y:0.04},{x:0.22,y:0.22}],borderColor:'rgba(255,255,255,0.25)',borderDash:[5,5],pointRadius:0,showLine:true}]},
    options:{responsive:true,plugins:{legend:{position:'top'}},scales:{x:{title:{display:true,text:'Actual B [mol/L]'},grid:{color:'rgba(148,163,184,0.06)'}},y:{title:{display:true,text:'Predicted B [mol/L]'},grid:{color:'rgba(148,163,184,0.06)'}}}}
  });
  let attnVals=[0.018,0.020,0.022,0.025,0.028,0.031,0.033,0.035,0.037,0.038,0.040,0.041,0.043,0.044,0.044,0.045,0.044,0.043,0.042,0.040,0.038,0.036,0.034,0.032,0.030,0.028,0.026,0.024,0.022,0.020];
  createChart('chartL2Attn',{
    type:'bar',data:{labels:Array.from({length:30},(_,i)=>i+1),
      datasets:[{label:'Avg Attention',data:attnVals,backgroundColor:attnVals.map((v,i)=>(i>=12&&i<=19)?C.cyan:(i>=6&&i<=11)?C.blue:'rgba(148,163,184,0.25)'),borderRadius:4}]},
    options:{responsive:true,plugins:{legend:{display:false}},scales:{y:{title:{display:true,text:'Weight'},grid:{color:'rgba(148,163,184,0.06)'}},x:{title:{display:true,text:'Future Control Step (min)'},grid:{display:false}}}}
  });
}
