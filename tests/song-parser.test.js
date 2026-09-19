import test from'node:test';
import assert from'node:assert/strict';
import{parseLyrics}from'../src/song-parser.js';
test('blank lines create slides while single newlines remain inside a slide',()=>{const result=parseLyrics('Line A\r\nLine B\r\n\r\nLine C\r\nLine D');assert.deepEqual(result.slides.map(item=>item.text),['Line A\nLine B','Line C\nLine D'])});
test('extra and whitespace-only blank lines do not create empty slides',()=>{const result=parseLyrics('Line A\n \n\n\nLine B');assert.deepEqual(result.slides.map(item=>item.text),['Line A','Line B'])});
test('section markers become metadata and never projected text',()=>{const result=parseLyrics('[Verse 1]\n\nAmazing grace\nHow sweet the sound\n\n[Chorus]\n\nMy chains are gone');assert.deepEqual(result.slides.map(item=>({section:item.section,text:item.text})),[{section:'Verse 1',text:'Amazing grace\nHow sweet the sound'},{section:'Chorus',text:'My chains are gone'}]);assert.equal(result.slides.some(item=>item.text.includes('[Chorus]')),false)});
test('repeated and custom sections remain distinct occurrences',()=>{const result=parseLyrics('[Chorus]\n\nFirst\n\n[Prayer Chant]\n\nResponse\n\n[Chorus]\n\nRepeat');assert.deepEqual(result.sections.map(item=>[item.label,item.occurrence]),[['Chorus',1],['Prayer Chant',1],['Chorus',2]])});
