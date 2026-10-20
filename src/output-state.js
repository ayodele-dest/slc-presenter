export function nextOutputSnapshot(previousRevision,payload){return{...payload,revision:Math.max(0,Number(previousRevision)||0)+1}}
export function acceptsOutputSnapshot(currentRevision,payload){const next=Number(payload?.revision)||0;return!next||next>currentRevision}
export function outputPlaybackState(playback={}){return{playing:Boolean(playback.playing),position:Number(playback.position)||0,duration:Number(playback.duration)||0,volume:Number.isFinite(playback.volume)?playback.volume:1,muted:Boolean(playback.muted),loop:Boolean(playback.loop),command:Number(playback.command)||0}}
