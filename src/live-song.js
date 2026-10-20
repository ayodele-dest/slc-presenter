import{parseLyrics}from'./song-parser.js';

const baseName=name=>String(name||'Slide').replace(/\s*·\s*\d+$/,'');
export function stableSongSlides(slides=[]){return slides.map((item,index)=>({...item,id:item.id||`slide-${index}-${baseName(item.name).toLowerCase().replace(/[^a-z0-9]+/g,'-')}`,name:item.name||`Slide ${index+1}`}))}
export function liveSongDraft(item){const slides=stableSongSlides(item?.slides||[]),activeIndex=Math.max(0,slides.findIndex(slide=>slide.id===item?.activeSlide?.id||slide.name===item?.activeSlide?.name));return{title:item?.title||'',sourceSongId:item?.databaseId||null,serviceItemId:item?.id||null,activeIndex,slides}}
export function applyLiveSongDraft(item,draft,now=Date.now()){
  const before=stableSongSlides(item?.slides||[]),slides=stableSongSlides(draft.slides).filter(slide=>String(slide.text||'').trim()).map((slide,index)=>({...slide,number:index+1,overflow:String(slide.text).length>320||String(slide.text).split('\n').length>8}));
  if(!slides.length)throw new Error('A live song must contain at least one slide.');
  const oldIndex=Math.max(0,before.findIndex(slide=>slide.id===item?.activeSlide?.id||slide.name===item?.activeSlide?.name)),oldId=before[oldIndex]?.id,activeSlide=slides.find(slide=>slide.id===oldId)||slides[Math.min(oldIndex,slides.length-1)];
  const rawLyrics=slides.map(slide=>`[${baseName(slide.name)}]\n\n${String(slide.text).trim()}`).join('\n\n');
  return{...item,title:draft.title?.trim()||item.title,rawLyrics,slides,activeSlide,serviceSongOverride:{sourceSongId:item?.databaseId||null,serviceItemId:item?.id||null,rawLyrics,slides,updatedAt:now,unsavedLibrary:true}};
}
export function librarySongFromLive(item){const parsed=parseLyrics(item.rawLyrics||'');return{id:item.databaseId,title:item.title,alternate_title:item.alternate_title||'',author:item.author||'',copyright:item.copyright||'',ccli_number:item.ccli_number||'',theme_id:item.themeId||'',background_id:item.backgroundId||'',rawLyrics:parsed.rawLyrics,sections:parsed.sections.map(section=>({label:section.label,text:section.slides.map(slide=>slide.text).join('\n\n')}))}}
