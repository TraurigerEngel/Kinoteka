'use strict';
// Test data only. All names are fictional and prefixed TEST ONLY.
// Deterministic, dependency-free ZIP for scripts/test-synthetic-fixture.js.
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const films = Array.from({length:15}, (_, i) => ({
  name: `TEST ONLY - Fictional Film ${String(i+1).padStart(2,'0')}`,
  year: 2000+i
}));
const quoted = value => `"${String(value).replaceAll('"','""')}"`;
const csv = (headers, rows) => [headers.map(quoted).join(','), ...rows.map(row=>row.map(quoted).join(','))].join('\r\n')+'\r\n';
const watched=films.slice(0,11), watchlist=films.slice(11);
const pairs=items=>items.map(x=>[x.name,x.year]);
const review='Synthetic, fake review.\nSecond line with a comma, "quotes".';
const files=[
 ['account/watched.csv',csv(['Name','Year'],pairs(watched))],
 ['account/watchlist.csv',csv(['Name','Year'],pairs(watchlist))],
 ['account/ratings.csv',csv(['Name','Year','Rating'],watched.map((x,i)=>[x.name,x.year,i===0?5:4]))],
 ['account/diary.csv',csv(['Date','Name','Year','Rating','Rewatch','Watched Date'],[
   ['2026-01-01',films[0].name,films[0].year,5,'False','2026-01-01'],
   ['2026-03-01',films[0].name,films[0].year,5,'True','2026-03-01'],
   ['2026-01-02',films[1].name,films[1].year,4,'False','2026-01-02']
 ])],
 ['account/reviews.csv',csv(['Date','Name','Year','Rating','Review'],[
   ['2026-03-01',films[0].name,films[0].year,5,review],
   ['2026-01-02',films[1].name,films[1].year,4,'Completely invented review for test.']
 ])],
 ['account/lists/test-list.csv','Letterboxd list export v7\r\n'+
   csv(['Date','Name','Tags','URL','Description'],[['2026-10-19','ТЕСТОВЫЙ список (вымышленные фильмы)','','','Только синтетические записи']])+'\r\n'+
   csv(['Position','Name','Year'],films.slice(0,6).map((x,i)=>[i+1,x.name,x.year]))]
];
function crc32(buf){let c=0xffffffff;for(const b of buf){c^=b;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0);}return (c^0xffffffff)>>>0;}
function makeZip(entries){
  const local=[],central=[];let offset=0;
  for(const [name,content] of entries){
    const nameBytes=Buffer.from(name,'utf8'),original=Buffer.from(content,'utf8'),compressed=zlib.deflateRawSync(original,{level:9});
    const crc=crc32(original);
    const h=Buffer.alloc(30);h.writeUInt32LE(0x04034b50,0);h.writeUInt16LE(20,4);h.writeUInt16LE(0x800,6);
    h.writeUInt16LE(8,8);h.writeUInt32LE(crc,14);h.writeUInt32LE(compressed.length,18);
    h.writeUInt32LE(original.length,22);h.writeUInt16LE(nameBytes.length,26);
    local.push(h,nameBytes,compressed);
    const c=Buffer.alloc(46);c.writeUInt32LE(0x02014b50,0);c.writeUInt16LE(20,4);c.writeUInt16LE(20,6);
    c.writeUInt16LE(0x800,8);c.writeUInt16LE(8,10);c.writeUInt32LE(crc,16);
    c.writeUInt32LE(compressed.length,20);c.writeUInt32LE(original.length,24);
    c.writeUInt16LE(nameBytes.length,28);c.writeUInt32LE(offset,42);
    central.push(c,nameBytes);offset+=h.length+nameBytes.length+compressed.length;
  }
  const dir=Buffer.concat(central),end=Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50,0);end.writeUInt16LE(entries.length,8);end.writeUInt16LE(entries.length,10);
  end.writeUInt32LE(dir.length,12);end.writeUInt32LE(offset,16);
  return Buffer.concat([...local,dir,end]);
}
const out=path.join(__dirname,'..','test-data','Letterboxd_SYNTHETIC_15_TEST_ONLY.zip');
fs.mkdirSync(path.dirname(out),{recursive:true});
fs.writeFileSync(out,makeZip(files));
console.log('Generated test-only Letterboxd fixture:',path.relative(path.join(__dirname,'..'),out));
