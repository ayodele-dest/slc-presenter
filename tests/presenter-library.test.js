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

test('persists folders, collections, and their item assignments',()=>{
  const directory=mkdtempSync(join(tmpdir(),'slc-presenter-organization-'));
  const path=join(directory,'presenter.sqlite');
  let library=openPresenterLibrary(path);
  try{
    const value={folders:[{id:'folder-1',name:'Sunday Songs',tab:'Songs'}],collections:[{id:'collection-1',name:'Christmas',tab:'Songs'}],folderAssignments:{'Songs:song-1':'folder-1'},collectionAssignments:{'collection-1':['Songs:song-1']}};
    assert.deepEqual(library.saveLibraryOrganization(value),value);
    library.close();library=openPresenterLibrary(path);
    assert.deepEqual(library.getLibraryOrganization(),value);
  }finally{library.close();rmSync(directory,{recursive:true,force:true})}
});

test('persists empty media folders before any media is imported',()=>{
  const directory=mkdtempSync(join(tmpdir(),'slc-presenter-empty-media-folders-'));
  const path=join(directory,'presenter.sqlite');
  let library=openPresenterLibrary(path);
  try{
    const value={folders:[],collections:[{id:'media-adverts',name:'Adverts',tab:'Media'},{id:'media-praise',name:'Praise',tab:'Media'}],folderAssignments:{},collectionAssignments:{'media-adverts':[],'media-praise':[]}};
    assert.equal(library.listMedia().length,0);
    library.saveLibraryOrganization(value);
    library.close();library=openPresenterLibrary(path);
    assert.equal(library.listMedia().length,0);
    assert.deepEqual(library.getLibraryOrganization(),value);
  }finally{library.close();rmSync(directory,{recursive:true,force:true})}
});

test('survives repeated folder, theme, and media persistence updates',()=>{
  const directory=mkdtempSync(join(tmpdir(),'slc-presenter-stress-'));
  const path=join(directory,'presenter.sqlite'),mediaPath=join(directory,'background.mp4');
  writeFileSync(mediaPath,'test media');
  let library=openPresenterLibrary(path);
  try{
    for(let index=0;index<150;index++)library.saveLibraryOrganization({folders:[],collections:[{id:'media-service',name:`Service ${index}`,tab:'Media'}],folderAssignments:{},collectionAssignments:{'media-service':index%2?['Media:background']:[]}});
    for(let index=0;index<100;index++)library.saveTheme({id:'stress-theme',name:'Stress Theme',contentType:'Song',canvasWidth:1920,canvasHeight:1080,background:{type:'solid',color:index%2?'#030712':'#111827'},elements:[{id:'lyrics',type:'dynamic',role:'lyrics',style:{fontSize:40+index}}]});
    library.addMedia({id:'background',title:'Background',type:'Video',path:mediaPath,originalPath:mediaPath,mime:'video/mp4'});
    library.close();library=openPresenterLibrary(path);
    assert.equal(library.getLibraryOrganization().collections[0].name,'Service 149');
    assert.deepEqual(library.getLibraryOrganization().collectionAssignments['media-service'],['Media:background']);
    assert.equal(library.listThemes().filter(theme=>theme.id==='stress-theme').length,1);
    assert.equal(library.listThemes().find(theme=>theme.id==='stress-theme').elements[0].style.fontSize,139);
    assert.equal(library.listMedia().find(item=>item.id==='background').missing,false);
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

test('persists native presentation slide design and reports library health',()=>{
  const directory=mkdtempSync(join(tmpdir(),'slc-presenter-native-presentation-'));
  const library=openPresenterLibrary(join(directory,'presenter.sqlite'));
  try{
    const saved=library.saveDocument({kind:'Presentation',title:'Sunday Notices',slides:[{name:'Welcome',title:'Welcome Home',body:'We are glad you are here',imageMediaId:'image-1',imageUrl:'/media/image-1',imageFit:'fill',background:{type:'solid',color:'#163c31'}},{name:'Image',imageUrl:'/media/image-2',background:{type:'image',mediaId:'image-3',url:'/media/image-3',fit:'cover'}}]});
    assert.equal(saved.slides[0].text,'Welcome Home\nWe are glad you are here');
    assert.equal(saved.slides[0].imageFit,'fill');
    assert.equal(saved.slides[0].background.color,'#163c31');
    assert.equal(saved.slides[1].background.mediaId,'image-3');
    assert.deepEqual(library.health(),{database:'ready',songs:0,documents:1,media:0,translations:0});
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

test('preserves per-output theme and background styling on service items',()=>{
  const directory=mkdtempSync(join(tmpdir(),'slc-presenter-output-styles-'));
  const library=openPresenterLibrary(join(directory,'presenter.sqlite'));
  try{
    const outputStyles={'output-1':{themeId:'full-screen',background:'default'},'output-2':{themeId:'lower-third',background:'transparent'}};
    const saved=library.saveService({name:'Styled Service',items:[{id:'notice-1',title:'Welcome',type:'Presentation',slides:[{name:'Slide 1',text:'Welcome'}],outputStyles}]});
    assert.deepEqual(library.getService(saved.id).items[0].outputStyles,outputStyles);
  }finally{library.close();rmSync(directory,{recursive:true,force:true})}
});

test('saved services resolve updated native presentations and protect references',()=>{
  const directory=mkdtempSync(join(tmpdir(),'slc-presenter-linked-presentation-'));
  const library=openPresenterLibrary(join(directory,'presenter.sqlite'));
  try{
    const presentation=library.saveDocument({kind:'Presentation',title:'Offering',slides:[{name:'Slide 1',title:'Give',body:'Bank details'}]});
    const service=library.saveService({name:'Sunday',items:[{id:`doc-${presentation.id}`,databaseId:presentation.id,title:presentation.title,type:'Presentation',slides:presentation.slides}]});
    library.saveDocument({id:presentation.id,kind:'Presentation',title:'Offering Updated',slides:[{name:'Slide 1',title:'Give Online',body:'Updated details'}]});
    const reopened=library.getService(service.id);
    assert.equal(reopened.items[0].title,'Offering Updated');
    assert.equal(reopened.items[0].slides[0].text,'Give Online\nUpdated details');
    assert.throws(()=>library.deleteDocument(presentation.id),/used by saved service/i);
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
    const matches=library.searchBible(translation.id,'beginning earth',5);
    assert.equal(matches[0].reference,'Genesis 1:1');assert.equal(matches[0].source,'local');
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
    assert.equal(video.loop,1);
    assert.deepEqual(library.listMedia().map(item=>item.type),['Video','Image']);
    assert.deepEqual(library.listMedia().map(item=>item.missing),[true,false]);
    assert.equal(library.getMediaPath(image.id),join(directory,'welcome.png'));
    const motion=library.updateMedia(video.id,{title:'Ambient Announcements',type:'Motion Background',duration:12.5,width:1920,height:1080});
    assert.equal(motion.title,'Ambient Announcements');
    assert.equal(motion.type,'Motion Background');
    assert.equal(motion.loop,1);assert.equal(motion.muted,1);
    assert.equal(motion.duration,12.5);assert.equal(motion.width,1920);assert.equal(motion.height,1080);
    const unavailable=library.updateMedia(video.id,{playback_status:'unavailable',playback_error:'Playback unavailable on this system'});
    assert.equal(unavailable.playback_status,'unavailable');
    assert.equal(unavailable.playback_error,'Playback unavailable on this system');
    const service=library.saveService({name:'Media Service',items:[{id:'media-db-video-1',databaseId:video.id,title:video.title,type:'Media',mediaType:'Video',url:'/media/video-1'}]});
    assert.equal(library.getService(service.id).items[0].missing,true);
    assert.equal(library.getService(service.id).items[0].detail,'Missing media');
    assert.equal(library.getService(service.id).items[0].mediaType,'Video');
    assert.equal(library.getService(service.id).items[0].mediaKind,'Motion Background');
    assert.equal(library.getService(service.id).items[0].loop,true);
    assert.equal(library.getService(service.id).items[0].playbackStatus,'unavailable');
    assert.equal(library.deleteMedia(video.id),true);
  }finally{library.close();rmSync(directory,{recursive:true,force:true})}
});

test('creates a default theme and persists reusable theme layouts',()=>{
  const directory=mkdtempSync(join(tmpdir(),'slc-presenter-theme-'));
  const library=openPresenterLibrary(join(directory,'presenter.sqlite'));
  try{
    const defaults=library.listThemes();
    assert.equal(defaults.length,2);assert.equal(defaults.find(theme=>theme.id==='slc-default-theme').isDefault,true);
    assert.equal(defaults.find(theme=>theme.id==='slc-default-theme').canvasWidth,1920);assert.equal(defaults.find(theme=>theme.id==='slc-default-theme').background.type,'solid');
    const broadcast=defaults.find(theme=>theme.id==='slc-broadcast-lower-third');
    assert.equal(broadcast.layoutType,'Lower Third');assert.equal(broadcast.background.type,'transparent');
    assert.equal(library.getThemeDefaults().songThemeId,'');
    const saved=library.saveTheme({name:'Broadcast Scripture',contentType:'Scripture',layoutType:'Lower Third',canvasWidth:1920,canvasHeight:1080,background:{type:'transparent'},elements:[{id:'verse',type:'dynamic',binding:'primary',x:120,y:790,width:1300,height:130,style:{fontSize:54,color:'#ffffff'}}]});
    assert.equal(saved.layoutType,'Lower Third');assert.equal(saved.background.type,'transparent');
    assert.equal(library.listThemes().length,3);
    assert.equal(library.setThemeDefault('Scripture',saved.id).scriptureThemeId,saved.id);
    assert.equal(library.setThemeDefault('Presentation',saved.id).presentationThemeId,saved.id);
    assert.equal(library.setThemeDefault('General',saved.id).generalThemeId,saved.id);
    assert.equal(library.getThemeDefaults().songThemeId,'');
    assert.throws(()=>library.deleteTheme(saved.id),/content default/i);
    library.setThemeDefault('General',defaults[0].id);library.setThemeDefault('Scripture',defaults[0].id);library.setThemeDefault('Presentation',defaults[0].id);
    assert.equal(library.deleteTheme(saved.id),true);
    assert.throws(()=>library.deleteTheme(defaults[0].id),/(default|built-in) theme/i);
  }finally{library.close();rmSync(directory,{recursive:true,force:true})}
});
