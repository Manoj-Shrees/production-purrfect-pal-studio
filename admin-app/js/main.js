/* ─ PARTICLE CANVAS ─ */
(function(){
  const cv=document.getElementById('particles');
  if(!cv)return;
  const ctx=cv.getContext('2d');
  let W,H,pts=[];
  function resize(){W=cv.width=cv.offsetWidth;H=cv.height=cv.offsetHeight}
  resize();
  window.addEventListener('resize',resize);
  for(let i=0;i<60;i++){
    pts.push({x:Math.random()*100,y:Math.random()*100,vx:(Math.random()-.5)*.04,vy:(Math.random()-.5)*.04,a:Math.random()})
  }
  function draw(){
    ctx.clearRect(0,0,W,H);
    pts.forEach(p=>{
      p.x+=p.vx;p.y+=p.vy;
      if(p.x<0)p.x=100;if(p.x>100)p.x=0;
      if(p.y<0)p.y=100;if(p.y>100)p.y=0;
      const px=p.x/100*W,py=p.y/100*H;
      ctx.beginPath();ctx.arc(px,py,1.2,0,Math.PI*2);
      ctx.fillStyle=`rgba(0,229,153,${.15+p.a*.2})`;ctx.fill();
    });
    pts.forEach((a,i)=>{
      pts.slice(i+1).forEach(b=>{
        const dx=(a.x-b.x)/100*W,dy=(a.y-b.y)/100*H;
        const d=Math.sqrt(dx*dx+dy*dy);
        if(d<120){
          ctx.beginPath();ctx.moveTo(a.x/100*W,a.y/100*H);ctx.lineTo(b.x/100*W,b.y/100*H);
          ctx.strokeStyle=`rgba(0,229,153,${(1-d/120)*.08})`;ctx.lineWidth=.5;ctx.stroke();
        }
      });
    });
    requestAnimationFrame(draw);
  }
  draw();
})();

/* ─ CAROUSEL ENGINE ─ */
const cars={};
function initCar(name,total,shape){
  let cur=0,timer=null,touchX=0;
  const slides=[...document.querySelectorAll(`#stage-${name} .slide`)];
  const progs=[...document.querySelectorAll(`#prog-${name} .cprog`)];

  function cls(o){
    if(o===0)return'active';
    if(o===-1)return'prev';
    if(o===1)return'next';
    if(o===-2)return'far-prev';
    if(o===2)return'far-next';
    return'hidden';
  }
  function go(idx){
    cur=((idx%total)+total)%total;
    slides.forEach((s,i)=>{
      let o=i-cur;
      if(o>total/2)o-=total;
      if(o<-total/2)o+=total;
      s.className=`slide ${cls(o)} ${shape}`;
      s.dataset.offset=o;
    });
    progs.forEach((p,i)=>{
      p.classList.toggle('active',i===cur);
      /* Restart fill animation */
      if(i===cur){const old=p.querySelector('::after');p.style.setProperty('--dummy',Math.random())}
    });
  }
  const next=()=>go(cur+1);
  const prev=()=>go(cur-1);
  const startA=()=>{stopA();timer=setInterval(next,4200)};
  const stopA=()=>{clearInterval(timer);timer=null};
  const resetA=()=>{stopA();startA()};

  document.querySelectorAll(`.arr[data-car="${name}"]`).forEach(btn=>{
    btn.addEventListener('click',()=>{btn.classList.contains('arr-p')?prev():next();resetA()});
  });
  progs.forEach((p,i)=>p.addEventListener('click',()=>{go(i);resetA()}));
  slides.forEach(s=>s.addEventListener('click',()=>{
    const o=+(s.dataset.offset||0);
    if(o!==0){go(cur+o);resetA();}
  }));

  const stage=document.getElementById(`stage-${name}`);
  stage.addEventListener('touchstart',e=>{touchX=e.touches[0].clientX;stopA()},{passive:true});
  stage.addEventListener('touchend',e=>{
    const dx=e.changedTouches[0].clientX-touchX;
    if(Math.abs(dx)>40){dx<0?next():prev();}
    startA();
  },{passive:true});

  go(0);startA();
  cars[name]={go,next,prev,startA,stopA};
}

/* Build progress dots */
function buildProgs(id,n){
  const c=document.getElementById(`prog-${id}`);
  if(!c)return;
  for(let i=0;i<n;i++){const d=document.createElement('div');d.className='cprog';d.dataset.index=i;c.appendChild(d)}
}
buildProgs('iphone',12);
buildProgs('ipad',12);
initCar('iphone',12,'portrait');
initCar('ipad',12,'landscape');

/* ─ DEVICE TABS ─ */
document.querySelectorAll('.device-tab').forEach(tab=>{
  tab.addEventListener('click',()=>{
    const name=tab.dataset.car;
    document.querySelectorAll('.device-tab').forEach(t=>t.classList.remove('active'));
    tab.classList.add('active');
    ['iphone','ipad'].forEach(n=>{
      document.getElementById(`car-${n}`).classList.toggle('show',n===name);
    });
    cars[name]?.startA();
  });
});

/* ─ KEYBOARD ─ */
document.addEventListener('keydown',e=>{
  const active=document.querySelector('.device-tab.active')?.dataset.car;
  if(e.key==='ArrowRight'){cars[active]?.next();cars[active]?.startA();}
  if(e.key==='ArrowLeft'){cars[active]?.prev();cars[active]?.startA();}
});

/* ─ DASHBOARD TABS ─ */
document.querySelectorAll('#dsb-nav .dsb-btn').forEach(btn=>{
  btn.addEventListener('click',()=>{
    document.querySelectorAll('#dsb-nav .dsb-btn').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('.panel').forEach(p=>p.classList.remove('active'));
    const t=document.getElementById('panel-'+btn.dataset.p);
    if(t)t.classList.add('active');
    if(btn.dataset.p==='sales')animateBars();
    if(btn.dataset.p==='analytics')animateMiniBar();
    if(btn.dataset.p==='forecast')animateForecast();
    if(btn.dataset.p==='system')animateSystem();
  });
});

/* Bar charts */
const barH=['42%','58%','35%','71%','80%','88%'];
function animateBars(){
  for(let i=0;i<6;i++){
    const b=document.getElementById('bar-'+i);
    if(!b)continue;
    b.style.setProperty('--h','0%');
    setTimeout(()=>b.style.setProperty('--h',barH[i]),i*90);
  }
}

/* Mini bars */
function animateMiniBar(){
  const sets={
    'mini-bars-conv':[30,55,42,68,60,72,80],
    'mini-bars-aov':[60,58,64,52,68,72,70],
    'mini-bars-cust':[40,55,60,50,45,58,42],
    'mini-bars-rep':[50,60,65,70,72,75,80],
  };
  Object.entries(sets).forEach(([id,vals])=>{
    const el=document.getElementById(id);
    if(!el)return;
    el.innerHTML='';
    vals.forEach((v,i)=>{
      const b=document.createElement('div');
      b.className='mini-bar'+(i===vals.length-1?' active':'');
      b.style.height='0px';
      el.appendChild(b);
      setTimeout(()=>b.style.height=Math.round(v*30/100)+'px',i*55);
    });
  });
}

/* Forecast fills */
function animateForecast(){
  document.querySelectorAll('.fc-fill').forEach((el,i)=>{
    el.style.width='0%';
    setTimeout(()=>el.style.width=el.dataset.w,i*120+80);
  });
}

/* System bars */
function animateSystem(){
  document.querySelectorAll('.sys-pct-fill').forEach((el,i)=>{
    el.style.width='0%';
    setTimeout(()=>el.style.width=el.dataset.w,i*100+50);
  });
}

/* Chips */
document.querySelectorAll('.chips').forEach(group=>{
  group.querySelectorAll('.chip').forEach(c=>{
    c.addEventListener('click',()=>{
      group.querySelectorAll('.chip').forEach(x=>x.classList.remove('active'));
      c.classList.add('active');
    });
  });
});

/* ─ SCROLL REVEAL ─ */
const revObs=new IntersectionObserver(entries=>{
  entries.forEach(e=>{
    if(e.isIntersecting){e.target.classList.add('visible');revObs.unobserve(e.target)}
  });
},{threshold:0.08});
document.querySelectorAll('.reveal').forEach(el=>revObs.observe(el));
