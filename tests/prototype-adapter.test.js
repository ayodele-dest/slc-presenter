import test from 'node:test';
import assert from 'node:assert/strict';
import {installPrototypeAdapter} from '../src/prototype-adapter.js';

test('browser prototype seeds content and persists UI edits locally',async()=>{
 const values=new Map();
 globalThis.localStorage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};
 globalThis.window={open:()=>null};
 installPrototypeAdapter();
 assert.equal(window.slcPrototype,true);
 const initial=await window.slcDesktop.listPresenterSongs();
 assert.ok(initial.length>=2);
 const saved=await window.slcDesktop.savePresenterSong({title:'Prototype Draft',raw_lyrics:'[Verse 1]\n\nDraft lyric'});
 const reloaded=await window.slcDesktop.listPresenterSongs();
 assert.equal(reloaded.find(song=>song.id===saved.id)?.title,'Prototype Draft');
 const verses=await window.slcDesktop.listBibleVerses('prototype-kjv','Genesis',1);
 assert.equal(verses[0].verse,1);
 assert.match(verses[0].text,/beginning/i);
});
