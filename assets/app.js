(function(){var g=document.getElementById('grid');if(!g)return;
var cards=[].slice.call(g.querySelectorAll('.card')),q=document.getElementById('q'),cnt=document.getElementById('count'),empty=document.getElementById('empty'),F={};
function run(){var t=q.value.trim().toLowerCase(),n=0;cards.forEach(function(c){var ok=(!t||c.dataset.text.indexOf(t)>=0)&&(!F.sem||c.dataset.sem===F.sem)&&(!F.group||c.dataset.group===F.group)&&(!F.kr||c.dataset.kr==='1')&&(!F.lab||c.dataset.lab==='1');c.hidden=!ok;if(ok)n++;});
cnt.textContent='Показано: '+n+' из '+cards.length;empty.hidden=n>0;}
[].forEach.call(document.querySelectorAll('.chipbar button'),function(b){b.addEventListener('click',function(){var f=b.dataset.f,v=b.dataset.v,on=b.getAttribute('aria-pressed')==='true';
[].forEach.call(document.querySelectorAll('.chipbar button[data-f="'+f+'"]'),function(x){x.setAttribute('aria-pressed','false');});
if(on)delete F[f];else{F[f]=v;b.setAttribute('aria-pressed','true');}run();});});
q.addEventListener('input',run);run();})();
