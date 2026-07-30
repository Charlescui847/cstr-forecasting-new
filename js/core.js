// ─────────────── GLOBAL STATE ───────────────
Chart.defaults.color='#94a3b8';Chart.defaults.borderColor='#1e293b';Chart.defaults.font.family="'Inter',sans-serif";
const C={blue:'#3b82f6',cyan:'#06b6d4',purple:'#8b5cf6',green:'#10b981',red:'#ef4444',orange:'#f59e0b',pink:'#ec4899',teal:'#14b8a6',indigo:'#6366f1'};
let simSpeed=15;
let l1Running=false,l1Paused=false,l2Running=false,l2Paused=false;
let l1Intervals=[],l2Intervals=[];
let l1StartTime=0,l2StartTime=0;
const L1_MODELS=[
{id:'persistence',name:'Persistence',icon:'📌',color:C.orange,type:'Naive Baseline',epochs:0,realSec:0,totalTicks:0,final:{nrmse:0.5673,b30:'—',event:'—',skill:0,recall:'—',missed:'—',decision:'Reference'},genLoss:function(){return[]}},
{id:'linear',name:'Linear Regression',icon:'📐',color:C.blue,type:'Ridge α=1.0 · 420-dim',epochs:1,realSec:0.4,totalTicks:2,final:{nrmse:0.1228,b30:0.2390,event:0.1235,skill:0.784,recall:0.750,missed:53,decision:'Keep'},genLoss:function(){return[{epoch:1,train:0.085,val:0.055}]}},
{id:'xgboost',name:'XGBoost',icon:'🌲',color:C.green,type:'n=200,d=8 · Trees',epochs:200,realSec:48.2,totalTicks:30,final:{nrmse:0.1152,b30:0.1684,event:0.1190,skill:0.797,recall:0.894,missed:22,decision:'Keep → Improve'},genLoss:function(t){let r=[];for(let i=1;i<=t;i++){let p=i/this.totalTicks;r.push({epoch:i,train:0.35-0.28*p-0.02*Math.random(),val:0.28-0.2*p-0.015*Math.random()})}return r}},
{id:'mlp',name:'MLP',icon:'🧠',color:C.purple,type:'420→8→8 · ReLU',epochs:25,realSec:15.8,totalTicks:16,final:{nrmse:0.1540,b30:0.2009,event:0.1649,skill:0.729,recall:0.849,missed:32,decision:'Stop'},genLoss:function(t){let r=[],vals=[0.207,0.112,0.077,0.058,0.047,0.040,0.035,0.033,0.031,0.030,0.029,0.029,0.028,0.028,0.027,0.027];for(let i=0;i<Math.min(t,vals.length);i++)r.push({epoch:i+1,train:vals[i]*1.15,val:vals[i]});return r}},
{id:'gru',name:'GRU',icon:'🔄',color:C.teal,type:'2-layer 64→32 · Seq',epochs:50,realSec:198.5,totalTicks:60,final:{nrmse:0.1120,b30:0.1652,event:0.1155,skill:0.803,recall:0.908,missed:18,decision:'Keep'},genLoss:function(t){let r=[];for(let i=1;i<=Math.min(t,50);i++){let p=i/50;r.push({epoch:i,train:0.42-0.35*p,val:0.38-0.33*p})}return r}},
{id:'lstm',name:'LSTM',icon:'🔷',color:C.cyan,type:'2-layer 64→32 · Seq',epochs:50,realSec:262.0,totalTicks:75,final:{nrmse:0.1057,b30:0.1583,event:0.1088,skill:0.814,recall:0.910,missed:19,decision:'Keep → Improve'},genLoss:function(t){let r=[];for(let i=1;i<=Math.min(t,50);i++){let p=i/50;r.push({epoch:i,train:0.48-0.42*p,val:0.44-0.4*p})}return r}}
];
const L2_MODELS=[
{id:'xgb_imp',name:'XGBoost_improved',icon:'🌲✨',color:C.green,type:'n=400,d=12 · Tuned',epochs:400,realSec:98.4,totalTicks:28,final:{nrmse:0.1062,b30:0.1558,event:0.1104,nonEvent:0.0996,skill:0.813,recall:0.919,missed:17},genLoss:function(t){let r=[];for(let i=1;i<=t;i++){let p=i/this.totalTicks;r.push({epoch:i,train:0.30-0.24*p,val:0.24-0.17*p})}return r}},
{id:'lstm_imp',name:'LSTM_improved',icon:'🔷✨',color:C.cyan,type:'BiLSTM-Attn · 71k params',epochs:80,realSec:485.3,totalTicks:110,final:{nrmse:0.0984,b30:0.1487,event:0.1009,nonEvent:0.0942,skill:0.827,recall:0.972,missed:6},genLoss:function(t){let r=[];for(let i=1;i<=Math.min(t,80);i++){let p=i/80;r.push({epoch:i,train:0.38-0.34*p,val:0.36-0.33*p})}return r}}
];
let charts={};
function destroyChart(id){if(charts[id]){charts[id].destroy();delete charts[id]}}
function showToast(msg){let t=document.getElementById('toast');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2200)}
function setSpeed(btn,s){simSpeed=s;document.querySelectorAll('.btn-speed').forEach(b=>b.classList.remove('active'));btn.classList.add('active')}
function buildStatusGrid(gridId,models){let g=document.getElementById(gridId);g.innerHTML=models.map(m=>`<div class="status-card" id="sc-${m.id}"><div class="s-header"><span class="s-name">${m.icon} ${m.name}</span><span class="s-epoch" id="ep-${m.id}">—</span></div><div class="s-bar-bg"><div class="s-bar-fill" id="bar-${m.id}" style="background:${m.color};width:0%"></div></div><div class="s-loss"><span>Loss:</span><span id="loss-${m.id}">—</span></div><div class="s-status waiting" id="st-${m.id}">⏳ Waiting</div></div>`).join('')}
