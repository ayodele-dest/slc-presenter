import test from'node:test';
import assert from'node:assert/strict';
import{applyLiveSongDraft,librarySongFromLive,liveSongDraft}from'../src/live-song.js';

test('live lyric drafts preserve the active slide and mark library state unsaved',()=>{
  const song={id:'service-song',databaseId:'library-song',title:'Song',type:'Song',slides:[{name:'Verse 1',text:'Old verse'},{name:'Chorus',text:'Old chorus'}],activeSlide:{name:'Chorus',text:'Old chorus'}};
  const draft=liveSongDraft(song);draft.slides[1].text='Correct chorus';
  const updated=applyLiveSongDraft(song,draft,123);
  assert.equal(updated.activeSlide.text,'Correct chorus');
  assert.equal(updated.serviceSongOverride.sourceSongId,'library-song');
  assert.equal(updated.serviceSongOverride.unsavedLibrary,true);
  assert.equal(updated.serviceSongOverride.updatedAt,123);
});

test('removing the active slide falls back to the nearest remaining slide',()=>{
  const song={id:'song',title:'Song',type:'Song',slides:[{name:'Verse',text:'One'},{name:'Chorus',text:'Two'},{name:'Bridge',text:'Three'}],activeSlide:{name:'Chorus',text:'Two'}};
  const draft=liveSongDraft(song);draft.slides.splice(1,1);
  const updated=applyLiveSongDraft(song,draft);
  assert.equal(updated.activeSlide.name,'Bridge');
});

test('library save payload is explicit and contains reparsed sections',()=>{
  const song=applyLiveSongDraft({id:'song',databaseId:'db-1',title:'Song',slides:[{name:'Verse 1',text:'Old'}],activeSlide:{name:'Verse 1'}},{title:'Song',slides:[{id:'verse',name:'Verse 1',text:'Corrected'}]});
  const payload=librarySongFromLive(song);
  assert.equal(payload.id,'db-1');
  assert.equal(payload.sections[0].label,'Verse 1');
  assert.equal(payload.sections[0].text,'Corrected');
});
