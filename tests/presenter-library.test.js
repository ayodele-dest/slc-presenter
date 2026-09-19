import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {openPresenterLibrary} from '../server/presenter-library.js';

test('creates, updates, reorders, and deletes a local song',()=>{
  const directory=mkdtempSync(join(tmpdir(),'slc-presenter-library-'));
  const library=openPresenterLibrary(join(directory,'presenter.sqlite'));
  try{
    const rawLyrics='[Verse 1]\n\nFirst line\n\n[Chorus]\n\nSing again';
    const created=library.saveSong({title:'Test Song',author:'SLC',rawLyrics,sections:[{label:'Verse 1',text:'First line'},{label:'Chorus',text:'Sing again'}]});
    assert.equal(created.title,'Test Song');
    assert.equal(created.raw_lyrics,rawLyrics);
    assert.deepEqual(created.sections.map(section=>section.name),['Verse 1','Chorus']);
    const updated=library.saveSong({id:created.id,title:'Test Song Updated',author:'SLC',sections:[{label:'Chorus',text:'Sing again'},{label:'Verse 1',text:'First line'}]});
    assert.equal(updated.title,'Test Song Updated');
    assert.deepEqual(updated.sections.map(section=>section.name),['Chorus','Verse 1']);
    assert.equal(library.deleteSong(created.id),true);
    assert.equal(library.listSongs().length,0);
  }finally{library.close();rmSync(directory,{recursive:true,force:true})}
});

test('rejects songs without a title or lyrics',()=>{
  const directory=mkdtempSync(join(tmpdir(),'slc-presenter-library-'));
  const library=openPresenterLibrary(join(directory,'presenter.sqlite'));
  try{
    assert.throws(()=>library.saveSong({title:'',sections:[{label:'Verse',text:'Words'}]}),/title/i);
    assert.throws(()=>library.saveSong({title:'Empty',sections:[{label:'Verse',text:''}]}),/section/i);
  }finally{library.close();rmSync(directory,{recursive:true,force:true})}
});

test('persists manual Scripture and text presentations',()=>{
  const directory=mkdtempSync(join(tmpdir(),'slc-presenter-documents-'));
  const library=openPresenterLibrary(join(directory,'presenter.sqlite'));
  try{
    const scripture=library.saveDocument({kind:'Scripture',title:'Romans 8:28',reference:'Romans 8:28',alignment:'center',font_size:44,slides:[{name:'Slide 1',text:'And we know that all things work together for good.',reference:'Romans 8:28'}]});
    const notice=library.saveDocument({kind:'Presentation',title:'Offering Information',alignment:'left',font_size:36,slides:[{name:'Slide 1',text:'Giving details'},{name:'Slide 2',text:'Thank you'}]});
    assert.equal(library.listDocuments('Scripture')[0].title,'Romans 8:28');
    assert.equal(library.listDocuments('Presentation')[0].slides.length,2);
    assert.equal(notice.alignment,'left');
    assert.equal(library.deleteDocument(scripture.id),true);
  }finally{library.close();rmSync(directory,{recursive:true,force:true})}
});

test('creates, updates, and reopens complete services',()=>{
  const directory=mkdtempSync(join(tmpdir(),'slc-presenter-services-'));
  const library=openPresenterLibrary(join(directory,'presenter.sqlite'));
  try{
    const created=library.saveService({name:'Sunday Service',items:[{id:'song-1',title:'Opening Song',type:'Song'}]});
    assert.ok(created.id);
    assert.equal(library.listServices()[0].name,'Sunday Service');
    const updated=library.saveService({id:created.id,name:'Sunday Celebration',items:[...created.items,{id:'scripture-1',title:'Genesis 1:1',type:'Scripture'}]});
    assert.equal(updated.items.length,2);
    assert.equal(library.getService(created.id).name,'Sunday Celebration');
  }finally{library.close();rmSync(directory,{recursive:true,force:true})}
});

test('saved services resolve current song data and protect referenced songs',()=>{
  const directory=mkdtempSync(join(tmpdir(),'slc-presenter-linked-song-'));
  const library=openPresenterLibrary(join(directory,'presenter.sqlite'));
  try{
    const song=library.saveSong({title:'Original Title',author:'Author',sections:[{label:'Verse 1',text:'First slide\n---\nSecond slide'}]});
    const service=library.saveService({name:'Linked Service',items:[{id:`db-${song.id}`,databaseId:song.id,title:song.title,type:'Song',slides:song.sections}]});
    library.saveSong({id:song.id,title:'Updated Title',author:'Author',sections:[{label:'Verse 1',text:'Updated first\n---\nUpdated second'}]});
    const reopened=library.getService(service.id);
    assert.equal(reopened.items[0].title,'Updated Title');
    assert.deepEqual(reopened.items[0].slides.map(slide=>slide.name),['Verse 1','Verse 1 · 2']);
    assert.throws(()=>library.deleteSong(song.id),/used by saved service/i);
  }finally{library.close();rmSync(directory,{recursive:true,force:true})}
});

test('rejects corrupt imports without changing the existing library',()=>{
  const directory=mkdtempSync(join(tmpdir(),'slc-presenter-import-'));
  const library=openPresenterLibrary(join(directory,'presenter.sqlite'));
  try{
    library.saveSong({title:'Existing Song',sections:[{label:'Verse 1',text:'Keep this song'}]});
    const corrupt=join(directory,'corrupt.db');writeFileSync(corrupt,'this is not a sqlite database');
    assert.throws(()=>library.importFile(corrupt));
    assert.deepEqual(library.listSongs().map(song=>song.title),['Existing Song']);
  }finally{library.close();rmSync(directory,{recursive:true,force:true})}
});

test('imports and browses a structured Bible translation',()=>{
  const directory=mkdtempSync(join(tmpdir(),'slc-presenter-bible-'));
  const library=openPresenterLibrary(join(directory,'presenter.sqlite'));
  try{
    const path=join(directory,'test-bible.json');writeFileSync(path,JSON.stringify({translation:{name:'Test Bible',abbreviation:'TB'},books:[{name:'Genesis',chapters:[['In the beginning.','The earth was without form.']]},{name:'Exodus',chapters:[['These are the names.']]}]}));
    const imported=library.importBible(path);
    assert.equal(imported.bookCount,2);assert.equal(imported.verseCount,3);
    const translation=library.listTranslations()[0];
    assert.equal(translation.code,'TB');
    assert.deepEqual(library.listBibleBooks(translation.id).map(item=>item.book),['Genesis','Exodus']);
    assert.equal(library.listBibleVerses(translation.id,'Genesis',1)[1].verse,2);
  }finally{library.close();rmSync(directory,{recursive:true,force:true})}
});

test('imports a Bible JSON keyed by book, chapter, and verse',()=>{
  const directory=mkdtempSync(join(tmpdir(),'slc-presenter-keyed-bible-'));
  const library=openPresenterLibrary(join(directory,'presenter.sqlite'));
  try{
    const path=join(directory,'American Standard Version.json');writeFileSync(path,JSON.stringify({Genesis:{1:{1:'In the beginning.',2:'The earth was without form.'}},Exodus:{1:{1:'These are the names.'}}}));
    const imported=library.importBible(path);
    assert.equal(imported.code,'ASV');assert.equal(imported.name,'American Standard Version');assert.equal(imported.bookCount,2);assert.equal(imported.verseCount,3);
    const translation=library.listTranslations()[0];
    assert.equal(library.listBibleVerses(translation.id,'Genesis',1)[1].text,'The earth was without form.');
  }finally{library.close();rmSync(directory,{recursive:true,force:true})}
});

test('stores independent image and video library records',()=>{
  const directory=mkdtempSync(join(tmpdir(),'slc-presenter-media-'));
  const library=openPresenterLibrary(join(directory,'presenter.sqlite'));
  try{
    writeFileSync(join(directory,'welcome.png'),'image bytes');
    const image=library.addMedia({id:'image-1',title:'Welcome',type:'Image',path:join(directory,'welcome.png'),originalPath:'C:/media/welcome.png',mime:'image/png'});
    const video=library.addMedia({id:'video-1',title:'Announcements',type:'Video',path:join(directory,'announcements.mp4'),originalPath:'C:/media/announcements.mp4',mime:'video/mp4'});
    assert.deepEqual(library.listMedia().map(item=>item.type),['Video','Image']);
    assert.deepEqual(library.listMedia().map(item=>item.missing),[true,false]);
    assert.equal(library.getMediaPath(image.id),join(directory,'welcome.png'));
    const motion=library.updateMedia(video.id,{title:'Ambient Announcements',type:'Motion Background',duration:12.5,width:1920,height:1080});
    assert.equal(motion.title,'Ambient Announcements');
    assert.equal(motion.type,'Motion Background');
    assert.equal(motion.loop,1);assert.equal(motion.muted,1);
    assert.equal(motion.duration,12.5);assert.equal(motion.width,1920);assert.equal(motion.height,1080);
    const service=library.saveService({name:'Media Service',items:[{id:'media-db-video-1',databaseId:video.id,title:video.title,type:'Media',mediaType:'Video',url:'/media/video-1'}]});
    assert.equal(library.getService(service.id).items[0].missing,true);
    assert.equal(library.getService(service.id).items[0].detail,'Missing media');
    assert.equal(library.getService(service.id).items[0].mediaType,'Video');
    assert.equal(library.getService(service.id).items[0].mediaKind,'Motion Background');
    assert.equal(library.getService(service.id).items[0].loop,true);
    assert.equal(library.deleteMedia(video.id),true);
  }finally{library.close();rmSync(directory,{recursive:true,force:true})}
});

test('creates a default theme and persists reusable theme layouts',()=>{
  const directory=mkdtempSync(join(tmpdir(),'slc-presenter-theme-'));
  const library=openPresenterLibrary(join(directory,'presenter.sqlite'));
  try{
    const defaults=library.listThemes();
    assert.equal(defaults.length,1);assert.equal(defaults[0].isDefault,true);
    assert.equal(defaults[0].canvasWidth,1920);assert.equal(defaults[0].background.type,'solid');
    const saved=library.saveTheme({name:'Broadcast Scripture',contentType:'Scripture',layoutType:'Lower Third',canvasWidth:1920,canvasHeight:1080,background:{type:'transparent'},elements:[{id:'verse',type:'dynamic',binding:'primary',x:120,y:790,width:1300,height:130,style:{fontSize:54,color:'#ffffff'}}]});
    assert.equal(saved.layoutType,'Lower Third');assert.equal(saved.background.type,'transparent');
    assert.equal(library.listThemes().length,2);
    assert.equal(library.setThemeDefault('Scripture',saved.id).scriptureThemeId,saved.id);
    assert.equal(library.getThemeDefaults().songThemeId,'slc-default-theme');
    assert.equal(library.deleteTheme(saved.id),true);
    assert.throws(()=>library.deleteTheme(defaults[0].id),/default theme/i);
  }finally{library.close();rmSync(directory,{recursive:true,force:true})}
});
