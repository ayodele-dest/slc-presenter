const OLLAMA_ORIGIN='http://127.0.0.1:11434';
export const DEFAULT_LOCAL_AI_MODEL='gemma3:1b';

const clean=value=>String(value??'').trim();
const safeModel=value=>/^[a-z0-9._:/-]{1,100}$/i.test(clean(value))?clean(value):DEFAULT_LOCAL_AI_MODEL;
const normalizeBook=value=>clean(value).toLowerCase().replace(/[^a-z0-9]/g,'');

export function sanitizeSuggestions(value,books=[]){
 const rows=Array.isArray(value)?value:Array.isArray(value?.suggestions)?value.suggestions:[];
 const known=new Map(books.map(item=>[normalizeBook(item.book||item),item]));
 const seen=new Set();
 return rows.map(row=>{
  const match=known.get(normalizeBook(row?.book)),chapter=Number(row?.chapter),startVerse=Number(row?.startVerse??row?.verseStart??row?.verse),endVerse=Number(row?.endVerse??row?.verseEnd??startVerse);
  if(!match||!Number.isInteger(chapter)||chapter<1||chapter>Number(match.chapters||999)||!Number.isInteger(startVerse)||startVerse<1||!Number.isInteger(endVerse)||endVerse<startVerse||endVerse-startVerse>20)return null;
  const id=`${match.book}:${chapter}:${startVerse}:${endVerse}`.toLowerCase();if(seen.has(id))return null;seen.add(id);
  return{id,book:match.book,chapter,startVerse,endVerse,reference:`${match.book} ${chapter}:${startVerse}${endVerse===startVerse?'':`–${endVerse}`}`,reason:clean(row.reason||row.relevance).slice(0,240)||'Related to the requested topic',confidence:['high','likely','related'].includes(row.confidence)?row.confidence:'likely',detectionType:'ai_suggestion',source:'ollama',timestamp:Date.now()};
 }).filter(Boolean).slice(0,8);
}

function jsonFromResponse(content){
 const text=clean(content);try{return JSON.parse(text)}catch{}
 const match=text.match(/```(?:json)?\s*([\s\S]*?)```/i)||text.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
 if(!match)throw new Error('The local model returned an unreadable response. Try the request again.');
 return JSON.parse(match[1]);
}

export function createLocalAi({fetchImpl=globalThis.fetch,origin=OLLAMA_ORIGIN}={}){
 let active=null;
 const request=async(path,options={},timeoutMs=8000)=>{const controller=new AbortController(),timer=setTimeout(()=>controller.abort(new Error('Local AI request timed out.')),timeoutMs);active=controller;try{const response=await fetchImpl(`${origin}${path}`,{...options,signal:controller.signal,headers:{'content-type':'application/json',...(options.headers||{})}});if(!response.ok)throw new Error(`Ollama returned ${response.status}.`);return response}finally{clearTimeout(timer);if(active===controller)active=null}};
 return{
  async status(model=DEFAULT_LOCAL_AI_MODEL){try{const response=await request('/api/tags',{},3500),body=await response.json(),models=(body.models||[]).map(item=>item.name);return{runtime:'ready',model:safeModel(model),modelReady:models.some(name=>name===safeModel(model)||name.startsWith(`${safeModel(model)}:`)),models,origin}}catch(error){return{runtime:'unavailable',model:safeModel(model),modelReady:false,models:[],origin,error:error.name==='AbortError'?'Ollama did not respond.':error.message}}},
  async suggest({topic,model=DEFAULT_LOCAL_AI_MODEL,books=[]}){const prompt=clean(topic).slice(0,2000);if(!prompt)throw new Error('Enter a sermon topic or sentence.');const names=books.map(item=>item.book||item).join(', '),response=await request('/api/chat',{method:'POST',body:JSON.stringify({model:safeModel(model),stream:false,format:'json',options:{temperature:.2,num_predict:700},messages:[{role:'system',content:`You suggest Bible passages for a church presentation operator. Return JSON only as {"suggestions":[{"book":"Romans","chapter":8,"startVerse":28,"endVerse":28,"reason":"short relevance explanation","confidence":"high|likely|related"}]}. Use only these installed Bible books: ${names}. Return at most 8 passages. Never quote or invent verse text.`},{role:'user',content:prompt}]})},45000),body=await response.json();return sanitizeSuggestions(jsonFromResponse(body.message?.content),books)},
  async pull(model=DEFAULT_LOCAL_AI_MODEL){const response=await request('/api/pull',{method:'POST',body:JSON.stringify({model:safeModel(model),stream:false})},30*60*1000);return response.json()},
  cancel(){active?.abort();active=null;return true}
 };
}
