import test from'node:test';
import assert from'node:assert/strict';
import{collectOutputMediaAssets}from'../src/output-state.js';

test('collects preview images and videos once for network preloading',()=>{
 const assets=collectOutputMediaAssets({type:'Media',mediaType:'Video',url:'/media/video',slides:[{imageUrl:'/media/slide',background:{type:'image',url:'/media/background'}}],theme:{background:{type:'video',url:'/media/motion'},elements:[{type:'image',url:'/media/logo'},{type:'image',url:'/media/logo'}]}});
 assert.deepEqual(assets,[{url:'/media/video',kind:'video'},{url:'/media/motion',kind:'video'},{url:'/media/slide',kind:'image'},{url:'/media/background',kind:'image'},{url:'/media/logo',kind:'image'}]);
});
