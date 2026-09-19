import { DatabaseSync } from 'node:sqlite';
import { existsSync, readFileSync } from 'node:fs';
import { basename, dirname, extname, join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { parseLyrics } from '../src/song-parser.js';

const clean=value=>String(value??'').replace(/\r\n/g,'\n').trim();
const key=value=>String(value).toLowerCase().replace(/[^a-z0-9]/g,'');
const first=(columns,names)=>names.map(key).find(name=>columns.has(name));
function sectionsFrom(text){
  const blocks=clean(text).split(/\n\s*\n+/).filter(Boolean);
  return (blocks.length?blocks:[clean(text)]).map((block,index)=>{
    const lines=block.split('\n');
    const labelled=/^(verse|chorus|bridge|intro|outro|pre[- ]?chorus|tag|ending)(\s*\d+)?\s*[:.-]?$/i.test(lines[0]?.trim());
    return {label:labelled?lines.shift().trim():`Section ${index+1}`,text:lines.join('\n').trim()};
  }).filter(section=>section.text);
}
function rtfToText(rtf){
  const destinations=new Set(['fonttbl','colortbl','stylesheet','info','pict','object','header','footer','generator','listtable','listoverridetable','xmlnstbl','themedata','datastore']);
  let output='',index=0,skip=false;const stack=[];
  while(index<rtf.length){const char=rtf[index];
    if(char==='{'){stack.push(skip);index++;continue}
    if(char==='}'){skip=stack.pop()??false;index++;continue}
    if(char!=='\\'){if(!skip&&char!=='\r'&&char!=='\n')output+=char;index++;continue}
    index++;const escaped=rtf[index];
    if(['\\','{','}'].includes(escaped)){if(!skip)output+=escaped;index++;continue}
    if(escaped==="'"){const hex=rtf.slice(index+1,index+3);if(!skip&&/^[0-9a-f]{2}$/i.test(hex))output+=String.fromCharCode(parseInt(hex,16));index+=3;continue}
    if(escaped==='*'){skip=true;index++;continue}
    const match=rtf.slice(index).match(/^([a-z]+)(-?\d+)? ?/i);if(!match){index++;continue}index+=match[0].length;const word=match[1].toLowerCase(),number=match[2]===undefined?null:Number(match[2]);
    if(destinations.has(word)){skip=true;continue}if(skip)continue;
    if(word==='par'||word==='line')output+='\n';else if(word==='page'||word==='sect')output+='\n\n';else if(word==='tab')output+='\t';else if(word==='emdash')output+='—';else if(word==='endash')output+='–';else if(word==='lquote')output+='‘';else if(word==='rquote')output+='’';else if(word==='ldblquote')output+='“';else if(word==='rdblquote')output+='”';else if(word==='bullet')output+='•';else if(word==='u'&&number!==null){output+=String.fromCharCode(number<0?number+65536:number);if(rtf[index]&&rtf[index]!=='\\'&&rtf[index]!=='{'&&rtf[index]!=='}')index++}
  }
  return output.replace(/\u00a0/g,' ').replace(/[ \t]+\n/g,'\n').replace(/\n{3,}/g,'\n\n').trim();
}
function normalizeSong(value,index,source){
  const title=clean(value.title||value.name||value.songtitle);
  const lyrics=clean(value.lyrics||value.words||value.text||value.content);
  if(!title||!lyrics)return null;
  return {source,sourceKey:clean(value.id||value.songid||value.guid||`${title}:${index}`),title,alternateTitle:clean(value.alternatetitle||value.title2),author:clean(value.author||value.authors||value.writer||value.writers),copyright:clean(value.copyright),ccli:clean(value.ccli||value.cclinumber||value.songnumber),sections:sectionsFrom(lyrics)};
}
function songsFromJson(value,source){
  const found=[];const seen=new Set();
  function visit(node){if(!node||typeof node!=='object'||seen.has(node))return;seen.add(node);if(!Array.isArray(node)){const lowered=Object.fromEntries(Object.entries(node).map(([k,v])=>[key(k),v]));const song=normalizeSong(lowered,found.length,source);if(song)found.push(song)}for(const child of Array.isArray(node)?node:Object.values(node))visit(child)}
  visit(value);return found;
}
function bibleFromJson(value,fileName){const meta=value.translation||value.meta||{},fileTitle=clean(basename(fileName,extname(fileName))),acronym=fileTitle.split(/[^A-Za-z0-9]+/).filter(Boolean).map(word=>word[0]).join('').slice(0,12),code=clean(meta.abbreviation||meta.abbrev||meta.code||value.abbreviation||acronym||fileTitle.slice(0,12)).toUpperCase(),name=clean(meta.name||meta.title||value.name||fileTitle||code),rows=[];const add=(book,chapter,verse,text)=>{text=clean(text);if(book&&Number(chapter)>0&&Number(verse)>0&&text)rows.push({book:clean(book),chapter:Number(chapter),verse:Number(verse),text})};if(Array.isArray(value)){value.forEach(item=>add(item.book||item.book_name,item.chapter,item.verse,item.text||item.content))}else if(Array.isArray(value.verses)){value.verses.forEach(item=>add(item.book||item.book_name,item.chapter,item.verse,item.text||item.content))}else if(Array.isArray(value.books)){value.books.forEach(book=>(book.chapters||[]).forEach((chapter,chapterIndex)=>{const verses=Array.isArray(chapter)?chapter:chapter.verses||[];verses.forEach((verse,verseIndex)=>add(book.name||book.book||book.title,chapter.number||chapter.chapter||chapterIndex+1,verse.number||verse.verse||verseIndex+1,typeof verse==='string'?verse:verse.text||verse.content))}))}else if(value&&typeof value==='object'){for(const[book,chapters]of Object.entries(value)){if(!chapters||typeof chapters!=='object'||Array.isArray(chapters))continue;for(const[chapter,verses]of Object.entries(chapters)){if(!/^\d+$/.test(chapter)||!verses||typeof verses!=='object'||Array.isArray(verses))continue;for(const[verse,text]of Object.entries(verses)){if(/^\d+$/.test(verse)&&typeof text==='string')add(book,chapter,verse,text)}}}}if(!code||!name||!rows.length)throw new Error('The Bible JSON file does not contain a supported translation structure.');return{code,name,copyright:clean(meta.copyright||value.copyright),verses:rows}}
function songsFromSqlite(path,source){
  const db=new DatabaseSync(path,{readOnly:true});
  try{
    const tables=db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all().map(row=>row.name);
    const results=[];
    for(const table of tables){
      const info=db.prepare(`PRAGMA table_info(${JSON.stringify(table)})`).all();
      const byKey=new Map(info.map(column=>[key(column.name),column.name]));
      const titleKey=first(byKey,['title','name','songtitle']);
      const lyricKey=first(byKey,['lyrics','words','text','content']);
      if(!titleKey||!lyricKey)continue;
      const rows=db.prepare(`SELECT * FROM ${JSON.stringify(table)}`).all();
      for(const row of rows){const lowered=Object.fromEntries(Object.entries(row).map(([k,v])=>[key(k),v]));const song=normalizeSong(lowered,results.length,source);if(song)results.push(song)}
    }
    return results;
  }finally{db.close()}
}
function songsFromEasyWorship(songsPath){
  const wordsPath=join(dirname(songsPath),'SongWords.db');
  if(!existsSync(wordsPath))throw new Error('EasyWorship SongWords.db must be beside Songs.db.');
  const songDb=new DatabaseSync(songsPath,{readOnly:true}),wordDb=new DatabaseSync(wordsPath,{readOnly:true});
  try{
    const words=new Map(wordDb.prepare('SELECT song_id,words FROM word').all().map(row=>[row.song_id,rtfToText(String(row.words??''))]));
    return songDb.prepare('SELECT rowid,song_item_uid,title,author,copyright,administrator,reference_number FROM song').all().map((row,index)=>normalizeSong({id:row.song_item_uid||row.rowid,title:row.title,author:row.author,copyright:row.copyright,ccli:row.reference_number,words:words.get(row.rowid)},index,'EasyWorship')).filter(Boolean);
  }finally{songDb.close();wordDb.close()}
}
export function openPresenterLibrary(path){
  const db=new DatabaseSync(resolve(path));
  const integrity=db.prepare('PRAGMA integrity_check').get();
  if(!integrity||Object.values(integrity)[0]!=='ok'){db.close();throw new Error('The Presenter database failed its integrity check. Your data was not modified.')}
  db.exec(`PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL;
    CREATE TABLE IF NOT EXISTS presenter_song(id TEXT PRIMARY KEY,title TEXT NOT NULL,alternate_title TEXT NOT NULL DEFAULT '',author TEXT NOT NULL DEFAULT '',copyright TEXT NOT NULL DEFAULT '',ccli_number TEXT NOT NULL DEFAULT '',source_app TEXT NOT NULL,source_key TEXT NOT NULL,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL,raw_lyrics TEXT NOT NULL DEFAULT '',UNIQUE(source_app,source_key));
    CREATE TABLE IF NOT EXISTS presenter_song_section(id TEXT PRIMARY KEY,song_id TEXT NOT NULL REFERENCES presenter_song(id) ON DELETE CASCADE,position INTEGER NOT NULL,label TEXT NOT NULL,text TEXT NOT NULL,UNIQUE(song_id,position));
    CREATE TABLE IF NOT EXISTS presenter_document(id TEXT PRIMARY KEY,kind TEXT NOT NULL,title TEXT NOT NULL,reference TEXT NOT NULL DEFAULT '',alignment TEXT NOT NULL DEFAULT 'center',font_size INTEGER NOT NULL DEFAULT 42,slides_json TEXT NOT NULL,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS presenter_service(id TEXT PRIMARY KEY,name TEXT NOT NULL,items_json TEXT NOT NULL,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS bible_translation(id TEXT PRIMARY KEY,code TEXT NOT NULL UNIQUE,name TEXT NOT NULL,copyright TEXT NOT NULL DEFAULT '',source_path TEXT NOT NULL,created_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS bible_verse(translation_id TEXT NOT NULL REFERENCES bible_translation(id) ON DELETE CASCADE,book TEXT NOT NULL,book_position INTEGER NOT NULL,chapter INTEGER NOT NULL,verse INTEGER NOT NULL,text TEXT NOT NULL,PRIMARY KEY(translation_id,book,chapter,verse));
    CREATE TABLE IF NOT EXISTS presenter_media(id TEXT PRIMARY KEY,title TEXT NOT NULL,type TEXT NOT NULL,path TEXT NOT NULL,original_path TEXT NOT NULL,mime TEXT NOT NULL DEFAULT '',created_at INTEGER NOT NULL,duration REAL NOT NULL DEFAULT 0,width INTEGER NOT NULL DEFAULT 0,height INTEGER NOT NULL DEFAULT 0,thumbnail_path TEXT NOT NULL DEFAULT '',modified_at INTEGER NOT NULL DEFAULT 0,loop INTEGER NOT NULL DEFAULT 0,muted INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS presenter_theme(id TEXT PRIMARY KEY,name TEXT NOT NULL,content_type TEXT NOT NULL,layout_type TEXT NOT NULL,canvas_width INTEGER NOT NULL,canvas_height INTEGER NOT NULL,background_json TEXT NOT NULL,elements_json TEXT NOT NULL,is_default INTEGER NOT NULL DEFAULT 0,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS presenter_setting(key TEXT PRIMARY KEY,value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS presenter_import(id TEXT PRIMARY KEY,source_app TEXT NOT NULL,source_path TEXT NOT NULL,imported_at INTEGER NOT NULL,found_count INTEGER NOT NULL,imported_count INTEGER NOT NULL,skipped_count INTEGER NOT NULL);`);
  const songColumns=new Set(db.prepare('PRAGMA table_info(presenter_song)').all().map(column=>column.name));
  if(!songColumns.has('raw_lyrics'))db.exec("ALTER TABLE presenter_song ADD COLUMN raw_lyrics TEXT NOT NULL DEFAULT ''");
  if(!songColumns.has('theme_id'))db.exec("ALTER TABLE presenter_song ADD COLUMN theme_id TEXT NOT NULL DEFAULT ''");
  if(!songColumns.has('background_id'))db.exec("ALTER TABLE presenter_song ADD COLUMN background_id TEXT NOT NULL DEFAULT ''");
  const mediaColumns=new Set(db.prepare('PRAGMA table_info(presenter_media)').all().map(column=>column.name));
  for(const[column,declaration]of Object.entries({duration:'REAL NOT NULL DEFAULT 0',width:'INTEGER NOT NULL DEFAULT 0',height:'INTEGER NOT NULL DEFAULT 0',thumbnail_path:"TEXT NOT NULL DEFAULT ''",modified_at:'INTEGER NOT NULL DEFAULT 0',loop:'INTEGER NOT NULL DEFAULT 0',muted:'INTEGER NOT NULL DEFAULT 0'}))if(!mediaColumns.has(column))db.exec(`ALTER TABLE presenter_media ADD COLUMN ${column} ${declaration}`);
  const schemaVersion=db.prepare('PRAGMA user_version').get();if(Number(Object.values(schemaVersion)[0])<2)db.exec('PRAGMA user_version=2');
  if(!db.prepare('SELECT id FROM presenter_theme WHERE is_default=1').get()){const now=Date.now();db.prepare('INSERT INTO presenter_theme VALUES(?,?,?,?,?,?,?,?,?,?,?)').run('slc-default-theme','SLC Default','All','Full Screen',1920,1080,JSON.stringify({type:'solid',color:'#000000',fit:'cover',position:'center'}),JSON.stringify([{id:'primary',type:'dynamic',binding:'primary',x:180,y:180,width:1560,height:620,zIndex:1,visible:true,style:{fontFamily:'Arial',fallbackFont:'sans-serif',fontSize:72,fontWeight:700,color:'#ffffff',align:'center',verticalAlign:'middle',lineHeight:1.2,autoFit:true,italic:false,underline:false,shadow:{x:0,y:4,blur:12,color:'#000000',opacity:.7},outline:{width:0,color:'#000000'}}},{id:'secondary',type:'dynamic',binding:'secondary',x:240,y:830,width:1440,height:100,zIndex:2,visible:true,style:{fontFamily:'Arial',fallbackFont:'sans-serif',fontSize:34,fontWeight:700,color:'#ffc431',align:'center',verticalAlign:'middle',lineHeight:1.2,autoFit:true}}]),1,now,now)}
  function listSongs(){return db.prepare(`SELECT s.*,group_concat(sec.label||char(30)||sec.text,char(31)) sections FROM presenter_song s LEFT JOIN presenter_song_section sec ON sec.song_id=s.id GROUP BY s.id ORDER BY lower(s.title)`).all().map(row=>({...row,sections:row.sections?row.sections.split(String.fromCharCode(31)).map((part,index)=>{const[label,text]=part.split(String.fromCharCode(30));return{name:label,text,position:index}}):[]}))}
  function saveSong(input){
    const title=clean(input?.title);if(!title)throw new Error('Song title is required.');
    const sections=(input.sections||[]).map((section,index)=>({label:clean(section.label)||`Section ${index+1}`,text:clean(section.text)})).filter(section=>section.text);
    if(!sections.length)throw new Error('Add at least one section with lyrics.');
    const rawLyrics=clean(input.rawLyrics??input.raw_lyrics),now=Date.now(),id=input.id||randomUUID(),existing=db.prepare('SELECT id,source_app,source_key,created_at FROM presenter_song WHERE id=?').get(id);
    db.exec('BEGIN IMMEDIATE');
    try{
      if(existing)db.prepare('UPDATE presenter_song SET title=?,alternate_title=?,author=?,copyright=?,ccli_number=?,raw_lyrics=?,theme_id=?,background_id=?,updated_at=? WHERE id=?').run(title,clean(input.alternate_title),clean(input.author),clean(input.copyright),clean(input.ccli_number),rawLyrics,clean(input.theme_id||input.themeId),clean(input.background_id||input.backgroundId),now,id);
      else db.prepare('INSERT INTO presenter_song(id,title,alternate_title,author,copyright,ccli_number,source_app,source_key,created_at,updated_at,raw_lyrics,theme_id,background_id) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)').run(id,title,clean(input.alternate_title),clean(input.author),clean(input.copyright),clean(input.ccli_number),'SLC Presenter',id,now,now,rawLyrics,clean(input.theme_id||input.themeId),clean(input.background_id||input.backgroundId));
      db.prepare('DELETE FROM presenter_song_section WHERE song_id=?').run(id);
      sections.forEach((section,index)=>db.prepare('INSERT INTO presenter_song_section VALUES(?,?,?,?,?)').run(randomUUID(),id,index,section.label,section.text));
      db.exec('COMMIT');return listSongs().find(song=>song.id===id);
    }catch(error){db.exec('ROLLBACK');throw error}
  }
  function deleteSong(id){const usedBy=db.prepare('SELECT name,items_json FROM presenter_service').all().filter(service=>{try{return JSON.parse(service.items_json).some(item=>item.type==='Song'&&item.databaseId===id)}catch{return false}}).map(service=>service.name);if(usedBy.length)throw new Error(`This song is used by saved service${usedBy.length===1?'':'s'}: ${usedBy.join(', ')}. Remove it from those services before deleting it.`);db.exec('BEGIN IMMEDIATE');try{db.prepare('DELETE FROM presenter_song_section WHERE song_id=?').run(id);const result=db.prepare('DELETE FROM presenter_song WHERE id=?').run(id);db.exec('COMMIT');return result.changes>0}catch(error){db.exec('ROLLBACK');throw error}}
  function listDocuments(kind){return db.prepare('SELECT * FROM presenter_document WHERE (? IS NULL OR kind=?) ORDER BY lower(title)').all(kind??null,kind??null).map(row=>({...row,slides:JSON.parse(row.slides_json)}))}
  function saveDocument(input){const kind=input?.kind==='Scripture'?'Scripture':'Presentation',title=clean(input?.title),slides=(input?.slides||[]).map((item,index)=>({name:clean(item.name)||`Slide ${index+1}`,text:clean(item.text),reference:clean(item.reference||input.reference)})).filter(item=>item.text);if(!title)throw new Error('Title or Scripture reference is required.');if(!slides.length)throw new Error('Add at least one slide with text.');const now=Date.now(),id=input.id||randomUUID(),existing=db.prepare('SELECT id FROM presenter_document WHERE id=?').get(id),values=[kind,title,clean(input.reference),['left','center','right'].includes(input.alignment)?input.alignment:'center',Math.max(18,Math.min(96,Number(input.font_size)||42)),JSON.stringify(slides),now,id];if(existing)db.prepare('UPDATE presenter_document SET kind=?,title=?,reference=?,alignment=?,font_size=?,slides_json=?,updated_at=? WHERE id=?').run(...values);else db.prepare('INSERT INTO presenter_document VALUES(?,?,?,?,?,?,?,?,?)').run(id,kind,title,clean(input.reference),values[3],values[4],JSON.stringify(slides),now,now);return listDocuments().find(item=>item.id===id)}
  function deleteDocument(id){return db.prepare('DELETE FROM presenter_document WHERE id=?').run(id).changes>0}
  function listServices(){return db.prepare('SELECT id,name,created_at,updated_at FROM presenter_service ORDER BY updated_at DESC').all()}
  function getService(id){const row=db.prepare('SELECT * FROM presenter_service WHERE id=?').get(id);if(!row)return null;const songsById=new Map(listSongs().map(song=>[song.id,song])),mediaById=new Map(listMedia().map(media=>[media.id,media])),items=JSON.parse(row.items_json).map(item=>{if(item.type==='Song'&&item.databaseId){const song=songsById.get(item.databaseId);if(!song)return{...item,missing:true,detail:'Missing song'};const rawLyrics=song.raw_lyrics||song.sections.map(section=>`[${section.name}]\n\n${section.text}`).join('\n\n'),slides=parseLyrics(rawLyrics).slides;return{...item,title:song.title,author:song.author,detail:[song.author,song.source_app].filter(Boolean).join(' · ')||'Local song',rawLyrics,sections:song.sections,slides,missing:false}}if(item.type==='Media'&&item.databaseId){const media=mediaById.get(item.databaseId);return media?{...item,title:media.title,mediaType:media.type==='Image'?'Image':'Video',mediaKind:media.type,detail:media.missing?'Missing media':media.type,url:`/media/${media.id}`,duration:Number(media.duration)||0,width:Number(media.width)||0,height:Number(media.height)||0,originalPath:media.original_path||'',createdAt:Number(media.created_at)||0,loop:Boolean(media.loop),muted:Boolean(media.muted),missing:media.missing}:{...item,missing:true,detail:'Missing media'}}return item});return{...row,items}}
  function saveService(input){const name=clean(input?.name);if(!name)throw new Error('Service name is required.');const id=input.id||randomUUID(),now=Date.now(),existing=db.prepare('SELECT created_at FROM presenter_service WHERE id=?').get(id),items=JSON.stringify(input.items||[]);if(existing)db.prepare('UPDATE presenter_service SET name=?,items_json=?,updated_at=? WHERE id=?').run(name,items,now,id);else db.prepare('INSERT INTO presenter_service VALUES(?,?,?,?,?)').run(id,name,items,now,now);return getService(id)}
  function listTranslations(){return db.prepare('SELECT id,code,name,copyright FROM bible_translation ORDER BY lower(name)').all()}
  function listBibleBooks(translationId){return db.prepare('SELECT book,min(book_position) position,max(chapter) chapters FROM bible_verse WHERE translation_id=? GROUP BY book ORDER BY position').all(translationId)}
  function listBibleVerses(translationId,book,chapter){return db.prepare('SELECT verse,text FROM bible_verse WHERE translation_id=? AND book=? AND chapter=? ORDER BY verse').all(translationId,book,Number(chapter))}
  function importBible(path){if(extname(path).toLowerCase()!=='.json')throw new Error('Choose a supported Bible JSON file.');const parsed=bibleFromJson(JSON.parse(readFileSync(path,'utf8')),path),existing=db.prepare('SELECT id FROM bible_translation WHERE code=?').get(parsed.code),id=existing?.id||randomUUID(),now=Date.now(),books=[...new Set(parsed.verses.map(item=>item.book))];db.exec('BEGIN IMMEDIATE');try{if(existing){db.prepare('DELETE FROM bible_verse WHERE translation_id=?').run(id);db.prepare('UPDATE bible_translation SET name=?,copyright=?,source_path=?,created_at=? WHERE id=?').run(parsed.name,parsed.copyright,path,now,id)}else db.prepare('INSERT INTO bible_translation VALUES(?,?,?,?,?,?)').run(id,parsed.code,parsed.name,parsed.copyright,path,now);const insert=db.prepare('INSERT INTO bible_verse VALUES(?,?,?,?,?,?)');parsed.verses.forEach(item=>insert.run(id,item.book,books.indexOf(item.book)+1,item.chapter,item.verse,item.text));db.exec('COMMIT');return{id,code:parsed.code,name:parsed.name,verseCount:parsed.verses.length,bookCount:books.length}}catch(error){db.exec('ROLLBACK');throw error}}
  function listMedia(){return db.prepare('SELECT * FROM presenter_media ORDER BY created_at DESC,lower(title)').all().map(item=>({...item,missing:!existsSync(item.path)}))}
  function addMedia(input){const id=clean(input.id)||randomUUID(),title=clean(input.title),now=Date.now();if(!title||!input.path)throw new Error('Media title and path are required.');const type=['Video','Motion Background'].includes(input.type)?input.type:'Image';db.prepare('INSERT INTO presenter_media(id,title,type,path,original_path,mime,created_at,duration,width,height,thumbnail_path,modified_at,loop,muted) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(id,title,type,input.path,input.originalPath||input.path,input.mime||'',now,Number(input.duration)||0,Number(input.width)||0,Number(input.height)||0,clean(input.thumbnailPath),now,type==='Motion Background'?1:Number(Boolean(input.loop)),type==='Motion Background'?1:Number(Boolean(input.muted)));return db.prepare('SELECT * FROM presenter_media WHERE id=?').get(id)}
  function updateMedia(id,input){const current=db.prepare('SELECT * FROM presenter_media WHERE id=?').get(id);if(!current)throw new Error('Media item was not found.');const type=['Image','Video','Motion Background'].includes(input.type)?input.type:current.type,title=clean(input.title)||current.title,loop=type==='Motion Background'?1:Number(input.loop??current.loop),muted=type==='Motion Background'?1:Number(input.muted??current.muted);db.prepare('UPDATE presenter_media SET title=?,type=?,duration=?,width=?,height=?,thumbnail_path=?,modified_at=?,loop=?,muted=? WHERE id=?').run(title,type,Number(input.duration??current.duration)||0,Number(input.width??current.width)||0,Number(input.height??current.height)||0,clean(input.thumbnail_path??current.thumbnail_path),Date.now(),loop,muted,id);return listMedia().find(item=>item.id===id)}
  function getMediaPath(id){return db.prepare('SELECT path FROM presenter_media WHERE id=?').get(id)?.path||null}
  function deleteMedia(id){return db.prepare('DELETE FROM presenter_media WHERE id=?').run(id).changes>0}
  const mapTheme=row=>({...row,canvasWidth:row.canvas_width,canvasHeight:row.canvas_height,contentType:row.content_type,layoutType:row.layout_type,isDefault:Boolean(row.is_default),background:JSON.parse(row.background_json),elements:JSON.parse(row.elements_json),createdAt:row.created_at,updatedAt:row.updated_at});
  function listThemes(){return db.prepare('SELECT * FROM presenter_theme ORDER BY is_default DESC,lower(name)').all().map(mapTheme)}
  function saveTheme(input){const name=clean(input?.name);if(!name)throw new Error('Theme name is required.');const id=clean(input.id)||randomUUID(),now=Date.now(),current=db.prepare('SELECT * FROM presenter_theme WHERE id=?').get(id),width=Math.max(320,Math.min(7680,Number(input.canvasWidth)||1920)),height=Math.max(240,Math.min(4320,Number(input.canvasHeight)||1080)),background=input.background&&typeof input.background==='object'?input.background:{type:'solid',color:'#000000'},elements=Array.isArray(input.elements)?input.elements:[];if(current)db.prepare('UPDATE presenter_theme SET name=?,content_type=?,layout_type=?,canvas_width=?,canvas_height=?,background_json=?,elements_json=?,updated_at=? WHERE id=?').run(name,clean(input.contentType)||'All',clean(input.layoutType)||'Full Screen',width,height,JSON.stringify(background),JSON.stringify(elements),now,id);else db.prepare('INSERT INTO presenter_theme VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(id,name,clean(input.contentType)||'All',clean(input.layoutType)||'Full Screen',width,height,JSON.stringify(background),JSON.stringify(elements),0,now,now);return mapTheme(db.prepare('SELECT * FROM presenter_theme WHERE id=?').get(id))}
  function deleteTheme(id){const theme=db.prepare('SELECT is_default FROM presenter_theme WHERE id=?').get(id);if(!theme)return false;if(theme.is_default)throw new Error('The default theme cannot be deleted.');return db.prepare('DELETE FROM presenter_theme WHERE id=?').run(id).changes>0}
  function getThemeDefaults(){const rows=db.prepare("SELECT key,value FROM presenter_setting WHERE key IN ('default_song_theme','default_scripture_theme')").all(),settings=Object.fromEntries(rows.map(row=>[row.key,row.value]));return{songThemeId:settings.default_song_theme||'slc-default-theme',scriptureThemeId:settings.default_scripture_theme||'slc-default-theme'}}
  function setThemeDefault(kind,id){if(!db.prepare('SELECT id FROM presenter_theme WHERE id=?').get(id))throw new Error('Theme was not found.');const keyName=kind==='Scripture'?'default_scripture_theme':'default_song_theme';db.prepare('INSERT INTO presenter_setting(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(keyName,id);return getThemeDefaults()}
  function importFile(path,sourceApp='Auto detect'){
    if(!existsSync(path))throw new Error('The selected file no longer exists.');
    const extension=extname(path).toLowerCase();let source=sourceApp==='Auto detect'?(extension==='.json'?'JSON':extension==='.db'?'EasyWorship / SQLite':'SQLite'):sourceApp;let songs;
    if(extension==='.json')songs=songsFromJson(JSON.parse(readFileSync(path,'utf8')),source);else if(basename(path).toLowerCase()==='songs.db'&&existsSync(join(dirname(path),'SongWords.db'))){source='EasyWorship';songs=songsFromEasyWorship(path)}else if(['.db','.sqlite','.sqlite3'].includes(extension))songs=songsFromSqlite(path,source);else throw new Error('Choose a .db, .sqlite, .sqlite3, or .json library file.');
    const now=Date.now();let imported=0,skipped=0;db.exec('BEGIN IMMEDIATE');
    try{for(const song of songs){const existing=db.prepare('SELECT id FROM presenter_song WHERE source_app=? AND source_key=?').get(song.source,song.sourceKey);if(existing){skipped++;continue}const id=randomUUID(),rawLyrics=song.sections.map(section=>`[${section.label}]\n\n${section.text}`).join('\n\n');db.prepare('INSERT INTO presenter_song(id,title,alternate_title,author,copyright,ccli_number,source_app,source_key,created_at,updated_at,raw_lyrics) VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(id,song.title,song.alternateTitle,song.author,song.copyright,song.ccli,song.source,song.sourceKey,now,now,rawLyrics);song.sections.forEach((section,index)=>db.prepare('INSERT INTO presenter_song_section VALUES(?,?,?,?,?)').run(randomUUID(),id,index,section.label,section.text));imported++}const result={id:randomUUID(),source,found:songs.length,imported,skipped};db.prepare('INSERT INTO presenter_import VALUES(?,?,?,?,?,?,?)').run(result.id,source,path,now,result.found,result.imported,result.skipped);db.exec('COMMIT');return result}catch(error){db.exec('ROLLBACK');throw error}
  }
  return {listSongs,saveSong,deleteSong,listDocuments,saveDocument,deleteDocument,listServices,getService,saveService,listTranslations,listBibleBooks,listBibleVerses,importBible,listMedia,addMedia,updateMedia,getMediaPath,deleteMedia,listThemes,saveTheme,deleteTheme,getThemeDefaults,setThemeDefault,importFile,close:()=>db.close()};
}
