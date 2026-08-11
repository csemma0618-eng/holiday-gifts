// ============================================================
// Holiday Gifts Editor v4 — Clean rewrite, all bugs fixed
// ============================================================
'use strict';

var CANVAS_W = 800, CANVAS_H = 500;
var canvas, ctx;
var objects = [];
var bgGradient = null;
var selectedIdx = -1;
var isDragging = false, dragStartX, dragStartY, dragObjX, dragObjY;
var isResizing = false, resizeHandle = '', resizeStartX, resizeStartY, resizeOrigX, resizeOrigY, resizeOrigW, resizeOrigH;
var isDrawing = false, currentPath = null;
var currentTool = 'templates';
var undoStack = [], redoStack = [];
var giftId = window._giftId;
var brushColor = '#c41e3a', brushSize = 4;
var placementEmoji = null;
var selectedRecipientId = null;

// ── Helpers ─────────────────────────────────────────────────
function uid(){ return 'o'+Date.now()+'_'+Math.random().toString(36).substr(2,6); }
function rectContains(rx,ry,rw,rh,px,py){ return px>=rx&&px<=rx+rw&&py>=ry&&py<=ry+rh; }
function clamp(v,lo,hi){ return Math.max(lo,Math.min(hi,v)); }

// ── Presets ─────────────────────────────────────────────────
var BG_PRESETS = [
  { name:'Christmas', colors:['#c41e3a','#8b0000','#2e7d32'], icon:'🎄' },
  { name:'New Year', colors:['#0a0a2e','#1a1a5e','#ffd700'], icon:'🎆' },
  { name:'Birthday', colors:['#e91e63','#9c27b0','#ff9800'], icon:'🎂' },
  { name:'Spring Festival', colors:['#c41e3a','#ff6b35','#ffd700'], icon:'🏮' },
  { name:'Winter', colors:['#87CEEB','#B0E0E6','#F0F8FF'], icon:'❄️' },
  { name:'Golden', colors:['#ff6b35','#ffd700','#ffecd2'], icon:'🌅' },
  { name:'Night', colors:['#0a0a2e','#191970','#2a1a4e'], icon:'🌙' },
  { name:'Pastel', colors:['#a8e6cf','#ffd3b6','#dcedc1'], icon:'🌸' },
  { name:'Candy', colors:['#ffffff','#c41e3a','#2e7d32'], icon:'🍬' },
  { name:'Forest', colors:['#1b5e20','#2e7d32','#4caf50'], icon:'🌲' },
  { name:'Sunset', colors:['#ff6b6b','#ff9a9e','#fecfef'], icon:'💕' },
  { name:'Royal', colors:['#1a237e','#283593','#3949ab'], icon:'👑' },
  { name:'Warm', colors:['#ff5722','#ff9800','#ffc107'], icon:'🔥' },
  { name:'Ocean', colors:['#006064','#0097a7','#4dd0e1'], icon:'🌊' },
  { name:'Lavender', colors:['#7b1fa2','#9c27b0','#e1bee7'], icon:'💜' },
];

var STICKER_DATA = {
  christmas:'🎄🎅🤶🦌🎁⭐🔔❄️⛄🧦🕯️🎀🍪🌟☃️🧤',
  newyear:'🎆🎇🎉🎊🍾🥂🕛🎈✨💫🌠🎵🎶💥🪅🎯',
  birthday:'🎂🧁🎉🎈🎁🎀🕯️🎵🥳🎊💝🌈🍰👑🎁🎊',
  spring:'🏮🧧🐉🎆🧨🍊🌸🎊🏵️💮🎍🎎🎏🎐🍵🥟',
  nature:'🌸🌺🌻🌹🦋🐦🌿🍀🌙☀️⭐🌈🌊❄️🍂🌵',
  love:'❤️💖💝💕💗💘💞💟🥰😍💋💌💍🌹💐🎀',
  fun:'😊😄😎🤩🐱🐶🐼🦊☕🍕🎸⚽🚀🌟👻🦄',
};

// Templates with Canvas-correct coordinates (x=left, y=top for text; x,y=center for stickers)
var TEMPLATES = [
  { name:'Christmas', icon:'🎄', bgIdx:0, theme:'christmas', objects:[
    {type:'text',text:'Merry Christmas!',x:120,y:40,fontSize:44,font:'Georgia, serif',color:'#ffd700',w:560},
    {type:'sticker',emoji:'🎄',x:80,y:160,size:80},{type:'sticker',emoji:'🎄',x:720,y:160,size:80},
    {type:'text',text:'Wishing you joy and happiness\nthis holiday season',x:140,y:260,fontSize:22,font:'Georgia, serif',color:'#fff',w:520},
    {type:'sticker',emoji:'🎁',x:400,y:430,size:55},
  ]},
  { name:'New Year', icon:'🎆', bgIdx:1, theme:'newyear', objects:[
    {type:'text',text:'Happy New Year!',x:100,y:40,fontSize:46,font:'Georgia, serif',color:'#ffd700',w:600},
    {type:'sticker',emoji:'🎆',x:120,y:160,size:75},{type:'sticker',emoji:'🎆',x:680,y:160,size:65},
    {type:'text',text:'Cheers to new beginnings\nand bright adventures!',x:140,y:260,fontSize:22,font:'Georgia, serif',color:'#fff',w:520},
    {type:'sticker',emoji:'🥂',x:400,y:420,size:50},
  ]},
  { name:'Birthday', icon:'🎂', bgIdx:2, theme:'birthday', objects:[
    {type:'text',text:'Happy Birthday!',x:100,y:35,fontSize:46,font:'Impact, sans-serif',color:'#fff',w:600},
    {type:'sticker',emoji:'🎂',x:400,y:160,size:90},{type:'sticker',emoji:'🎉',x:220,y:180,size:55},{type:'sticker',emoji:'🎉',x:580,y:180,size:55},
    {type:'text',text:'Hope your day is filled\nwith joy and surprises!',x:140,y:280,fontSize:22,font:'Comic Sans MS, cursive',color:'#ffd700',w:520},
    {type:'sticker',emoji:'🎁',x:300,y:430,size:45},{type:'sticker',emoji:'🎈',x:500,y:435,size:40},
  ]},
  { name:'Spring', icon:'🏮', bgIdx:3, theme:'spring', objects:[
    {type:'text',text:'新春快乐',x:100,y:35,fontSize:50,font:'Georgia, serif',color:'#ffd700',w:600},
    {type:'sticker',emoji:'🏮',x:100,y:160,size:75},{type:'sticker',emoji:'🏮',x:700,y:160,size:75},
    {type:'text',text:'Happy Spring Festival!\nWishing you prosperity',x:120,y:260,fontSize:22,font:'Georgia, serif',color:'#fff',w:560},
    {type:'sticker',emoji:'🧧',x:320,y:420,size:55},{type:'sticker',emoji:'🧧',x:480,y:420,size:55},
  ]},
  { name:'Love', icon:'💕', bgIdx:10, theme:'general', objects:[
    {type:'text',text:'I Love You',x:140,y:45,fontSize:48,font:'Georgia, serif',color:'#fff',w:520},
    {type:'sticker',emoji:'❤️',x:400,y:170,size:90},
    {type:'text',text:'You make every day\nbrighter and better',x:140,y:270,fontSize:24,font:'Georgia, serif',color:'#fff',w:520},
    {type:'sticker',emoji:'💖',x:250,y:420,size:45},{type:'sticker',emoji:'💝',x:550,y:420,size:48},
  ]},
  { name:'Thank You', icon:'🙏', bgIdx:7, theme:'general', objects:[
    {type:'text',text:'Thank You!',x:120,y:45,fontSize:48,font:'Georgia, serif',color:'#5d4037',w:560},
    {type:'sticker',emoji:'🌸',x:150,y:170,size:65},{type:'sticker',emoji:'🌸',x:650,y:170,size:65},
    {type:'text',text:'Your kindness means\nthe world to me',x:140,y:260,fontSize:24,font:'Georgia, serif',color:'#4a148c',w:520},
    {type:'sticker',emoji:'💐',x:400,y:420,size:60},
  ]},
  { name:'Get Well', icon:'🌻', bgIdx:4, theme:'general', objects:[
    {type:'text',text:'Get Well Soon!',x:120,y:45,fontSize:44,font:'Georgia, serif',color:'#1a237e',w:560},
    {type:'sticker',emoji:'🌻',x:200,y:170,size:70},{type:'sticker',emoji:'🌷',x:400,y:175,size:60},{type:'sticker',emoji:'🌸',x:600,y:170,size:65},
    {type:'text',text:'Sending warm wishes\nand sunny thoughts your way',x:140,y:270,fontSize:22,font:'Georgia, serif',color:'#283593',w:520},
  ]},
  { name:'Congrats', icon:'🎉', bgIdx:5, theme:'general', objects:[
    {type:'text',text:'Congratulations!',x:100,y:40,fontSize:46,font:'Impact, sans-serif',color:'#fff',w:600},
    {type:'sticker',emoji:'🎉',x:180,y:170,size:70},{type:'sticker',emoji:'🌟',x:400,y:180,size:65},{type:'sticker',emoji:'🎊',x:620,y:170,size:70},
    {type:'text',text:'So proud of all\nyou have achieved!',x:160,y:280,fontSize:24,font:'Georgia, serif',color:'#fff',w:480},
    {type:'sticker',emoji:'👏',x:400,y:420,size:55},
  ]},
];

// ── Init ─────────────────────────────────────────────────────
function initEditor(existingData) {
  canvas = document.getElementById('giftCanvas');
  ctx = canvas.getContext('2d');
  canvas.width = CANVAS_W; canvas.height = CANVAS_H;

  if (existingData && existingData.objects && Array.isArray(existingData.objects)) {
    objects = existingData.objects;
    bgGradient = existingData.bgGradient || null;
    if (!bgGradient) setBgPreset(BG_PRESETS[0]);
  } else {
    applyTemplate(TEMPLATES[0]);
  }

  // Mouse events on canvas
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);
  canvas.addEventListener('dblclick', onDblClick);
  window.addEventListener('keydown', onKeyDown);

  renderBgGrid();
  renderStickers();
  renderTemplates();
  setupToolbar();
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  document.getElementById('editorLoading').style.display = 'none';
  document.getElementById('editorMain').style.display = 'block';
  switchPanel('templates');
  draw();
  saveState();
  toast('Editor ready! Start with a template or design from scratch.');
}

// ── Coordinate Helpers ───────────────────────────────────────
function getCanvasPos(e) {
  var rect = canvas.getBoundingClientRect();
  var mx = (e.clientX - rect.left) * (CANVAS_W / rect.width);
  var my = (e.clientY - rect.top) * (CANVAS_H / rect.height);
  return { mx: mx, my: my };
}

// Get bounding box for selection/drag. x,y = top-left, w,h = size.
function getBounds(o) {
  if (o.type === 'sticker') {
    var s = o.size || 80;
    return { x: o.x - s/2, y: o.y - s/2, w: s, h: s };
  }
  if (o.type === 'text') {
    var lines = (o.text||'').split('\n').length;
    var lh = (o.fontSize||32) * 1.35;
    return { x: o.x, y: o.y, w: o.w||400, h: Math.max(lh, lh * lines) + 8 };
  }
  if (o.type === 'shape') {
    return { x: o.x, y: o.y, w: o.w, h: o.h };
  }
  if (o.type === 'path' && o.points && o.points.length > 0) {
    var minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
    o.points.forEach(function(p){minX=Math.min(minX,p.x);minY=Math.min(minY,p.y);maxX=Math.max(maxX,p.x);maxY=Math.max(maxY,p.y);});
    return {x:minX-2,y:minY-2,w:Math.max(10,maxX-minX+4),h:Math.max(10,maxY-minY+4)};
  }
  return {x:0,y:0,w:100,h:60};
}

// ── Drawing ──────────────────────────────────────────────────
function draw() {
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

  // Background gradient
  if (bgGradient && bgGradient.length >= 2) {
    var grad = ctx.createLinearGradient(0, 0, CANVAS_W, CANVAS_H);
    bgGradient.forEach(function(s){ grad.addColorStop(s.pos, s.color); });
    ctx.fillStyle = grad;
  } else {
    ctx.fillStyle = '#ffffff';
  }
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  // Render each object
  objects.forEach(function(o, i) {
    ctx.save();
    if (o.type === 'sticker') {
      var sz = o.size || 80;
      // White circle background for visibility
      ctx.beginPath();
      ctx.arc(o.x, o.y, sz/2+4, 0, Math.PI*2);
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.fill();
      // Emoji
      ctx.font = sz + 'px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(o.emoji, o.x, o.y);
    } else if (o.type === 'text') {
      var fs = o.fontSize || 32;
      ctx.font = fs + 'px ' + (o.font||'Georgia, serif');
      ctx.fillStyle = o.color||'#000';
      ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      // Word wrap
      var words = (o.text||'').split(' ');
      var line = '', ly = o.y, lh = fs * 1.35, maxW = o.w||400;
      for (var wi = 0; wi < words.length; wi++) {
        var test = line + words[wi] + ' ';
        if (ctx.measureText(test).width > maxW && wi > 0) {
          ctx.fillText(line, o.x, ly); line = words[wi] + ' '; ly += lh;
        } else { line = test; }
      }
      ctx.fillText(line, o.x, ly);
    } else if (o.type === 'shape') {
      ctx.fillStyle = o.fill||'transparent';
      ctx.strokeStyle = o.stroke||'#000';
      ctx.lineWidth = o.strokeW||2;
      ctx.beginPath();
      if (o.shapeType === 'rect') ctx.rect(o.x, o.y, o.w, o.h);
      else if (o.shapeType === 'circle') ctx.ellipse(o.x+o.w/2, o.y+o.h/2, o.w/2, o.h/2, 0, 0, Math.PI*2);
      else if (o.shapeType === 'triangle') { ctx.moveTo(o.x+o.w/2,o.y); ctx.lineTo(o.x+o.w,o.y+o.h); ctx.lineTo(o.x,o.y+o.h); ctx.closePath(); }
      else if (o.shapeType === 'line') { ctx.moveTo(o.x,o.y); ctx.lineTo(o.x+o.w,o.y+o.h); }
      ctx.fill(); ctx.stroke();
    } else if (o.type === 'path' && o.points && o.points.length >= 2) {
      ctx.strokeStyle = o.color||'#000'; ctx.lineWidth = o.width||4;
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(o.points[0].x, o.points[0].y);
      for (var j=1; j<o.points.length; j++) ctx.lineTo(o.points[j].x, o.points[j].y);
      ctx.stroke();
    }
    ctx.restore();

    // Selection highlight
    if (i === selectedIdx) {
      var b = getBounds(o);
      ctx.strokeStyle = '#4ecdc4'; ctx.lineWidth = 2;
      ctx.setLineDash([6,3]);
      ctx.strokeRect(b.x-4, b.y-4, b.w+8, b.h+8);
      ctx.setLineDash([]);
      // Corner handles
      var handles = [[b.x-5,b.y-5],[b.x+b.w-4,b.y-5],[b.x-5,b.y+b.h-4],[b.x+b.w-4,b.y+b.h-4]];
      handles.forEach(function(h){
        ctx.fillStyle='#fff'; ctx.fillRect(h[0],h[1],9,9);
        ctx.strokeStyle='#4ecdc4'; ctx.lineWidth=2; ctx.strokeRect(h[0],h[1],9,9);
      });
    }
  });
}

// ── Hit Testing ─────────────────────────────────────────────
function hitTest(mx, my) {
  for (var i = objects.length-1; i >= 0; i--) {
    var b = getBounds(objects[i]);
    if (rectContains(b.x-6, b.y-6, b.w+12, b.h+12, mx, my)) return i;
  }
  return -1;
}

function getHandle(mx, my, b) {
  var h = 9;
  if (rectContains(b.x-5, b.y-5, h, h, mx, my)) return 'nw';
  if (rectContains(b.x+b.w-4, b.y-5, h, h, mx, my)) return 'ne';
  if (rectContains(b.x-5, b.y+b.h-4, h, h, mx, my)) return 'sw';
  if (rectContains(b.x+b.w-4, b.y+b.h-4, h, h, mx, my)) return 'se';
  return '';
}

// ── Mouse Events ────────────────────────────────────────────
function onMouseDown(e) {
  var pos = getCanvasPos(e);
  if (!pos) return;

  // Sticker placement mode
  if (placementEmoji) {
    addStickerAt(placementEmoji, pos.mx, pos.my);
    placementEmoji = null;
    canvas.style.cursor = currentTool==='draw'?'crosshair':'default';
    document.getElementById('placementHint').style.display = 'none';
    toast('Sticker placed! 🎯');
    return;
  }

  // Drawing mode
  if (currentTool === 'draw') {
    isDrawing = true;
    currentPath = { type:'path', points:[{x:pos.mx,y:pos.my}], color:brushColor, width:brushSize, id:uid() };
    objects.push(currentPath);
    selectedIdx = -1;
    draw();
    return;
  }

  // Check resize handles on selected object
  if (selectedIdx >= 0) {
    var b = getBounds(objects[selectedIdx]);
    var h = getHandle(pos.mx, pos.my, b);
    if (h) {
      isResizing = true; resizeHandle = h;
      resizeStartX = pos.mx; resizeStartY = pos.my;
      resizeOrigX = b.x; resizeOrigY = b.y;
      resizeOrigW = b.w; resizeOrigH = b.h;
      return;
    }
  }

  // Select & drag
  var hit = hitTest(pos.mx, pos.my);
  if (hit >= 0) {
    selectedIdx = hit;
    isDragging = true;
    var ob = objects[hit];
    dragStartX = pos.mx; dragStartY = pos.my;
    dragObjX = ob.x; dragObjY = ob.y;
  } else {
    selectedIdx = -1;
  }
  draw();
  updateTextPanel();
}

function onMouseMove(e) {
  var pos = getCanvasPos(e);
  if (!pos) return;

  // Drawing
  if (isDrawing && currentPath) {
    currentPath.points.push({x:pos.mx, y:pos.my});
    draw();
    return;
  }

  // Resizing
  if (isResizing && selectedIdx >= 0) {
    resizeObject(objects[selectedIdx], pos);
    draw();
    return;
  }

  // Dragging
  if (isDragging && selectedIdx >= 0) {
    var ob = objects[selectedIdx];
    var dx = pos.mx - dragStartX, dy = pos.my - dragStartY;
    if (ob.type === 'sticker') {
      ob.x = clamp(dragObjX + dx, 20, CANVAS_W-20);
      ob.y = clamp(dragObjY + dy, 20, CANVAS_H-20);
    } else if (ob.type === 'text' || ob.type === 'shape') {
      ob.x = dragObjX + dx; ob.y = dragObjY + dy;
    } else if (ob.type === 'path') {
      // Shift all points
      var pdx = pos.mx - dragStartX, pdy = pos.my - dragStartY;
      ob.points.forEach(function(p){ p.x += pdx; p.y += pdy; });
      dragStartX = pos.mx; dragStartY = pos.my;
    }
    draw();
    return;
  }

  // Cursor
  if (currentTool === 'draw') { canvas.style.cursor = 'crosshair'; }
  else if (selectedIdx >= 0 && getHandle(pos.mx, pos.my, getBounds(objects[selectedIdx]))) { canvas.style.cursor = 'nwse-resize'; }
  else if (hitTest(pos.mx, pos.my) >= 0) { canvas.style.cursor = 'move'; }
  else { canvas.style.cursor = 'default'; }
}

function onMouseUp(e) {
  if (isDrawing) { isDrawing = false; currentPath = null; saveState(); }
  if (isDragging) { isDragging = false; saveState(); }
  if (isResizing) { isResizing = false; resizeHandle = ''; saveState(); }
}

function resizeObject(ob, pos) {
  var dx = pos.mx - resizeStartX, dy = pos.my - resizeStartY;
  var b = {x:resizeOrigX, y:resizeOrigY, w:resizeOrigW, h:resizeOrigH};

  if (resizeHandle === 'se') { b.w=Math.max(10,resizeOrigW+dx); b.h=Math.max(10,resizeOrigH+dy); }
  else if (resizeHandle === 'sw') { b.x=resizeOrigX+dx; b.w=Math.max(10,resizeOrigW-dx); b.h=Math.max(10,resizeOrigH+dy); }
  else if (resizeHandle === 'ne') { b.y=resizeOrigY+dy; b.w=Math.max(10,resizeOrigW+dx); b.h=Math.max(10,resizeOrigH-dy); }
  else if (resizeHandle === 'nw') { b.x=resizeOrigX+dx; b.y=resizeOrigY+dy; b.w=Math.max(10,resizeOrigW-dx); b.h=Math.max(10,resizeOrigH-dy); }

  if (ob.type==='sticker') {
    ob.size = Math.max(10, (b.w+b.h)/2);
    ob.x = b.x + b.w/2; ob.y = b.y + b.h/2;
  } else if (ob.type==='text') {
    ob.fontSize = Math.max(10, Math.round(b.h / (((ob.text||'').split('\n').length)*1.35)));
    ob.w = b.w; ob.x = b.x; ob.y = b.y;
  } else if (ob.type==='shape') {
    ob.x = b.x; ob.y = b.y; ob.w = b.w; ob.h = b.h;
  }
}

function onDblClick(e) {
  var pos = getCanvasPos(e);
  var hit = hitTest(pos.mx, pos.my);
  if (hit >= 0 && objects[hit].type === 'text') {
    var nt = prompt('Edit text:', objects[hit].text);
    if (nt !== null && nt.trim()) { objects[hit].text = nt.trim(); draw(); saveState(); }
  }
}

// ── Keyboard ─────────────────────────────────────────────────
function onKeyDown(e) {
  if (document.activeElement.tagName==='INPUT'||document.activeElement.tagName==='TEXTAREA') return;
  if (e.key==='Escape' && placementEmoji) { placementEmoji=null; document.getElementById('placementHint').style.display='none'; canvas.style.cursor='default'; toast('Cancelled.'); return; }
  if (e.key==='Delete'||e.key==='Backspace') { e.preventDefault(); deleteSelected(); }
  if ((e.ctrlKey||e.metaKey)&&e.key==='z') { e.preventDefault(); e.shiftKey?redo():undo(); }
  if ((e.ctrlKey||e.metaKey)&&e.key==='d') { e.preventDefault(); cloneSelected(); }
  if ((e.ctrlKey||e.metaKey)&&e.key==='s') { e.preventDefault(); saveGift(true); }
}

// ── Object Ops ───────────────────────────────────────────────
function deleteSelected() {
  if (selectedIdx<0){ toast('Select an object first.'); return; }
  objects.splice(selectedIdx,1); selectedIdx=-1; draw(); saveState(); toast('Deleted.');
}
function cloneSelected() {
  if (selectedIdx<0){ toast('Select an object first.'); return; }
  var c=JSON.parse(JSON.stringify(objects[selectedIdx])); c.id=uid();
  if (c.type==='sticker'||c.type==='text'){c.x+=20;c.y+=20;}
  objects.push(c); selectedIdx=objects.length-1; draw(); saveState(); toast('Duplicated 📋');
}

// ── Background ───────────────────────────────────────────────
function renderBgGrid() {
  var g=document.getElementById('bgGrid'); if(!g)return; g.innerHTML='';
  BG_PRESETS.forEach(function(bg){
    var d=document.createElement('div'); d.className='bg-option';
    var stops=bg.colors.map(function(c,j,a){return c+' '+Math.round(j/(a.length-1)*100)+'%';}).join(',');
    d.style.background='linear-gradient(135deg,'+stops+')';
    d.innerHTML='<span>'+bg.icon+'</span>'; d.title=bg.name;
    d.addEventListener('click',function(){setBgPreset(bg);});
    g.appendChild(d);
  });
}
function setBgPreset(bg) {
  bgGradient=bg.colors.map(function(c,i){return{color:c,pos:i/(bg.colors.length-1)};});
  draw(); saveState(); toast('Background: '+bg.name);
}
function setSolidBg(color) {
  bgGradient=[{color:color,pos:0},{color:color,pos:1}];
  draw(); saveState();
}

// ── Stickers ─────────────────────────────────────────────────
function renderStickers() {
  var g=document.getElementById('stickerGrid'), cat=document.getElementById('stickerCategory');
  if(!g)return; g.innerHTML='';
  var category=cat?cat.value:'all', chars='';
  if(category==='all') Object.values(STICKER_DATA).forEach(function(s){chars+=s;});
  else chars=STICKER_DATA[category]||'';
  [...chars].forEach(function(em){
    var b=document.createElement('button'); b.className='sticker-btn'; b.textContent=em;
    b.title='Click to enter placement mode'; b.draggable=true;
    b.addEventListener('click',function(){
      placementEmoji=em;
      document.getElementById('placementHint').style.display='block';
      canvas.style.cursor='crosshair';
      toast('🎯 Click on canvas to place this sticker (Esc to cancel)');
    });
    b.addEventListener('dragstart',function(e){e.preventDefault();});
    g.appendChild(b);
  });
}
function addStickerAt(emoji, x, y) {
  x=clamp(x,30,CANVAS_W-30); y=clamp(y,30,CANVAS_H-30);
  var obj={type:'sticker',emoji:emoji,x:x,y:y,size:80,id:uid()};
  objects.push(obj); selectedIdx=objects.length-1;
  draw(); saveState();
}

// ── Text ─────────────────────────────────────────────────────
function addText() {
  var obj={type:'text',text:'Double-click to edit',x:200,y:CANVAS_H/2-40,fontSize:36,font:'Georgia, serif',color:'#c41e3a',w:400,id:uid()};
  objects.push(obj); selectedIdx=objects.length-1;
  draw(); saveState(); toast('Text added! Double-click to edit.');
}
function updateTextPanel() {
  var s=document.getElementById('textStyleSection'); if(!s)return;
  if(selectedIdx>=0&&objects[selectedIdx].type==='text'){
    s.style.display='block'; var o=objects[selectedIdx];
    document.getElementById('textColor').value=o.color||'#c41e3a';
    document.getElementById('fontSize').value=o.fontSize||36;
    document.getElementById('fontSizeVal').textContent=o.fontSize||36;
    document.getElementById('fontFamily').value=o.font||'Georgia, serif';
  }else{s.style.display='none';}
}
function updateSelectedTextStyle() {
  if(selectedIdx<0||objects[selectedIdx].type!=='text')return;
  var o=objects[selectedIdx];
  o.color=document.getElementById('textColor').value;
  o.fontSize=parseInt(document.getElementById('fontSize').value);
  o.font=document.getElementById('fontFamily').value;
  draw(); saveState();
}

// ── Shapes ───────────────────────────────────────────────────
function addShape(st) {
  var f=document.getElementById('shapeFill').value, sr=document.getElementById('shapeStroke').value;
  var sw=parseInt(document.getElementById('shapeStrokeWidth').value);
  var obj={type:'shape',shapeType:st,x:280,y:160,w:160,h:120,fill:f,stroke:sr,strokeW:sw,id:uid()};
  if(st==='circle'){obj.w=120;obj.h=120;obj.x=300;}
  if(st==='triangle'){obj.w=120;obj.h=100;obj.x=300;}
  if(st==='line'){obj.w=200;obj.h=4;obj.y=220;}
  objects.push(obj); selectedIdx=objects.length-1; draw(); saveState(); toast('Shape added.');
}

// ── Drawing ──────────────────────────────────────────────────
function clearDrawing() {
  var before=objects.length;
  objects=objects.filter(function(o){return o.type!=='path';});
  if(objects.length<before){selectedIdx=-1;draw();saveState();toast('Drawings cleared.');}
  else{toast('Nothing to clear.');}
}

// ── Templates ────────────────────────────────────────────────
function renderTemplates() {
  var g=document.getElementById('templateGrid'); if(!g)return; g.innerHTML='';
  TEMPLATES.forEach(function(tmpl){
    var c=document.createElement('div'); c.className='template-card';
    var stops=BG_PRESETS[tmpl.bgIdx].colors.map(function(cl,j,a){return cl+' '+Math.round(j/(a.length-1)*100)+'%';}).join(',');
    c.style.background='linear-gradient(135deg,'+stops+')';
    c.innerHTML='<span class="t-icon">'+tmpl.icon+'</span><span class="t-label">'+tmpl.name+'</span>';
    c.addEventListener('click',function(){applyTemplate(tmpl);});
    g.appendChild(c);
  });
}
function applyTemplate(tmpl) {
  if(objects.length>0&&!confirm('Apply this template? It replaces your current design.'))return;
  objects=JSON.parse(JSON.stringify(tmpl.objects));
  objects.forEach(function(o){o.id=uid();});
  setBgPreset(BG_PRESETS[tmpl.bgIdx]);
  document.getElementById('giftTheme').value=tmpl.theme||'general';
  selectedIdx=-1; draw(); saveState();
  switchPanel('elements');
  toast('Template applied! ✨ Customize it freely.');
}

// ── Clear ────────────────────────────────────────────────────
function clearCanvas() {
  if(!confirm('Remove everything?'))return;
  objects=[]; selectedIdx=-1; bgGradient=null; setBgPreset(BG_PRESETS[0]);
  draw(); saveState(); toast('Cleared.');
}

// ── Undo/Redo ────────────────────────────────────────────────
function saveState() {
  var s=JSON.stringify({objects:objects,bgGradient:bgGradient});
  if(undoStack.length&&undoStack[undoStack.length-1]===s)return;
  undoStack.push(s); redoStack=[];
  if(undoStack.length>50)undoStack.shift();
}
function undo() {
  if(undoStack.length<=1)return;
  redoStack.push(undoStack.pop());
  loadSnapshot(undoStack[undoStack.length-1]); toast('Undo ↩');
}
function redo() {
  if(!redoStack.length)return;
  var s=redoStack.pop(); undoStack.push(s);
  loadSnapshot(s); toast('Redo ↪');
}
function loadSnapshot(json) {
  var d=JSON.parse(json); objects=d.objects; bgGradient=d.bgGradient; selectedIdx=-1; draw();
}

// ── Preview & Save ───────────────────────────────────────────
function previewGift() {
  draw();
  var url=canvas.toDataURL('image/png');
  var w=window.open('','_blank','width=840,height=560');
  w.document.write('<!DOCTYPE html><html><head><title>Preview</title><style>body{margin:0;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#0a0a1a}img{max-width:100%;box-shadow:0 8px 40px rgba(0,0,0,0.6);border-radius:8px}</style></head><body><img src="'+url+'"></body></html>');
}

function saveGift(isDraft) {
  var title=document.getElementById('giftTitle').value.trim();
  if(!title){toast('Please add a title.','error');return;}
  var theme=document.getElementById('giftTheme').value;
  draw();
  var data=JSON.stringify({objects:objects,bgGradient:bgGradient});
  // Low-res thumbnail to keep payload small
  var thumb = '';
  try { thumb = canvas.toDataURL('image/jpeg', 0.15); } catch(e) {}
  var url=giftId?'/gifts/'+giftId+'/edit':'/gifts/create';
  fetch(url,{
    method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},
    body:JSON.stringify({title:title,theme:theme,canvas_json:data,thumbnail:thumb,action:isDraft?'save_draft':'finalize'})
  }).then(function(r){
    if(!r.ok) throw new Error('Server error ('+r.status+')');
    return r.json();
  }).then(function(d){
    if(d.success){if(!giftId&&d.id){giftId=d.id;window._giftId=d.id;}toast(isDraft?'💾 Draft saved!':'✅ Saved!');}
    else{toast(d.error||'Save failed','error');}
  }).catch(function(e){toast(e.message||'Save failed - check server','error');});
}

// ── Send Modal ───────────────────────────────────────────────
function showSendModal() {
  if(!document.getElementById('giftTitle').value.trim()){toast('Add a title first.','error');return;}
  document.getElementById('sendModal').classList.add('open');
}
function closeSendModal() {
  document.getElementById('sendModal').classList.remove('open');
  selectedRecipientId=null;
  document.getElementById('recipientSearch').value='';
  document.getElementById('searchResults').classList.remove('open');
  document.getElementById('searchResults').innerHTML='';
  document.getElementById('sendBtn').disabled=true;
}
var searchTimer;
function searchUsers() {
  clearTimeout(searchTimer);
  var q=document.getElementById('recipientSearch').value.trim();
  if(!q){document.getElementById('searchResults').classList.remove('open');selectedRecipientId=null;document.getElementById('sendBtn').disabled=true;return;}
  searchTimer=setTimeout(function(){
    fetch('/users/search?q='+encodeURIComponent(q)).then(function(r){return r.json();}).then(function(users){
      var c=document.getElementById('searchResults');c.innerHTML='';
      if(!users.length){c.innerHTML='<div class="search-result-item" style="color:var(--text-muted)">No users found</div>';}
      else{users.forEach(function(u){
        var d=document.createElement('div');d.className='search-result-item';
        d.innerHTML='<div class="result-avatar">'+(u.display_name||u.username).charAt(0).toUpperCase()+'</div><div class="result-info"><div class="result-name">'+(u.display_name||u.username)+'</div><div class="result-username">@'+u.username+'</div></div>';
        d.addEventListener('click',function(){document.getElementById('recipientSearch').value=u.display_name||u.username;selectedRecipientId=u.id;c.classList.remove('open');document.getElementById('sendBtn').disabled=false;});
        c.appendChild(d);
      });}
      c.classList.add('open');
    });
  },300);
}
document.addEventListener('click',function(e){if(!e.target.closest('#recipientSearch')&&!e.target.closest('#searchResults')){var s=document.getElementById('searchResults');if(s)s.classList.remove('open');}});
async function sendGift(){
  if(!selectedRecipientId){toast('Select a recipient.','error');return;}
  var title=document.getElementById('giftTitle').value.trim(),theme=document.getElementById('giftTheme').value,msg=document.getElementById('giftMessage').value.trim();
  draw();
  var data=JSON.stringify({objects:objects,bgGradient:bgGradient});
  var thumb=''; try{thumb=canvas.toDataURL('image/jpeg',0.15);}catch(e){}
  var btn=document.getElementById('sendBtn');btn.disabled=true;btn.textContent='Sending...';
  try{
    var saveUrl=giftId?'/gifts/'+giftId+'/edit':'/gifts/create';
    var body=JSON.stringify({title:title,theme:theme,canvas_json:data,thumbnail:thumb,action:'finalize'});
    var r1=await fetch(saveUrl,{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:body});
    if(!r1.ok)throw new Error('Server error ('+r1.status+')');
    var d1=await r1.json();if(!d1.success)throw new Error(d1.error||'Save failed');
    var r2=await fetch('/gifts/'+(d1.id||giftId)+'/send',{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({recipient_id:selectedRecipientId,message:msg})});
    if(!r2.ok)throw new Error('Server error ('+r2.status+')');
    var d2=await r2.json();if(d2.success)window.location.href='/gifts/sent?success=Gift sent! 🎉';else throw new Error(d2.error||'Send failed');
  }catch(e){toast('Error: '+e.message,'error');btn.disabled=false;btn.textContent='🎁 Send';}
}

// ── Toolbar & UI ─────────────────────────────────────────────
function setupToolbar() {
  document.querySelectorAll('.tool-btn').forEach(function(btn){
    btn.addEventListener('click',function(){
      document.querySelectorAll('.tool-btn').forEach(function(b){b.classList.remove('active');});
      btn.classList.add('active');
      switchPanel(btn.dataset.panel);
    });
  });
}
function switchPanel(panel) {
  currentTool = panel;
  if(placementEmoji){placementEmoji=null;document.getElementById('placementHint').style.display='none';}
  canvas.style.cursor = panel==='draw'?'crosshair':'default';
  document.querySelectorAll('.editor-panel').forEach(function(p){p.classList.remove('open');});
  var el=document.getElementById('panel-'+panel); if(el)el.classList.add('open');
  var di=document.getElementById('drawModeIndicator'); if(di)di.style.display=panel==='draw'?'block':'none';
}
function resizeCanvas() {
  var area=document.getElementById('canvasArea'); if(!area)return;
  var s=Math.min(1,(area.clientWidth-40)/CANVAS_W,(area.clientHeight-40)/CANVAS_H);
  canvas.style.width=Math.floor(CANVAS_W*s)+'px';
  canvas.style.height=Math.floor(CANVAS_H*s)+'px';
}

// ── Toast ────────────────────────────────────────────────────
function toast(msg,type){
  type=type||'info';
  var c=document.getElementById('toastContainer'); if(!c)return;
  var el=document.createElement('div');
  el.style.cssText='background:'+(type==='error'?'#f44336':'#2e7d32')+';color:white;padding:0.6rem 1rem;border-radius:8px;margin-bottom:0.5rem;font-size:0.85rem;font-weight:600;box-shadow:0 4px 12px rgba(0,0,0,0.3);animation:slideIn 0.3s ease;';
  el.textContent=msg; c.appendChild(el);
  setTimeout(function(){el.style.opacity='0';el.style.transform='translateX(100%)';el.style.transition='all 0.3s';setTimeout(function(){if(el.parentNode)el.parentNode.removeChild(el);},300);},2500);
}
