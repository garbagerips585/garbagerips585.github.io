// TEMP QA harness - delete after audit
(function(){
function px(v){return parseFloat(v)||0}
function parseColor(s){
  if(!s) return null;
  s=s.trim();
  if(s==='transparent') return [0,0,0,0];
  var m=s.match(/^rgba?\(([^)]+)\)$/);
  if(m){var p=m[1].split(/[,\/\s]+/).filter(Boolean).map(parseFloat);
    return [p[0],p[1],p[2], p.length>3?p[3]:1];}
  return null;
}
function over(fg,bg){ // fg over bg, both rgba
  var a=fg[3]; if(a>=1) return [fg[0],fg[1],fg[2],1];
  var ob=bg[3];
  var oa=a+ob*(1-a);
  if(oa===0) return [0,0,0,0];
  return [(fg[0]*a+bg[0]*ob*(1-a))/oa,(fg[1]*a+bg[1]*ob*(1-a))/oa,(fg[2]*a+bg[2]*ob*(1-a))/oa,oa];
}
function lum(c){
  function f(v){v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4)}
  return 0.2126*f(c[0])+0.7152*f(c[1])+0.0722*f(c[2]);
}
function ratio(a,b){var l1=lum(a),l2=lum(b);if(l1<l2){var t=l1;l1=l2;l2=t}return (l1+0.05)/(l2+0.05)}
function fmt(c){return 'rgb('+Math.round(c[0])+','+Math.round(c[1])+','+Math.round(c[2])+')'}
// resolve effective background behind element (ignoring element's own bg unless includeSelf)
function bgOf(el,includeSelf){
  var stack=[]; var n=includeSelf?el:el.parentElement; var gradient=false;
  while(n){
    var cs=getComputedStyle(n);
    var bi=cs.backgroundImage;
    if(bi&&bi!=='none') gradient=true;
    var c=parseColor(cs.backgroundColor);
    if(c&&c[3]>0){stack.push(c); if(c[3]>=1) break;}
    n=n.parentElement;
  }
  var acc=[255,255,255,1];
  for(var i=stack.length-1;i>=0;i--) acc=over(stack[i],acc);
  if(acc[3]<1) acc=over(acc,[255,255,255,1]);
  return {c:acc,gradient:gradient};
}
function sel(el){
  if(!el||el.nodeType!==1) return '?';
  var s=el.tagName.toLowerCase();
  if(el.id) s+='#'+el.id;
  if(el.className&&typeof el.className==='string'){
    var cl=el.className.trim().split(/\s+/).slice(0,4);
    if(cl.length&&cl[0]) s+='.'+cl.join('.');
  }
  return s;
}
function path(el){
  var out=[],n=el,i=0;
  while(n&&n.nodeType===1&&i<5){out.unshift(sel(n));n=n.parentElement;i++}
  return out.join(' > ');
}
function hasOwnText(el){
  for(var i=0;i<el.childNodes.length;i++){
    var n=el.childNodes[i];
    if(n.nodeType===3&&n.nodeValue.trim().length>0) return true;
  }
  return false;
}
function scrollableAncestor(el){
  var n=el.parentElement;
  while(n&&n!==document.documentElement){
    var cs=getComputedStyle(n);
    if(cs.overflowX==='auto'||cs.overflowX==='scroll') return sel(n);
    n=n.parentElement;
  }
  return null;
}
window.__qa=function(opts){
  opts=opts||{};
  var W=window.innerWidth, H=window.innerHeight;
  var de=document.documentElement;
  var res={w:W,h:H,url:location.pathname,docScrollW:de.scrollWidth,bodyScrollW:document.body.scrollWidth};
  var all=document.querySelectorAll('body *');
  // --- overflow ---
  var ovf=[];
  if(de.scrollWidth>W+1){
    for(var i=0;i<all.length;i++){
      var el=all[i];
      var cs=getComputedStyle(el);
      if(cs.display==='none'||cs.visibility==='hidden'||cs.position==='fixed') continue;
      var r=el.getBoundingClientRect();
      if(r.width===0&&r.height===0) continue;
      var right=r.right+window.scrollX;
      if(right>W+1){
        var sa=scrollableAncestor(el);
        // only report if no scrollable ancestor and parent doesn't also overflow same amount
        ovf.push({s:path(el),right:Math.round(right*10)/10,left:Math.round(r.left),w:Math.round(r.width),scrollAnc:sa});
      }
    }
  }
  // keep the deepest/most-specific few
  res.overflow=ovf.filter(function(o){return !o.scrollAnc}).slice(0,25);
  res.overflowInScroller=ovf.filter(function(o){return o.scrollAnc}).length;
  // --- small text ---
  var small={};
  for(var i=0;i<all.length;i++){
    var el=all[i];
    if(!hasOwnText(el)) continue;
    var cs=getComputedStyle(el);
    if(cs.display==='none'||cs.visibility==='hidden') continue;
    var r=el.getBoundingClientRect();
    if(r.width===0&&r.height===0) continue;
    var fs=px(cs.fontSize);
    if(fs<12){
      var k=sel(el)+'|'+fs;
      if(!small[k]) small[k]={s:path(el),fs:fs,n:0,txt:(el.textContent||'').trim().slice(0,40)};
      small[k].n++;
    }
  }
  res.smallText=Object.keys(small).map(function(k){return small[k]});
  // --- tap targets ---
  var taps={};
  if(opts.taps!==false){
    var cands=document.querySelectorAll('a,button,input,select,textarea,summary,[role="button"],[onclick]');
    for(var i=0;i<cands.length;i++){
      var el=cands[i];
      var cs=getComputedStyle(el);
      if(cs.display==='none'||cs.visibility==='hidden'||cs.pointerEvents==='none') continue;
      var r=el.getBoundingClientRect();
      if(r.width===0&&r.height===0) continue;
      if(r.width<40||r.height<40){
        var k=sel(el);
        if(!taps[k]) taps[k]={s:path(el),w:Math.round(r.width),h:Math.round(r.height),n:0,txt:(el.textContent||'').trim().slice(0,30)};
        taps[k].n++;
      }
    }
  }
  res.tapTargets=Object.keys(taps).map(function(k){return taps[k]});
  // --- contrast ---
  var con={};
  for(var i=0;i<all.length;i++){
    var el=all[i];
    if(!hasOwnText(el)) continue;
    var cs=getComputedStyle(el);
    if(cs.display==='none'||cs.visibility==='hidden'||cs.opacity==='0') continue;
    var r=el.getBoundingClientRect();
    if(r.width===0&&r.height===0) continue;
    var fg=parseColor(cs.color); if(!fg) continue;
    var bgi=bgOf(el,true);
    var bg=bgi.c;
    var eff=fg[3]<1?over(fg,bg):fg;
    var ra=ratio(eff,bg);
    var fs=px(cs.fontSize), fw=cs.fontWeight;
    var large=(fs>=24)||(fs>=18.66&&(parseInt(fw)>=700||fw==='bold'));
    var need=large?3:4.5;
    if(ra<need){
      var k=sel(el)+'|'+fmt(eff)+'|'+fmt(bg);
      if(!con[k]) con[k]={s:path(el),fg:fmt(eff),bg:fmt(bg),ratio:Math.round(ra*100)/100,fs:fs,fw:fw,large:large,need:need,grad:bgi.gradient,n:0,txt:(el.textContent||'').trim().slice(0,40)};
      con[k].n++;
    }
  }
  res.contrast=Object.keys(con).map(function(k){return con[k]}).sort(function(a,b){return a.ratio-b.ratio});
  return res;
};
window.__qaOverlap=function(selA){
  // report elements whose text is clipped (scrollWidth>clientWidth)
  var out=[];
  var all=document.querySelectorAll('body *');
  for(var i=0;i<all.length;i++){
    var el=all[i];
    if(!hasOwnText(el)) continue;
    var cs=getComputedStyle(el);
    if(cs.display==='none'||cs.overflow==='visible'&&cs.overflowX==='visible') {}
    if((cs.overflowX==='hidden'||cs.overflow==='hidden')&&el.scrollWidth>el.clientWidth+1){
      out.push({s:path(el),sw:el.scrollWidth,cw:el.clientWidth,txt:(el.textContent||'').trim().slice(0,40)});
    }
    if((cs.overflowY==='hidden'||cs.overflow==='hidden')&&el.scrollHeight>el.clientHeight+2){
      out.push({s:path(el),sh:el.scrollHeight,ch:el.clientHeight,txt:(el.textContent||'').trim().slice(0,40),vert:true});
    }
  }
  return out.slice(0,30);
};
window.__qaGrid=function(){
  // grid orphan check: for each grid container, count children and columns
  var out=[];
  var all=document.querySelectorAll('body *');
  for(var i=0;i<all.length;i++){
    var el=all[i];
    var cs=getComputedStyle(el);
    if(cs.display!=='grid'&&cs.display!=='inline-grid') continue;
    var kids=[].filter.call(el.children,function(c){return getComputedStyle(c).display!=='none'});
    if(kids.length<3) continue;
    var cols=cs.gridTemplateColumns.split(' ').filter(Boolean).length;
    if(cols<2) continue;
    var rem=kids.length%cols;
    out.push({s:sel(el),cols:cols,kids:kids.length,lastRow:rem===0?cols:rem});
  }
  return out;
};
window.__qaSweep=function(urls,w,h,opts){
  opts=opts||{};
  return new Promise(function(resolve){
    var out=[];var idx=0;
    var fr=document.createElement('iframe');
    fr.style.cssText='position:fixed;left:-9999px;top:0;border:0;';
    fr.width=w;fr.height=h;
    fr.setAttribute('width',w);fr.setAttribute('height',h);
    fr.style.width=w+'px';fr.style.height=h+'px';
    document.body.appendChild(fr);
    function next(){
      if(idx>=urls.length){fr.remove();resolve(out);return}
      var u=urls[idx++];
      var done=false;
      fr.onload=function(){
        if(done)return;done=true;
        setTimeout(function(){
          try{
            var d=fr.contentDocument,cw=fr.contentWindow;
            // trigger scroll reveals
            var maxY=d.documentElement.scrollHeight;
            for(var y=0;y<maxY;y+=Math.max(200,h/2)) cw.scrollTo(0,y);
            cw.scrollTo(0,0);
            var s=d.createElement('script');s.src='/assets/__qa.js?x='+Date.now();
            s.onload=function(){
              setTimeout(function(){
                try{
                  var r=cw.__qa(opts);
                  r.url=u;
                  r.iframeW=cw.innerWidth;
                  r.clipped=cw.__qaOverlap();
                  r.grids=cw.__qaGrid();
                  out.push(r);
                }catch(e){out.push({url:u,error:String(e)})}
                next();
              },400);
            };
            s.onerror=function(){out.push({url:u,error:'qa script failed to load'});next()};
            d.body.appendChild(s);
          }catch(e){out.push({url:u,error:'X:'+String(e)});next()}
        },900);
      };
      fr.src=u;
    }
    next();
  });
};
console.log('__qa loaded');
})();
