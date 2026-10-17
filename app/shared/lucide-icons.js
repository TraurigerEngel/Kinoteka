/*
 * Local Lucide icon subset used by Kinoteka.
 * SVG paths follow the Lucide icon set; rendering is intentionally kept local
 * so the app does not require a runtime CDN dependency.
 */
(() => {
  const icons = {
    plus: [['path', {d:'M5 12h14'}],['path',{d:'M12 5v14'}]],
    upload: [['path',{d:'M12 3v12'}],['path',{d:'m17 8-5-5-5 5'}],['path',{d:'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4'}]],
    download: [['path',{d:'M12 3v12'}],['path',{d:'m17 10-5 5-5-5'}],['path',{d:'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4'}]],
    x: [['path',{d:'M18 6 6 18'}],['path',{d:'m6 6 12 12'}]],
    'rotate-ccw': [['path',{d:'M3 12a9 9 0 1 0 3-6.7L3 8'}],['path',{d:'M3 3v5h5'}]],
    'arrow-right': [['path',{d:'M5 12h14'}],['path',{d:'m12 5 7 7-7 7'}]],
    'triangle-alert': [['path',{d:'m21.73 18-8-14a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3'}],['path',{d:'M12 9v4'}],['path',{d:'M12 17h.01'}]],
    check: [['path',{d:'m9 12 2 2 4-4'}],['path',{d:'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z'}]],
    'loader-circle': [['path',{d:'M21 12a9 9 0 1 1-6.219-8.56'}]],
    gamepad: [['line',{x1:'6',x2:'10',y1:'11',y2:'11'}],['line',{x1:'8',x2:'8',y1:'9',y2:'13'}],['line',{x1:'15',x2:'15.01',y1:'12',y2:'12'}],['line',{x1:'18',x2:'18.01',y1:'10',y2:'10'}],['path',{d:'M17.5 6.5 16 4H8L6.5 6.5A7.5 7.5 0 0 0 3 13v1.5a3 3 0 0 0 5.2 2.1L10 15h4l1.8 1.6a3 3 0 0 0 5.2-2.1V13a7.5 7.5 0 0 0-3.5-6.5Z'}]],
    heart: [['path',{d:'M20.8 4.6c-2.2-2.4-6-2.2-8.3.3L12 5.5l-.5-.6C9.2 2.4 5.4 2.2 3.2 4.6.9 7.1 1.1 11 3.4 13.4L12 22l8.6-8.6c2.3-2.5 2.5-6.3.2-8.8Z'}]],
    'circle-minus': [['circle',{cx:'12',cy:'12',r:'10'}],['path',{d:'M8 12h8'}]],
    'heart-crack': [['path',{d:'M18.5 4.5C16.8 2.8 14 2.4 12 4.1 10 2.4 7.2 2.8 5.5 4.5 2.2 7.8 4.7 12.7 6 14l6 7 6-7c1.3-1.3 3.8-6.2.5-9.5Z'}],['path',{d:'m12 8-1.5 3h3L12 14'}]],
    'calendar-plus': [['path',{d:'M8 2v4'}],['path',{d:'M16 2v4'}],['rect',{width:'18',height:'18',x:'3',y:'4',rx:'2'}],['path',{d:'M3 10h18'}],['path',{d:'M12 14v4'}],['path',{d:'M10 16h4'}]],
    'chevron-left': [['path',{d:'m15 18-6-6 6-6'}]],
    'chevron-right': [['path',{d:'m9 18 6-6-6-6'}]],
    'chevrons-left': [['path',{d:'m11 17-5-5 5-5'}],['path',{d:'m18 17-5-5 5-5'}]],
    'chevrons-right': [['path',{d:'m13 17 5-5-5-5'}],['path',{d:'m6 17 5-5-5-5'}]],
    star: [['path',{d:'M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.1 2.1 0 0 0 1.58 1.148l5.166.752a.53.53 0 0 1 .294.904l-3.738 3.644a2.1 2.1 0 0 0-.605 1.86l.882 5.143a.53.53 0 0 1-.769.56l-4.618-2.428a2.1 2.1 0 0 0-1.956 0l-4.618 2.428a.53.53 0 0 1-.769-.56l.882-5.143a2.1 2.1 0 0 0-.605-1.86L2.2 9.778a.53.53 0 0 1 .294-.904l5.166-.752a2.1 2.1 0 0 0 1.58-1.148z'}]],
    pencil: [['path',{d:'M21.174 6.812a1 1 0 0 0-3.986-3.986L3.842 16.17a2 2 0 0 0-.5.83l-1.02 4.08a.5.5 0 0 0 .606.606l4.08-1.02a2 2 0 0 0 .83-.5z'}],['path',{d:'m15 5 4 4'}]]
  };

  function esc(value) {
    return String(value).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  window.lucideSvg = function(name, options = {}) {
    const nodes = icons[name];
    if (!nodes) return '';
    const size = Number(options.size || 18);
    const strokeWidth = Number(options.strokeWidth || 2);
    const cls = options.className ? ` lucide-icon ${esc(options.className)}` : ' lucide-icon';
    const attrs = `class="lucide lucide-${esc(name)}${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"`; 
    const children = nodes.map(([tag, attrsObj]) => `<${tag} ${Object.entries(attrsObj).map(([k,v]) => `${k}="${esc(v)}"`).join(' ')}></${tag}>`).join('');
    return `<svg ${attrs}>${children}</svg>`;
  };
})();
