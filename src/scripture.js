const normalize=value=>String(value??'').toLowerCase().replace(/[.]/g,'').replace(/\s+/g,' ').trim();

const aliases={
  genesis:['gen','ge','gn'],exodus:['exod','exo','ex'],leviticus:['lev','le','lv'],numbers:['num','nu','nm'],deuteronomy:['deut','deu','dt'],
  joshua:['josh','jos'],judges:['judg','jdg'],ruth:['ru'],psalm:['psalms','ps','psa','psm'],proverbs:['prov','pro','pr'],ecclesiastes:['eccl','ecc'],
  isaiah:['isa','is'],jeremiah:['jer','je'],lamentations:['lam','la'],ezekiel:['ezek','eze'],daniel:['dan','da'],hosea:['hos'],joel:['joe'],amos:['am'],
  obadiah:['obad','ob'],jonah:['jon'],micah:['mic'],nahum:['nah'],habakkuk:['hab'],zephaniah:['zeph','zep'],haggai:['hag'],zechariah:['zech','zec'],malachi:['mal'],
  matthew:['matt','mat','mt'],mark:['mk','mrk'],luke:['lk','luk'],john:['jn','joh'],acts:['act'],romans:['rom','ro'],
  '1 corinthians':['1 cor','1cor','1 co','1co'], '2 corinthians':['2 cor','2cor','2 co','2co'],galatians:['gal'],ephesians:['eph'],philippians:['phil','php'],colossians:['col'],
  '1 thessalonians':['1 thess','1thess','1 thes','1thes'], '2 thessalonians':['2 thess','2thess','2 thes','2thes'],
  '1 timothy':['1 tim','1tim','1 ti','1ti'], '2 timothy':['2 tim','2tim','2 ti','2ti'],titus:['tit'],philemon:['philem','phm'],hebrews:['heb'],james:['jas','jam'],
  '1 peter':['1 pet','1pet','1 pe','1pe'], '2 peter':['2 pet','2pet','2 pe','2pe'], '1 john':['1 jn','1jn','1 joh','1joh'], '2 john':['2 jn','2jn'], '3 john':['3 jn','3jn'],
  jude:['jud'],revelation:['rev','re','the revelation']
};

export function resolveBook(input,books){
  const wanted=normalize(input).replace(/\s+/g,'');
  if(!wanted)return null;
  const candidates=[];
  for(const item of books){
    const names=[item.book,...(aliases[normalize(item.book)]||[])];
    for(const name of names){const key=normalize(name).replace(/\s+/g,'');if(key===wanted)return item.book;if(key.startsWith(wanted))candidates.push(item.book)}
  }
  return [...new Set(candidates)].length===1?candidates[0]:null;
}

export function parseScriptureReference(input,books){
  const raw=String(input??'').trim();
  if(!raw)return{state:'empty'};
  const match=raw.match(/^\s*((?:[1-3]\s*)?[a-z]+(?:\s+[a-z]+)*)\s*(\d+)?\s*(?::\s*(\d*)\s*(?:[-–—]\s*(\d*)\s*)?)?$/i);
  if(!match)return{state:'invalid'};
  const book=resolveBook(match[1],books);
  if(!book)return{state:'incomplete',bookQuery:match[1]};
  if(!match[2])return{state:'book',book};
  const chapter=Number(match[2]);
  if(!chapter)return{state:'invalid'};
  if(!raw.includes(':'))return{state:'chapter',book,chapter};
  if(match[3]==='')return{state:'chapter',book,chapter,incomplete:true};
  const verseStart=Number(match[3]),verseEnd=match[4]?Number(match[4]):verseStart;
  if(!verseStart||!verseEnd||verseEnd<verseStart)return{state:'invalid'};
  return{state:'verses',book,chapter,verseStart,verseEnd};
}

export function formatReference(book,chapter,verses=[]){
  if(!verses.length)return`${book} ${chapter}`;
  const numbers=verses.map(item=>item.verse).sort((a,b)=>a-b),first=numbers[0],last=numbers.at(-1),contiguous=numbers.every((number,index)=>!index||number===numbers[index-1]+1);
  return`${book} ${chapter}:${contiguous?(last===first?first:`${first}–${last}`):numbers.join(', ')}`;
}

export function scriptureItem({translation,book,chapter,verses}){
  const ordered=[...verses].sort((a,b)=>a.verse-b.verse),reference=formatReference(book,chapter,ordered),code=translation?.code||'';
  const slides=[];let group=[];let characters=0;
  const flush=()=>{if(!group.length)return;const slideReference=formatReference(book,chapter,group);slides.push({name:slideReference,text:group.map(item=>item.text).join('\n'),reference:`${slideReference}${code?` (${code})`:''}`,scripture:{translation:code,translationId:translation?.id,book,chapter,verseStart:group[0].verse,verseEnd:group.at(-1).verse,reference:slideReference,verses:group.map(item=>({...item}))}});group=[];characters=0};
  for(const verse of ordered){const length=verse.text.length;if(group.length&&(characters+length>220||group.length>=3))flush();group.push(verse);characters+=length;if(length>180)flush()}
  flush();
  return{id:`bible-${translation?.id}-${book}-${chapter}-${ordered[0]?.verse}-${ordered.at(-1)?.verse}`,title:reference,type:'Scripture',detail:code,translation:code,translationId:translation?.id,book,chapter,verseStart:ordered[0]?.verse,verseEnd:ordered.at(-1)?.verse,reference,verses:ordered,slides,themeId:'scripture-default'};
}
