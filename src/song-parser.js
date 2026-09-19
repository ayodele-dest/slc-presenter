const markerPattern=/^\s*\[([^\]\r\n]+)\]\s*$/;
export const normalizeLyrics=value=>String(value??'').replace(/\r\n?/g,'\n');

export function parseLyrics(rawText){
  const lines=normalizeLyrics(rawText).split('\n'),sections=[];let section=null,block=[];
  const ensureSection=()=>{if(!section){section={label:'Song',occurrence:1,slides:[]};sections.push(section)}return section};
  const flush=()=>{const text=block.join('\n').replace(/^\s+|\s+$/g,'');block=[];if(!text)return;const target=ensureSection();target.slides.push({text,section:target.label,sectionOccurrence:target.occurrence})};
  for(const line of lines){const marker=line.match(markerPattern);if(marker){flush();const label=marker[1].trim(),occurrence=sections.filter(item=>item.label.toLowerCase()===label.toLowerCase()).length+1;section={label,occurrence,slides:[]};sections.push(section);continue}if(/^\s*---+\s*$/.test(line)||/^\s*$/.test(line)){flush();continue}block.push(line)}
  flush();
  const populated=sections.filter(item=>item.slides.length),slides=[];
  populated.forEach(group=>group.slides.forEach((item,index)=>slides.push({...item,name:group.label==='Song'?`Slide ${slides.length+1}`:index?`${group.label} · ${index+1}`:group.label,number:slides.length+1,overflow:item.text.length>320||item.text.split('\n').length>8})));
  return{rawLyrics:normalizeLyrics(rawText),sections:populated,slides};
}

export function sectionsToRawLyrics(sections=[]){return sections.map(section=>`[${section.label||section.name||'Section'}]\n\n${String(section.text??'').trim()}`).join('\n\n').trim()}
