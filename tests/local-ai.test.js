import test from'node:test';
import assert from'node:assert/strict';
import{createLocalAi,sanitizeSuggestions}from'../server/local-ai.js';

const books=[{book:'Genesis',chapters:50},{book:'Romans',chapters:16}];

test('sanitizes, canonicalizes, and deduplicates local AI references',()=>{
 const result=sanitizeSuggestions({suggestions:[{book:'romans',chapter:8,startVerse:28,endVerse:28,reason:'God works through every circumstance.',confidence:'high'},{book:'Romans',chapter:8,startVerse:28,endVerse:28},{book:'Imaginations',chapter:1,verse:1},{book:'Genesis',chapter:99,verse:1}]},books);
 assert.equal(result.length,1);assert.equal(result[0].reference,'Romans 8:28');assert.equal(result[0].source,'ollama');
});

test('reports an unavailable runtime without throwing',async()=>{
 const ai=createLocalAi({fetchImpl:async()=>{throw new Error('connect refused')}}),status=await ai.status();
 assert.equal(status.runtime,'unavailable');assert.equal(status.modelReady,false);assert.match(status.error,/connect refused/);
});

test('requests JSON-only suggestions from the loopback Ollama endpoint',async()=>{
 let request;
 const fetchImpl=async(url,options)=>{
  request={url,options};
  return{ok:true,json:async()=>({message:{content:JSON.stringify({suggestions:[{book:'Romans',chapter:8,startVerse:28,endVerse:28,reason:'Hope',confidence:'high'}]})}})};
 };
 const ai=createLocalAi({fetchImpl}),suggestions=await ai.suggest({topic:'hope in difficulty',books});
 assert.equal(request.url,'http://127.0.0.1:11434/api/chat');assert.equal(suggestions[0].reference,'Romans 8:28');assert.equal(JSON.parse(request.options.body).stream,false);
});
