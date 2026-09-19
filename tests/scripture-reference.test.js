import test from'node:test';
import assert from'node:assert/strict';
import{formatReference,parseScriptureReference,scriptureItem}from'../src/scripture.js';
const books=['Genesis','Psalm','John','Romans','Isaiah','1 Corinthians','2 Timothy','Revelation'].map(book=>({book}));
test('parses abbreviations, whitespace and ranges',()=>{
 assert.deepEqual(parseScriptureReference(' 1Cor 13:4-7 ',books),{state:'verses',book:'1 Corinthians',chapter:13,verseStart:4,verseEnd:7});
 assert.deepEqual(parseScriptureReference('Rom 8:28–32',books),{state:'verses',book:'Romans',chapter:8,verseStart:28,verseEnd:32});
 assert.deepEqual(parseScriptureReference('Ps 91',books),{state:'chapter',book:'Psalm',chapter:91});
 assert.deepEqual(parseScriptureReference('John 3:',books),{state:'chapter',book:'John',chapter:3,incomplete:true});
});
test('formats non-contiguous verse selections without inventing a range',()=>{
 assert.equal(formatReference('Exodus',1,[{verse:4},{verse:6},{verse:9}]),'Exodus 1:4, 6, 9');
});
test('keeps structured Scripture data and creates readable slides',()=>{
 const item=scriptureItem({translation:{id:'kjv',code:'KJV'},book:'Genesis',chapter:1,verses:[{verse:1,text:'Short verse.'},{verse:2,text:'Another short verse.'}]});
 assert.equal(item.reference,'Genesis 1:1–2');assert.equal(item.slides[0].scripture.translation,'KJV');assert.equal(item.slides[0].reference,'Genesis 1:1–2 (KJV)');
});
test('paginates long passages between complete verses',()=>{
 const verses=Array.from({length:10},(_,index)=>({verse:index+1,text:`Verse ${index+1} ${'word '.repeat(24)}`.trim()}));
 const item=scriptureItem({translation:{id:'esv',code:'ESV'},book:'Psalm',chapter:91,verses});
 assert.ok(item.slides.length>1);
 assert.deepEqual(item.slides.flatMap(slide=>slide.scripture.verses.map(verse=>verse.verse)),verses.map(verse=>verse.verse));
 assert.ok(item.slides.every(slide=>slide.scripture.verses.length<=3));
 assert.match(item.slides[0].reference,/Psalm 91:/);
});
