/* Kinoteka v1.2 Preview: portable, dependency-free Letterboxd export parser.
 * This module performs no persistence and makes no network requests. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object' && module.exports)module.exports=api;
  if(root)root.KinotekaImportCore=api;
})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';
  const MAX_ARCHIVE=40*1024*1024, MAX_FILE=20*1024*1024, MAX_TOTAL=80*1024*1024, MAX_ENTRIES=500;
  const decoder=new TextDecoder('utf-8');
  const fail=message=>{throw new Error(message);};
  const clean=value=>String(value??'').replace(/\uFEFF/g,'').replace(/[\u00A0\u2007\u202F]/g,' ').replace(/[‘’`]/g,"'").replace(/\s+/g,' ').trim();
  const norm=value=>clean(value).toLocaleLowerCase('ru');
  function key(name,year){return `${norm(name)}\u0000${year??''}`;}
  function itemKey(name,year,category='Фильмы'){return `${norm(category)}\u0000${norm(name)}\u0000${year??''}`;}
  const date=value=>/^\d{4}-\d{2}-\d{2}$/.test(clean(value))?clean(value):'';
  const year=value=>{const n=Number(clean(value));return Number.isInteger(n)&&n>=1870&&n<=2100?n:null;};
  // Letterboxd lists v7 are not a single CSV table: they contain a version
  // banner, a metadata table, a blank line, then a Position/Name/Year table.
  // Keep the low-level RFC4180 row parser shared with ordinary export CSVs.
  function rawCsvRows(text){
    const rows=[];let row=[],cell='',inQuotes=false,started=false;
    const value=String(text).replace(/^\uFEFF/,'');
    for(let i=0;i<value.length;i++){
      const c=value[i];
      if(inQuotes){
        if(c==='"'&&value[i+1]==='"'){cell+='"';i++;}
        else if(c==='"')inQuotes=false;
        else cell+=c;
      } else if(c==='"'&&!cell){inQuotes=true;started=true;}
      else if(c===','){row.push(cell);cell='';started=true;}
      else if(c==='\n'||c==='\r'){
        if(c==='\r'&&value[i+1]==='\n')i++;
        row.push(cell);if(started||row.some(x=>x.trim()))rows.push(row);
        row=[];cell='';started=false;
      } else {cell+=c;started=true;}
    }
    if(inQuotes)fail('Ошибка CSV: незакрытая кавычка.');
    if(started||row.length){row.push(cell);rows.push(row);}
    return rows;
  }
  const headerNames=row=>row.map(s=>norm(s).replace(/[\s_\-]/g,''));
  function objectRow(headers,row){
    const obj={};headers.forEach((header,index)=>{if(header)obj[header]=row[index]??'';});return obj;
  }
  function csvRows(text){
    const rows=rawCsvRows(text);
    if(!rows.length)return [];
    const headers=headerNames(rows.shift());
    if(!headers.some(h=>['name','title','year','letterboxduri'].includes(h)))return [];
    return rows.filter(r=>r.some(v=>v.trim())).map(row=>objectRow(headers,row));
  }
  function listCsv(text){
    const rows=rawCsvRows(text);
    const filmsHeader=rows.findIndex(row=>{
      const h=headerNames(row);
      return h.includes('position')&&h.includes('name')&&h.includes('year');
    });
    if(filmsHeader<0)return {rows:csvRows(text),meta:{}}; // Legacy one-table lists.
    const headers=headerNames(rows[filmsHeader]);
    const films=rows.slice(filmsHeader+1).filter(row=>row.some(v=>v.trim()))
      .map(row=>objectRow(headers,row));
    const infoHeader=rows.slice(0,filmsHeader).findIndex(row=>{
      const h=headerNames(row);
      return h.includes('date')&&h.includes('name')&&h.includes('url');
    });
    const meta={};
    if(infoHeader>=0&&infoHeader+1<filmsHeader){
      const values=objectRow(headerNames(rows[infoHeader]),rows[infoHeader+1]);
      if(clean(values.name))meta.name=clean(values.name);
      if(date(values.date))meta.createdAt=date(values.date);
      if(clean(values.tags))meta.tags=clean(values.tags);
      if(clean(values.description))meta.description=clean(values.description);
      if(/^https:\/\/(?:boxd\.it|letterboxd\.com)\//i.test(clean(values.url)))meta.url=clean(values.url);
    }
    return {rows:films,meta};
  }
  function crc32(buffer){
    let crc=0xffffffff;
    for(const b of buffer){crc^=b;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}
    return (crc^0xffffffff)>>>0;
  }
  async function unzipCsv(bytes){
    if(bytes.byteLength>MAX_ARCHIVE)fail('ZIP больше 40 МБ. Выбери меньший архив.');
    const u=bytes instanceof Uint8Array?bytes:new Uint8Array(bytes),v=new DataView(u.buffer,u.byteOffset,u.byteLength);
    const u16=p=>v.getUint16(p,true),u32=p=>v.getUint32(p,true);
    let eocd=-1;
    for(let i=u.length-22;i>=Math.max(0,u.length-65557);i--)if(u32(i)===0x06054b50&&i+22+u16(i+20)===u.length){eocd=i;break;}
    if(eocd<0)fail('Некорректный ZIP: не найден центральный каталог.');
    const n=u16(eocd+10),catalogBytes=u32(eocd+12),catalogOffset=u32(eocd+16);
    if(n!==u16(eocd+8)||u16(eocd+4)||u16(eocd+6)||n>MAX_ENTRIES||n===65535)fail('ZIP содержит слишком много файлов или неподдерживаемый формат.');
    if(catalogOffset+catalogBytes>eocd)fail('Повреждён центральный каталог ZIP.');
    const found=[],seen=new Set();let pos=catalogOffset,total=0;
    for(let index=0;index<n;index++){
      if(pos+46>u.length||u32(pos)!==0x02014b50)fail('Повреждена запись ZIP.');
      const method=u16(pos+10),flags=u16(pos+8),checksum=u32(pos+16),compressed=u32(pos+20),original=u32(pos+24);
      const fnLength=u16(pos+28),extra=u16(pos+30),comment=u16(pos+32),offset=u32(pos+42);
      if(pos+46+fnLength+extra+comment>u.length)fail('Повреждено имя файла ZIP.');
      const filename=decoder.decode(u.subarray(pos+46,pos+46+fnLength)).replace(/\\/g,'/');
      pos+=46+fnLength+extra+comment;
      if(filename.startsWith('/')||filename.split('/').includes('..'))fail('ZIP содержит недопустимый путь.');
      const parts=filename.toLowerCase().split('/').filter(Boolean);
      const leaf=parts.at(-1)||'';
      // Root deleted/orphaned exports must not silently resurrect deleted films.
      const excluded=parts.slice(0,-1).some(part=>['deleted','orphaned','likes'].includes(part));
      const isList=!excluded&&parts.includes('lists')&&leaf.endsWith('.csv');
      const isCore=!excluded&&parts.length<=2&&['watched.csv','watchlist.csv','ratings.csv','diary.csv','reviews.csv'].includes(leaf);
      if(!isList&&!isCore)continue;
      if(seen.has(filename.toLowerCase()))fail(`Дублирующийся файл в ZIP: ${filename}`);
      seen.add(filename.toLowerCase());
      total+=original;
      if(original>MAX_FILE||total>MAX_TOTAL||compressed>MAX_ARCHIVE)fail('ZIP содержит слишком большие CSV-файлы.');
      if(flags&1||![0,8].includes(method)||original===0xffffffff||compressed===0xffffffff)fail('Файл ZIP зашифрован или имеет неподдерживаемое сжатие.');
      if(offset+30>u.length||u32(offset)!==0x04034b50)fail('Повреждена локальная запись ZIP.');
      const start=offset+30+u16(offset+26)+u16(offset+28);
      if(start+compressed>u.length)fail('Данные файла ZIP обрезаны.');
      let output;
      if(method===0)output=u.slice(start,start+compressed);
      else{
        if(typeof DecompressionStream!=='function')fail('WebView2 не поддерживает распаковку ZIP. Обнови WebView2 или выбери CSV отдельно.');
        const stream=new Blob([u.slice(start,start+compressed)]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
        const reader=stream.getReader(),chunks=[];let length=0;
        try{
          for(;;){const {value,done}=await reader.read();if(done)break;length+=value.length;
            if(length>MAX_FILE||length>original){await reader.cancel();fail('Размер распакованного CSV превышает объявленный в ZIP.');}
            chunks.push(value);
          }
        }finally{reader.releaseLock();}
        output=new Uint8Array(length);let at=0;for(const chunk of chunks){output.set(chunk,at);at+=chunk.length;}
      }
      if(output.length!==original||crc32(output)!==checksum)fail(`Контрольная сумма не совпала: ${filename}`);
      const content=decoder.decode(output);
      const parsed=isList?listCsv(content):{rows:csvRows(content),meta:{}};
      found.push({name:filename,rows:parsed.rows,isList,listMeta:parsed.meta});
    }
    if(!found.length)fail('Не найдено CSV Letterboxd (watched, ratings, diary, reviews, watchlist или lists).');
    return found;
  }
  function fromFiles(files){
    const map=new Map(),lists=[],tally={files:files.length,watched:0,watchlist:0,ratings:0,diary:0,reviews:0,lists:0,skipped:0};
    function entryFor(row){
      const name=clean(row.name||row.title),y=year(row.year);
      if(!name||name.length>400){tally.skipped++;return null;}
      const id=key(name,y);
      if(!map.has(id))map.set(id,{name,year:y,uri:'',watched:false,watchlist:false,rating:null,diary:[],reviews:[],tags:[],lists:[]});
      const entry=map.get(id),uri=clean(row.letterboxduri||row.url||row.uri);
      if(/^https:\/\/letterboxd\.com\//i.test(uri))entry.uri=uri;
      return entry;
    }
    const processed=files.filter(f=>!f.isList).sort((a,b)=>{
      const order=['watched.csv','watchlist.csv','ratings.csv','diary.csv','reviews.csv'];
      return order.indexOf(a.name.toLowerCase().split('/').at(-1))-order.indexOf(b.name.toLowerCase().split('/').at(-1));
    });
    for(const file of processed){
      const type=file.name.toLowerCase().split('/').at(-1).replace('.csv','');
      for(const row of file.rows){
        const e=entryFor(row);if(!e)continue;
        tally[type]++;
        if(type==='watched')e.watched=true;
        if(type==='watchlist')e.watchlist=true;
        if(type==='ratings'||type==='diary'||type==='reviews'){
          const rating=Number(String(row.rating??'').replace(',','.'));
          if(clean(row.rating)!==''&&Number.isFinite(rating)&&rating>=0.5&&rating<=5&&Math.round(rating*2)===rating*2)e.rating=rating;
        }
        if(type==='diary'||type==='reviews'){
          e.watched=true;
          const obj={date:date(row.watcheddate||row.date),loggedAt:date(row.date),rewatch:/^(true|yes|1)$/i.test(clean(row.rewatch)),tags:clean(row.tags),rating:clean(row.rating)?Number(row.rating):null};
          if(type==='reviews'){
            obj.review=String(row.review||'').slice(0,100000);
            if(obj.review&&!e.reviews.some(r=>JSON.stringify(r)===JSON.stringify(obj)))e.reviews.push(obj);
          }else if(!e.diary.some(r=>JSON.stringify(r)===JSON.stringify(obj)))e.diary.push(obj);
          if(obj.tags)for(const tag of obj.tags.split(',').map(clean).filter(Boolean))if(!e.tags.includes(tag))e.tags.push(tag);
        }
      }
    }
    for(const file of files.filter(f=>f.isList)){
      const filename=file.name.split('/').at(-1).replace(/\.csv$/i,'');
      const name=clean(file.listMeta?.name||filename.replace(/[-_]/g,' '))||'Без названия';
      const ids=[];
      for(const row of file.rows){const e=entryFor(row);if(!e)continue;const id=key(e.name,e.year);if(!ids.includes(id))ids.push(id);if(!e.lists.includes(filename))e.lists.push(filename);}
      if(ids.length||file.listMeta?.name){
        lists.push({name,slug:filename,films:ids,
          ...(file.listMeta?.createdAt?{createdAt:file.listMeta.createdAt}:{}),
          ...(file.listMeta?.description?{description:file.listMeta.description}:{}),
          ...(file.listMeta?.tags?{tags:file.listMeta.tags}:{}),
          ...(file.listMeta?.url?{url:file.listMeta.url}:{})});
        tally.lists++;
      }
    }
    if(!map.size)fail('CSV не содержат фильмов, пригодных для импорта.');
    return {entries:[...map.values()],lists,stats:tally};
  }
  async function parseFile(file){
    if(!file||file.size>MAX_ARCHIVE)fail('Выбери ZIP Letterboxd или CSV размером до 40 МБ.');
    const name=file.name?.toLowerCase()||'',bytes=new Uint8Array(await file.arrayBuffer());
    if(name.endsWith('.zip'))return fromFiles(await unzipCsv(bytes));
    if(name.endsWith('.csv')){
      const leaf=name.split(/[/\\]/).at(-1);
      if(!['watched.csv','ratings.csv','diary.csv','reviews.csv','watchlist.csv'].includes(leaf))fail('Одиночный CSV должен называться watched, ratings, diary, reviews или watchlist.csv.');
      return fromFiles([{name:leaf,rows:csvRows(decoder.decode(bytes)),isList:false}]);
    }
    fail('Поддерживаются только ZIP экспорта Letterboxd и отдельные CSV.');
  }
  return {parseFile,fromFiles,csvRows,key,itemKey,norm};
});
