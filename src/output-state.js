export function nextOutputSnapshot(previousRevision,payload){return{...payload,revision:Math.max(0,Number(previousRevision)||0)+1}}
export function acceptsOutputSnapshot(currentRevision,payload){const next=Number(payload?.revision)||0;return!next||next>currentRevision}
export function outputPlaybackState(playback={}){return{playing:Boolean(playback.playing),position:Number(playback.position)||0,duration:Number(playback.duration)||0,volume:Number.isFinite(playback.volume)?playback.volume:1,muted:Boolean(playback.muted),loop:Boolean(playback.loop),command:Number(playback.command)||0}}
export function collectOutputMediaAssets(item){
 const assets=new Map(),add=(url,kind)=>{if(typeof url==='string'&&url.trim())assets.set(url,{url,kind:kind==='video'?'video':'image'})},background=value=>{if(value?.type==='image'||value?.type==='video')add(value.url,value.type)};
 if(!item)return[];
 if(item.type==='Media')add(item.url,item.mediaType==='Video'?'video':'image');
 background(item.background);background(item.backgroundOverride);background(item.outputBackgroundOverride);background(item.theme?.background);
 for(const slide of item.slides||[]){add(slide?.imageUrl,'image');background(slide?.background)}
 for(const element of item.theme?.elements||[])if(element?.type==='image')add(element.url,'image');
 return[...assets.values()];
}
