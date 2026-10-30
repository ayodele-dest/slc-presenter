import test from'node:test';
import assert from'node:assert/strict';
import{suggestScriptureReferences}from'../src/scripture.js';

const books=[{book:'Genesis',chapters:50},{book:'John',chapters:21},{book:'1 John',chapters:5},{book:'Romans',chapters:16}];
test('suggests installed Bible books from names and abbreviations',()=>{
 assert.deepEqual(suggestScriptureReferences('rom',books).slice(0,2),['Romans 1','Romans 2']);
 assert.deepEqual(suggestScriptureReferences('1 j',books).slice(0,2),['1 John 1','1 John 2']);
});
test('completes chapters and verse entry',()=>{
 assert.deepEqual(suggestScriptureReferences('Romans 8',books),['Romans 8','Romans 8:1']);
 assert.deepEqual(suggestScriptureReferences('Romans 8:',books),['Romans 8:1']);
});
