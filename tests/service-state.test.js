import test from'node:test';
import assert from'node:assert/strict';
import{edgeSlide,recoverySnapshot}from'../src/service-state.js';

test('recovery snapshot retains the opened service and operator state',()=>{
  const snapshot=recoverySnapshot({serviceId:'service-1',serviceFilePath:'C:/Services/Sunday.slcservice',name:'Sunday',items:[{id:'song-1'}],dirty:true,selected:{id:'song-1'},preview:{id:'song-1',activeSlide:{name:'Verse'}},live:{id:'song-2',activeSlide:{name:'Chorus'}}});
  assert.equal(snapshot.version,2);
  assert.equal(snapshot.serviceFilePath,'C:/Services/Sunday.slcservice');
  assert.equal(snapshot.preview.activeSlide.name,'Verse');
  assert.equal(snapshot.live.activeSlide.name,'Chorus');
  assert.equal(snapshot.items.length,1);
});

test('first and last navigation fail safely for empty content',()=>{
  const item={slides:[{name:'First'},{name:'Middle'},{name:'Last'}]};
  assert.equal(edgeSlide(item,'first').name,'First');
  assert.equal(edgeSlide(item,'last').name,'Last');
  assert.equal(edgeSlide({slides:[]},'last'),null);
  assert.equal(edgeSlide(null,'first'),null);
});
