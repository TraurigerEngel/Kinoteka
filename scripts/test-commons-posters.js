'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');const path=require('node:path');const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const api=require('../app/shared/commons-posters.js');
const meta={LicenseShortName:{value:'CC BY 4.0'},LicenseUrl:{value:'https://creativecommons.org/licenses/by/4.0/'},Artist:{value:'<b>Example creator</b>'}};
assert.ok(api.allowLicense(meta));
assert.equal(api.allowLicense({...meta,LicenseShortName:{value:'CC BY-NC 4.0'}}),false);
assert.equal(api.allowLicense({...meta,LicenseUrl:{value:'https://evil.test/fake'}}),false);
assert.equal(api.fileTitle('https://evil.test/wiki/Special:FilePath/Image.jpg'),null);
assert.equal(api.fileTitle('https://commons.wikimedia.org/wiki/Special:FilePath/Example_cover.jpg'),'File:Example_cover.jpg');
assert.equal(api.fileTitle('https://commons.wikimedia.org/wiki/Special:FilePath/Bad.svg'),null);
const mkInfo=(name)=>({mime:'image/jpeg',thumburl:'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2a/'+name+'/460px-'+name,thumbsize:50000,extmetadata:meta});
const c=api.candidateFromInfo(mkInfo('Example.jpg'),'File:Example.jpg');assert.ok(c);assert.equal(c.source.author,'Example creator');
assert.equal(api.candidateFromInfo({...mkInfo('Example.jpg'),mime:'image/svg+xml'},'File:Example.svg'),null);
assert.equal(api.candidateFromInfo({...mkInfo('Example.jpg'),extmetadata:{...meta,LicenseShortName:{value:'All rights reserved'}}},'File:Example.jpg'),null);
const bindings=names=>({results:{bindings:names.map(name=>({image:{value:'http://commons.wikimedia.org/wiki/Special:FilePath/'+name}}))}});
function fixtureFetch({images=['One.jpg','Two.jpg'],unlicensed=[],failMetadata=[],status=200}={}){
  const calls=[];
  const fn=async url=>{
    calls.push(String(url));
    if(String(url).includes('query.wikidata.org'))return {ok:true,json:async()=>bindings(images)};
    if(String(url).includes('commons.wikimedia.org/w/api.php')){
      const title=new URL(String(url)).searchParams.get('titles').slice(5);
      if(failMetadata.includes(title))throw new Error('network down');
      if(status!==200)return {ok:false,status};
      const info=unlicensed.includes(title)
        ?{...mkInfo(title),extmetadata:{...meta,LicenseShortName:{value:'CC BY-NC 4.0'}}}
        :mkInfo(title);
      return {ok:true,json:async()=>({query:{pages:{12:{imageinfo:[info]}}}})};
    }
    if(String(url).startsWith('https://upload.wikimedia.org/'))return {ok:true,headers:{get:()=>String(20)},blob:async()=>new Blob([new Uint8Array([255,216,255,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,217])],{type:'image/jpeg'})};
    throw new Error('Unexpected network address '+url);
  };
  return {fn,calls};
}
(async()=>{
  const {fn,calls}=fixtureFetch();
  const found=await api.lookupCandidates('tt0816692',fn);
  assert.equal(found.reason,'found');assert.equal(found.checked,2);assert.equal(found.candidates.length,2);
  assert.ok(found.candidates.every(c=>c.source.sourceUrl.startsWith('https://commons.wikimedia.org/wiki/File:')));
  const image=await api.download(found.candidates[0],fn);assert.equal(image.size,20);
  assert.equal(calls.length,4);
  const legacy=await api.lookup('tt0816692',fixtureFetch().fn);assert.ok(legacy);
  await assert.rejects(()=>api.lookupCandidates('not-an-id',fn),{code:'invalid_id'});
  const empty=await api.lookupCandidates('tt0816692',fixtureFetch({images:[]}).fn);
  assert.equal(empty.reason,'no_image');assert.equal(empty.candidates.length,0);
  const excluded=await api.lookupCandidates('tt0816692',fixtureFetch({images:['Other.jpg'],unlicensed:['Other.jpg']}).fn);
  assert.equal(excluded.reason,'no_licensed_image');assert.equal(excluded.checked,1);
  const partial=await api.lookupCandidates('tt0816692',fixtureFetch({failMetadata:['One.jpg']}).fn);
  assert.equal(partial.candidates.length,1); // One network failure must not discard a valid candidate.
  await assert.rejects(()=>api.lookupCandidates('tt0816692',fixtureFetch({images:['One.jpg'],failMetadata:['One.jpg']}).fn),{code:'network'});
  await assert.rejects(()=>api.lookupCandidates('tt0816692',fixtureFetch({images:['One.jpg'],status:429}).fn),{code:'rate_limited'});
  await assert.rejects(()=>api.lookupCandidates('tt0816692',async()=>{throw new Error('offline');}),{code:'network'});
  const game=fs.readFileSync(path.join(root,'app/games.js'),'utf8');
  const integration=fs.readFileSync(path.join(root,'app/shared/library-integration-ui.js'),'utf8');
  const rust=fs.readFileSync(path.join(root,'src-tauri/src/posters.rs'),'utf8');
  const html=fs.readFileSync(path.join(root,'app/index.html'),'utf8');
  assert.match(game,/commonsPreviewCandidates/);
  assert.match(game,/commonsMissTtl=24\*60\*60\*1000/);
  assert.match(game,/commonsMissWrite\(imdb,true\)/);
  // Exercise the real local no-result cache in isolation, not just source-string matching.
  const stored=new Map();
  const localStorage={getItem:k=>stored.get(k)||null,setItem:(k,v)=>stored.set(k,String(v))};
  const ctx=vm.createContext({localStorage,Date,JSON,Object,Number,RegExp});
  const cacheSource=game.slice(game.indexOf('const commonsMissStorageKey='),game.indexOf('function commonsPreviewCandidates('));
  vm.runInContext(cacheSource+';this.check=commonsMissRead;this.save=commonsMissWrite;',ctx);
  assert.equal(ctx.check('tt0816692'),false);
  ctx.save('tt0816692',true);assert.equal(ctx.check('tt0816692'),true);
  ctx.save('tt0816692',false);assert.equal(ctx.check('tt0816692'),false);
  localStorage.setItem('kinotekaCommonsNoImageV1',JSON.stringify({tt0816692:Date.now()-25*60*60*1000}));
  assert.equal(ctx.check('tt0816692'),false);

  assert.doesNotMatch(game,/if\(auto\)\{await commonsFindFor\(key,\{force:true\}\)/); // No Commons control in card view.
  assert.match(game,/posterInvoke\('poster_set',\{key,dataUrl,source:choice.source\}/);
  assert.match(game,/kinotekaAutoCommonsOptIn/);
  assert.doesNotMatch(integration,/kinotekaCommonsPendingImdb|offline_catalog_search/); // Retired catalog/auto-trigger cannot reappear.
  assert.doesNotMatch(html,/id="kinotekaCommonsOptIn"/); // Online auto-lookup UI paused, core tests retained for compatibility.
  assert.match(rust,/credit_file/);assert.match(rust,/checked_credit/);
  assert.ok(!fs.existsSync(path.join(root,'posters')));
  console.log('COMMONS POSTERS QA: PASS (multiple candidates, licensed filtering, explicit network errors, no-result cooldown, manual retry, credits, no distributed images)');
})().catch(e=>{console.error(e);process.exitCode=1;});
