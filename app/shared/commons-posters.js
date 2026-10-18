/* Hotfix 18 — bounded Wikimedia candidates, explicit errors and license filtering by IMDb ID.
 * No search by private titles, no background crawl, no required access token.
 */
(function(root, factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.KinotekaCommonsPosters=api;
})(typeof window!=='undefined'?window:null,function(){
  'use strict';
  const IMDB=/^tt\d{4,15}$/;
  const MAX_IMAGE=5*1024*1024;
  const MAX_CANDIDATES=6;
  const QUERY_ENDPOINT='https://query.wikidata.org/sparql';
  const COMMONS_ENDPOINT='https://commons.wikimedia.org/w/api.php';
  const filePage='https://commons.wikimedia.org/wiki/File:';
  const uploadOrigin='https://upload.wikimedia.org/';
  const LICENSES=/^(?:CC0(?:\s*1\.0)?|CC BY(?:-SA)?\s*(?:1\.0|2\.0|2\.5|3\.0|4\.0))$/i;
  function stripTags(input){return String(input||'').replace(/<[^>]*>/g,' ').replace(/&nbsp;|&#160;/gi,' ').replace(/\s+/g,' ').trim().slice(0,250);}
  function allowLicense(metadata){
    const name=stripTags(metadata?.LicenseShortName?.value||'');
    const url=String(metadata?.LicenseUrl?.value||'');
    if(!LICENSES.test(name))return false;
    return url.startsWith('https://creativecommons.org/licenses/')||url.startsWith('https://creativecommons.org/publicdomain/');
  }
  function fileTitle(value){
    let u;
    try{u=new URL(value);}catch{return null;}
    if(u.hostname!=='commons.wikimedia.org'||u.pathname.indexOf('/wiki/Special:FilePath/')!==0)return null;
    let name;
    try{name=decodeURIComponent(u.pathname.split('/').pop()||'');}catch{return null;}
    if(!name||name.length>180||/[\x00-\x1f/\\]/.test(name))return null;
    if(!/\.(?:jpe?g|png|webp)$/i.test(name))return null;
    return `File:${name}`;
  }
  function requestError(code,message){
    const error=new Error(message);error.code=code;return error;
  }
  async function asJson(fetcher,url){
    let response;
    try{response=await fetcher(url,{method:'GET',mode:'cors',credentials:'omit',redirect:'error'});}
    catch{throw requestError('network','Нет соединения с Wikidata / Wikimedia Commons. Проверь интернет и повтори запрос.');}
    if(!response?.ok){
      if(response?.status===429)throw requestError('rate_limited','Wikimedia временно ограничила запросы (429). Попробуй позже.');
      throw requestError('service','Сервис Wikidata / Commons недоступен (HTTP '+String(response?.status||'?')+').');
    }
    try{return await response.json();}
    catch{throw requestError('service','Сервис вернул некорректные данные. Попробуй позже.');}
  }
  function candidateFromInfo(info,title){
    if(!info||!['image/jpeg','image/png','image/webp'].includes(info.mime))return null;
    if(!allowLicense(info.extmetadata))return null;
    const imageUrl=String(info.thumburl||info.url||'');
    if(!imageUrl.startsWith(uploadOrigin))return null;
    if(info.thumbsize&&info.thumbsize>MAX_IMAGE)return null;
    const license=stripTags(info.extmetadata.LicenseShortName.value);
    const author=stripTags(info.extmetadata.Artist?.value||info.extmetadata.Attribution?.value||'Автор указан на странице файла');
    const sourceUrl=filePage+encodeURIComponent(title.slice(5)).replace(/%20/g,'_');
    return {imageUrl,source:{sourceUrl,license,licenseUrl:info.extmetadata.LicenseUrl.value,author,title:title.slice(5)}};
  }
  async function lookupCandidates(imdbId,fetcher=fetch){
    if(!IMDB.test(String(imdbId)))throw requestError('invalid_id','Для поиска нужен корректный IMDb ID.');
    // Only the public IMDb ID is sent. No private titles, profile or library data.
    const sparql=`SELECT DISTINCT ?image WHERE { ?film wdt:P345 "${imdbId}"; wdt:P18 ?image. } LIMIT ${MAX_CANDIDATES}`;
    const sparqlUrl=QUERY_ENDPOINT+'?'+new URLSearchParams({query:sparql,format:'json'});
    const result=await asJson(fetcher,sparqlUrl);
    if(!Array.isArray(result?.results?.bindings))throw requestError('service','Wikidata вернула неожиданный формат данных.');
    const titles=[...new Set(result.results.bindings.slice(0,MAX_CANDIDATES).map(b=>fileTitle(b?.image?.value)).filter(Boolean))];
    if(!titles.length)return {candidates:[],reason:'no_image',checked:0};
    const candidates=[];
    let firstFailure=null;
    for(const title of titles){
      const apiUrl=COMMONS_ENDPOINT+'?'+new URLSearchParams({action:'query',format:'json',origin:'*',titles:title,prop:'imageinfo',iiprop:'url|mime|size|extmetadata',iiurlwidth:'460'});
      try{
        const meta=await asJson(fetcher,apiUrl);
        const page=Object.values(meta?.query?.pages||{})[0];
        const candidate=candidateFromInfo(page?.imageinfo?.[0],title);
        if(candidate)candidates.push(candidate);
      }catch(error){firstFailure??=error;}
    }
    // Never classify an interrupted lookup as "nothing found"; don't negatively cache errors.
    if(!candidates.length&&firstFailure)throw firstFailure;
    return {candidates,reason:candidates.length?'found':'no_licensed_image',checked:titles.length};
  }
  async function lookup(imdbId,fetcher=fetch){
    const result=await lookupCandidates(imdbId,fetcher);
    return result.candidates[0]||null; // Compatibility with Hotfix 17 clients.
  }
  async function download(candidate,fetcher=fetch){
    if(!candidate||!String(candidate.imageUrl).startsWith(uploadOrigin))throw new Error('Источник изображения не разрешён.');
    const response=await fetcher(candidate.imageUrl,{method:'GET',mode:'cors',credentials:'omit',redirect:'error'});
    if(!response.ok)throw new Error('Не удалось загрузить изображение с Commons.');
    const declared=Number(response.headers?.get?.('content-length'));
    if(declared>MAX_IMAGE)throw new Error('Изображение слишком большое (лимит 5 МБ).');
    const blob=await response.blob();
    if(blob.size<16||blob.size>MAX_IMAGE||!['image/jpeg','image/png','image/webp'].includes(blob.type))throw new Error('Commons вернул неподдерживаемое изображение.');
    return blob;
  }
  return {lookup,lookupCandidates,download,allowLicense,candidateFromInfo,fileTitle,stripTags};
});
