/* hw-submit.js — кнопка «Send my homework»: отправляет ответы в Firebase (коллекция submissions).
   Ученик может только ОТПРАВИТЬ, читать может только Таня (правила Firestore).
   Никаких данных об устройстве/месте не собираем: только ученик, домашка, время, ответы.
   Подключение на странице:
     <div id="hw-send"></div>
     <script src="../../assets/hw-submit.js"></script>
     HWSubmit.init({student:'ksyusha', homework:'ksyusha/now-showing', title:'Now Showing'});
     HWSubmit.mount('hw-send', buildPayload, {copyButtonId:'copy'});
   buildPayload() возвращает {scores:{...}, sections:[{title, topic, kind, items:[{q,a,correct,ok}]}], text:'...', empty:N}
*/
(function(){
  var PROJECT='vocabulary-app-50c24', KEY='AIzaSyDoBRB7z4Kywfv3uZi9h0CGGQObvKbtHbo';
  var URL_='https://firestore.googleapis.com/v1/projects/'+PROJECT+'/databases/(default)/documents/submissions?key='+KEY;
  var cfg={}, ls={get:function(k){try{return localStorage.getItem(k);}catch(e){return null;}},set:function(k,v){try{localStorage.setItem(k,v);}catch(e){}}};

  function val(v){
    if(v===null||v===undefined) return {nullValue:null};
    if(typeof v==='boolean') return {booleanValue:v};
    if(typeof v==='number') return Number.isInteger(v)?{integerValue:String(v)}:{doubleValue:v};
    if(v instanceof Date) return {timestampValue:v.toISOString()};
    if(Array.isArray(v)) return {arrayValue:{values:v.map(val)}};
    if(typeof v==='object'){var f={};for(var k in v) if(v[k]!==undefined) f[k]=val(v[k]);return {mapValue:{fields:f}};}
    return {stringValue:String(v)};
  }

  /* активное время: считаем, только пока вкладка открыта и ученик что-то делал за последние 2 минуты */
  function startTimer(){
    var kStart='hw-first-'+cfg.homework, kAct='hw-active-'+cfg.homework;
    if(!ls.get(kStart)) ls.set(kStart,new Date().toISOString());
    var last=Date.now();
    ['click','keydown','input','scroll','touchstart'].forEach(function(e){document.addEventListener(e,function(){last=Date.now();},{passive:true,capture:true});});
    setInterval(function(){
      if(document.visibilityState==='visible' && Date.now()-last<120000){
        ls.set(kAct,String((parseInt(ls.get(kAct)||'0',10)||0)+15));
      }
    },15000);
  }

  function student(){
    var u=new URLSearchParams(location.search).get('u');
    return (u&&/^[\w-]{1,50}$/.test(u))?u:cfg.student;
  }

  var ICON_SEND='<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-3px;margin-right:6px"><path d="M4 12l16-8-6 16-3-7z"/></svg>';
  var ICON_OK='<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-3px;margin-right:6px"><path d="M5 12l5 5L20 7"/></svg>';

  function css(){
    if(document.getElementById('hw-send-css')) return;
    var s=document.createElement('style');s.id='hw-send-css';
    s.textContent='.hw-send{display:grid;gap:10px;margin-top:6px}.hw-send .hw-msg{font-weight:600;margin:0}.hw-send .hw-msg.ok{color:#12865f}.hw-send .hw-msg.no{color:#c0392b}'+
      '.hw-send .hw-sum{margin:0;opacity:.85}.hw-send button[disabled]{opacity:.6;cursor:default}'+
      '.hw-alt{font-size:.9em;opacity:.85;margin:4px 0 0}.hw-alt button{background:none;border:0;padding:0;font:inherit;color:inherit;text-decoration:underline;cursor:pointer}';
    document.head.appendChild(s);
  }

  window.HWSubmit={
    init:function(c){cfg=c;startTimer();},
    mount:function(boxId,build,opts){
      opts=opts||{};css();
      var box=document.getElementById(boxId);
      box.className='hw-send';
      box.innerHTML='<div><button class="btn" type="button" id="hw-send-btn">'+ICON_SEND+'Send my homework</button></div><p class="hw-msg" hidden></p><p class="hw-sum" hidden></p>';
      var btn=box.querySelector('button'), msg=box.querySelector('.hw-msg'), sum=box.querySelector('.hw-sum');
      var kSent='hw-sent-'+cfg.homework, prev=ls.get(kSent);
      if(prev){msg.hidden=false;msg.className='hw-msg ok';msg.innerHTML=ICON_OK+'You sent this on '+new Date(prev).toLocaleDateString('en-GB',{day:'numeric',month:'long'})+'. Changed something? Send it again.';btn.innerHTML=ICON_SEND+'Send again';}
      btn.addEventListener('click',function(){
        var p=build();
        if(p.empty>0 && !confirm(p.empty+(p.empty===1?' answer is':' answers are')+' empty. Send anyway?')) return;
        btn.disabled=true;btn.innerHTML=ICON_SEND+'Sending…';msg.hidden=true;
        var now=new Date();
        var doc={
          student:student(), homework:cfg.homework, title:cfg.title,
          submittedAt:now, firstOpenedAt:ls.get('hw-first-'+cfg.homework)||null,
          activeMinutes:Math.round((parseInt(ls.get('hw-active-'+cfg.homework)||'0',10)||0)/60),
          scores:p.scores||{}, sections:p.sections||[], text:p.text||'', resend:!!prev
        };
        fetch(URL_,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({fields:val(doc).mapValue.fields})})
          .then(function(r){if(!r.ok) throw new Error(r.status);return r.json();})
          .then(function(){
            ls.set(kSent,now.toISOString());prev=now.toISOString();
            msg.hidden=false;msg.className='hw-msg ok';msg.innerHTML=ICON_OK+'Sent! I\'ll check it and send you my comments.';
            var sc=Object.keys(doc.scores).map(function(k){return k+': '+doc.scores[k];}).join(' · ');
            if(sc){sum.hidden=false;sum.textContent='Your results (right first time): '+sc;}
            btn.disabled=false;btn.innerHTML=ICON_SEND+'Send again';
          })
          .catch(function(){
            msg.hidden=false;msg.className='hw-msg no';msg.textContent='Oops, it didn\'t send. Check your internet and try again, or copy your answers and paste them into our chat.';
            btn.disabled=false;btn.innerHTML=ICON_SEND+'Try again';
          });
      });
    }
  };
})();
