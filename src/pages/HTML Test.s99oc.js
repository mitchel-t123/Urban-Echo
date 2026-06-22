<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Urban Echo — Hero</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Archivo+Black&family=Inter:wght@400;500;600;700;800&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet">
<style>
/* ── TOKENS ── */
:root{
  --cream:#FBF5E7; --cream-deep:#F4ECD8;
  --indigo:#3F3FF0; --indigo-deep:#2C2CC4;
  --orange:#F4612E; --orange-deep:#D8491B;
  --coral:#E0413B; --forest:#4AAE74; --forest-deep:#379260;
  --sunshine:#F9C328; --ink:#161527; --paper:#FFFCF5;
  --line:rgba(22,21,39,0.12);
  --display:'Archivo Black','Arial Black',sans-serif;
  --body:'Inter',-apple-system,sans-serif;
  --mono:'Space Mono',monospace;
}
*{margin:0;padding:0;box-sizing:border-box;}
html,body{overflow-x:hidden;}
body{font-family:var(--body);color:var(--ink);line-height:1.5;-webkit-font-smoothing:antialiased;}
img{max-width:100%;display:block;}
a{color:inherit;}
.wrap{max-width:1180px;margin:0 auto;padding:0 32px;}
h1,h2,h3{font-family:var(--display);line-height:1.02;letter-spacing:-0.01em;text-transform:uppercase;}
.eyebrow{font-family:var(--mono);text-transform:uppercase;letter-spacing:.14em;font-size:13px;font-weight:700;}
.btn{
  display:inline-flex;align-items:center;gap:10px;
  font-family:var(--body);font-weight:700;font-size:16px;
  padding:16px 30px;border-radius:100px;
  border:2.5px solid var(--ink);background:var(--ink);color:var(--paper);
  cursor:pointer;text-decoration:none;
  transition:transform .18s ease,box-shadow .18s ease;
}
.btn:hover{transform:translateY(-3px);box-shadow:6px 6px 0 var(--ink);}
.btn-orange{background:var(--orange);border-color:var(--ink);color:var(--ink);}
.btn-orange:hover{box-shadow:6px 6px 0 var(--ink);}
.btn-outline{background:transparent;color:var(--ink);}
.btn-cream{background:var(--cream);color:var(--ink);border-color:var(--ink);}
.btn-cream:hover{box-shadow:6px 6px 0 var(--ink);}
.section-head{max-width:640px;margin-bottom:52px;}
.section-head .eyebrow{color:var(--orange-deep);margin-bottom:14px;display:block;}
.section-head h2{font-size:clamp(30px,4.4vw,48px);}
.section-head p{margin-top:18px;font-size:17px;color:rgba(22,21,39,.72);max-width:560px;}
/* scroll reveal */
.js-reveal{opacity:0;transform:translateY(24px);transition:opacity .7s ease,transform .7s ease;}
.js-reveal.in{opacity:1;transform:translateY(0);}
@media(prefers-reduced-motion:reduce){.js-reveal{opacity:1;transform:none;transition:none;}}
/* recovery badges (reused in contact too) */
.recovery-badge{
  background:var(--paper);border:2px solid var(--ink);
  border-radius:100px;padding:8px 16px;
  font-family:var(--mono);font-size:12.5px;font-weight:700;
}
</style>
<style>
body{background:var(--orange);}

.hero{
  background:var(--orange);color:var(--ink);
  position:relative;overflow:hidden;padding:76px 0 0;
  border-bottom:6px solid var(--ink);
  transition:background .6s ease;
}
.hero.score-1{background:#F5621A;} .hero.score-2{background:#F25418;}
.hero.score-3{background:#EE4616;} .hero.score-4{background:#EA3814;}
.hero.score-5{background:#E42A0F;} .hero.score-6{background:#DE1C0A;}
.hero-grid{display:grid;grid-template-columns:1.15fr 0.85fr;gap:40px;align-items:end;}
.hero-tag{
  display:inline-flex;align-items:center;gap:10px;
  background:var(--ink);color:var(--paper);
  padding:8px 18px;border-radius:100px;
  font-family:var(--mono);font-size:13px;font-weight:700;
  text-transform:uppercase;letter-spacing:.08em;margin-bottom:26px;
}
.hero-tag .dot{width:8px;height:8px;border-radius:50%;background:var(--coral);animation:pulse 1.6s infinite;}
@keyframes pulse{0%,100%{opacity:1;}50%{opacity:.25;}}
.hero h1{font-size:clamp(40px,6.2vw,78px);margin-bottom:22px;}
.hero h1 .small{display:block;font-size:.4em;letter-spacing:.02em;margin-bottom:6px;}
/* checklist */
.hero-checklist{display:flex;flex-direction:column;gap:8px;margin-bottom:28px;max-width:500px;}
.hero-check{
  display:flex;align-items:center;gap:14px;
  font-size:16px;font-weight:600;color:var(--ink);line-height:1.3;
  cursor:pointer;padding:11px 16px;border-radius:12px;
  border:2px solid rgba(22,21,39,.25);background:rgba(255,255,255,.65);
  backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);
  user-select:none;transition:background .2s ease,border-color .2s ease,transform .15s ease;
  -webkit-tap-highlight-color:transparent;
}
.hero-check:hover{background:rgba(255,255,255,.92);border-color:var(--ink);transform:translateX(4px);}
.hero-check.checked{background:var(--ink);color:var(--paper);border-color:var(--ink);}
.check-icon{
  width:28px;height:28px;border-radius:8px;border:2.5px solid currentColor;
  display:flex;align-items:center;justify-content:center;
  flex-shrink:0;font-size:15px;font-weight:900;
  transition:background .2s,border-color .2s;
}
.hero-check.checked .check-icon{background:var(--orange);border-color:var(--orange);color:var(--paper);}
/* answer card */
.hero-answer-card{
  margin-top:6px;padding:14px 18px;background:var(--paper);
  border-radius:14px;border:2.5px solid var(--ink);
  font-size:15px;font-weight:700;
  transition:all .35s ease;box-shadow:4px 4px 0 rgba(22,21,39,.15);
  opacity:.45;transform:translateY(4px);
}
.hero-answer-card.active{opacity:1;transform:translateY(0);}
.hero-answer-card.level-1{border-color:var(--sunshine);background:#fffce8;}
.hero-answer-card.level-2{border-color:var(--orange);background:#fff3ed;box-shadow:4px 4px 0 rgba(244,97,46,.25);}
.hero-answer-card.level-3{
  border-color:var(--coral);background:#fff0f0;
  box-shadow:5px 5px 0 rgba(224,65,59,.3);
  animation:pulse-card 1.4s ease-in-out infinite;
}
@keyframes pulse-card{0%,100%{box-shadow:5px 5px 0 rgba(224,65,59,.3);}50%{box-shadow:5px 5px 0 rgba(224,65,59,.7),0 0 24px rgba(224,65,59,.25);}}
.hero-answer-label{font-family:var(--mono);font-size:11px;text-transform:uppercase;letter-spacing:.1em;opacity:.6;display:block;margin-bottom:4px;}
.hero-answer-text{display:block;line-height:1.4;}
.hero-ctas{display:flex;gap:14px;flex-wrap:wrap;padding-bottom:64px;}
/* figure */
.hero-figure{position:relative;display:flex;justify-content:center;align-items:flex-end;height:100%;}
.mascot-stack{position:relative;width:78%;max-width:360px;min-height:300px;}
.mascot-img{
  width:100%;position:absolute;bottom:0;left:0;
  opacity:0;transition:opacity .5s ease,transform .5s ease;
  transform:scale(.95);filter:drop-shadow(0 18px 0 rgba(22,21,39,.12));
  pointer-events:none;
}
.mascot-img.visible{opacity:1;transform:scale(1);}
@keyframes mascot-shake{
  0%,100%{transform:scale(1) rotate(0deg);}
  15%{transform:scale(1.04) rotate(-3deg);}
  30%{transform:scale(1.04) rotate(3deg);}
  45%{transform:scale(1.04) rotate(-2deg);}
  60%{transform:scale(1.04) rotate(2deg);}
  75%{transform:scale(1.02) rotate(-1deg);}
}
.mascot-img.shake{animation:mascot-shake .7s ease;}
/* symptom card */
.hero-symptom-card{
  position:absolute;top:6%;left:-6px;
  background:var(--paper);border:2.5px solid var(--ink);
  border-radius:16px;padding:12px 16px;
  font-family:var(--mono);font-size:13px;font-weight:700;
  box-shadow:5px 5px 0 var(--ink);transform:rotate(-6deg);
  transition:background .4s ease,border-color .4s ease,color .4s ease,box-shadow .4s ease;
  z-index:2;line-height:1.5;
}
.card-status{font-size:11px;opacity:.65;display:block;margin-bottom:2px;font-family:var(--mono);text-transform:uppercase;letter-spacing:.08em;}
.card-diag{display:block;font-size:13px;font-weight:700;transition:color .4s ease;}
.hero-symptom-card.level-1{border-color:var(--sunshine);background:#fffce0;box-shadow:5px 5px 0 rgba(22,21,39,.3);}
.hero-symptom-card.level-2{border-color:var(--orange);background:var(--orange);color:var(--paper);box-shadow:6px 6px 0 var(--ink);}
.hero-symptom-card.level-2 .card-status{opacity:.85;}
.hero-symptom-card.level-3{
  border-color:var(--coral);background:var(--coral);color:var(--paper);
  box-shadow:7px 7px 0 var(--ink);
  animation:card-alarm 1.2s ease-in-out infinite;
}
.hero-symptom-card.level-3 .card-status{opacity:.9;}
@keyframes card-alarm{0%,100%{transform:rotate(-6deg) scale(1);}50%{transform:rotate(-6deg) scale(1.04);}}
/* severity bar */
.severity-bar{
  position:absolute;top:-2px;left:0;right:0;
  height:5px;background:rgba(22,21,39,.1);border-radius:100px;
  overflow:hidden;display:none;
}
.severity-bar.visible{display:block;}
.severity-fill{height:100%;border-radius:100px;width:0%;transition:width .4s ease,background .4s ease;background:var(--sunshine);}
/* responsive */
@media(max-width:920px){
  .hero-grid{grid-template-columns:1fr;}
  .hero-figure{order:-1;padding-top:20px;}
  .mascot-stack{max-width:240px;}
}
@media(max-width:600px){.wrap{padding:0 20px;}.hero{padding-top:56px;}}

</style>
</head>
<body>

<header class="hero" id="heroSection">
  <div class="wrap">
    <div class="hero-grid">
      <div class="hero-copy">
        <div class="hero-tag"><span class="dot"></span> Now Treating Perth Schools</div>
        <h1>
          <span class="small">In the case of a</span>
          <span class="big">Sound<br>Emergency</span>
        </h1>
        <div class="hero-checklist">
          <div class="hero-check" data-symptom="0"><span class="check-icon"></span>Endless School Events?</div>
          <div class="hero-check" data-symptom="1"><span class="check-icon"></span>No in-house Sound Guy?</div>
          <div class="hero-check" data-symptom="2"><span class="check-icon"></span>Too Many School Events?</div>
          <div class="hero-check" data-symptom="3"><span class="check-icon"></span>No Time?</div>
          <div class="hero-check" data-symptom="4"><span class="check-icon"></span>Tired of Feedback?</div>
          <div class="hero-check" data-symptom="5"><span class="check-icon"></span>Always Multi-tasking?</div>
          <div class="hero-answer-card" id="heroAnswer">
            <span class="hero-answer-label" id="heroAnswerLabel">Awaiting diagnosis...</span>
            <span class="hero-answer-text" id="heroAnswerText">Tick the boxes above that apply to your school.</span>
          </div>
        </div>
        <div class="hero-ctas">
          <a href="#ue-contact" class="btn btn-orange">Book Your Free Trial Event</a>
          <a href="#ue-contact" class="btn btn-outline" style="border-color:var(--ink);">Contact Us</a>
        </div>
      </div>
      <div class="hero-figure">
        <div class="hero-symptom-card" id="heroCard">
          <span class="card-status" id="heroCardStatus">📋 Patient: Your School</span>
          <span class="card-diag" id="heroCardDiag">Status: Healthy ✓</span>
        </div>
        <div class="severity-bar" id="severityBar">
          <div class="severity-fill" id="severityFill"></div>
        </div>
        <div class="mascot-stack">
          <!-- Replace src values with your hosted image URLs -->
          <img id="mascotNeutral"  class="mascot-img visible" src="images/mascot_neutral_smile.png"    alt="Happy Urban Echo mascot">
          <img id="mascotWorried"  class="mascot-img"         src="images/mascot_shocked_bandaid.png"  alt="Worried Urban Echo mascot">
          <img id="mascotCritical" class="mascot-img"         src="images/asterisk_help_flag.png"      alt="Urban Echo mascot waving help flag">
        </div>
      </div>
    </div>
  </div>
</header>

<script>
// Scroll reveal
if(!window.matchMedia('(prefers-reduced-motion:reduce)').matches&&'IntersectionObserver'in window){
  var els=document.querySelectorAll('[data-reveal]');
  els.forEach(function(el){el.classList.add('js-reveal');});
  var io=new IntersectionObserver(function(entries){
    entries.forEach(function(e){
      if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target);}
    });
  },{threshold:.12});
  els.forEach(function(el){io.observe(el);});
}
</script>
<script>
(function(){
  var hero=document.getElementById('heroSection');
  var checks=document.querySelectorAll('.hero-check[data-symptom]');
  var answerCard=document.getElementById('heroAnswer');
  var answerLabel=document.getElementById('heroAnswerLabel');
  var answerText=document.getElementById('heroAnswerText');
  var heroCard=document.getElementById('heroCard');
  var heroCardDiag=document.getElementById('heroCardDiag');
  var heroCardStatus=document.getElementById('heroCardStatus');
  var severityBar=document.getElementById('severityBar');
  var severityFill=document.getElementById('severityFill');
  var mascotNeutral=document.getElementById('mascotNeutral');
  var mascotWorried=document.getElementById('mascotWorried');
  var mascotCrit=document.getElementById('mascotCritical');
  var ticked=new Set();
  var LEVELS=[
    {cardStatus:'📋 Patient: Your School',cardDiag:'Status: Healthy ✓',cardClass:'',ansLabel:'Awaiting diagnosis...',ansText:'Tick the symptoms above that apply to your school.',ansClass:'',mascot:'neutral',severity:0,heroBg:'',barColor:''},
    {cardStatus:'📋 Patient: Your School',cardDiag:'Mild AV Stress Detected',cardClass:'level-1',ansLabel:'Early diagnosis',ansText:'One symptom identified. Schools often miss the early signs — keep ticking.',ansClass:'active level-1',mascot:'neutral',severity:17,heroBg:'score-1',barColor:'#F9C328'},
    {cardStatus:'⚠️ Patient: Your School',cardDiag:'AV Stress: Escalating',cardClass:'level-1',ansLabel:'Warning: Pattern emerging',ansText:"Two symptoms confirmed. This is more common than you'd think — and completely fixable.",ansClass:'active level-1',mascot:'worried',severity:33,heroBg:'score-2',barColor:'#F9C328'},
    {cardStatus:'🚨 DIAGNOSIS',cardDiag:'Sound Emergency Confirmed',cardClass:'level-2',ansLabel:'Sound Emergency detected',ansText:"Three symptoms confirmed. You've got a Sound Emergency — Urban Echo is the treatment.",ansClass:'active level-2',mascot:'worried',severity:50,heroBg:'score-3',barColor:'#F4612E'},
    {cardStatus:'🚨 DIAGNOSIS: CRITICAL',cardDiag:'Acute AV Overwhelm',cardClass:'level-2',ansLabel:'Critical level reached',ansText:'Four symptoms. Your school deserves a proper Sound team, not another scramble.',ansClass:'active level-2',mascot:'worried',severity:67,heroBg:'score-4',barColor:'#F4612E'},
    {cardStatus:'🆘 EMERGENCY',cardDiag:'Maximum AV Distress!',cardClass:'level-3',ansLabel:'⚠️ Immediate treatment required',ansText:'Five symptoms! This is a full Sound Emergency. Call Mitchel: 0429 660 186.',ansClass:'active level-3',mascot:'critical',severity:83,heroBg:'score-5',barColor:'#E0413B'},
    {cardStatus:'🆘 CODE RED',cardDiag:'Total Sound Meltdown!',cardClass:'level-3',ansLabel:'🚨 CRITICAL — Urban Echo to the rescue',ansText:"All six! You are living the Sound Emergency. We were literally made for this. Let's fix it.",ansClass:'active level-3',mascot:'critical',severity:100,heroBg:'score-6',barColor:'#E0413B'},
  ];
  function setMascot(target){
    var map={neutral:mascotNeutral,worried:mascotWorried,critical:mascotCrit};
    Object.keys(map).forEach(function(k){
      var el=map[k];
      if(k===target&&!el.classList.contains('visible')){
        el.classList.add('visible');
        el.classList.remove('shake');
        void el.offsetWidth;
        el.classList.add('shake');
      } else if(k!==target){
        el.classList.remove('visible');
      }
    });
  }
  function updateUI(){
    var score=ticked.size;
    var L=LEVELS[score];
    hero.className='hero'+(L.heroBg?' '+L.heroBg:'');
    heroCardStatus.textContent=L.cardStatus;
    heroCardDiag.textContent=L.cardDiag;
    heroCard.className='hero-symptom-card'+(L.cardClass?' '+L.cardClass:'');
    if(score>0){severityBar.classList.add('visible');severityFill.style.width=L.severity+'%';severityFill.style.background=L.barColor;}
    else{severityBar.classList.remove('visible');}
    answerLabel.textContent=L.ansLabel;
    answerText.textContent=L.ansText;
    answerCard.className='hero-answer-card'+(L.ansClass?' '+L.ansClass:'');
    setMascot(L.mascot);
  }
  checks.forEach(function(row){
    row.addEventListener('click',function(){
      var idx=this.dataset.symptom;
      if(ticked.has(idx)){ticked.delete(idx);this.classList.remove('checked');this.querySelector('.check-icon').textContent='';}
      else{ticked.add(idx);this.classList.add('checked');this.querySelector('.check-icon').textContent='✓';}
      updateUI();
    });
  });
  updateUI();
})();
</script>
</body>
</html>