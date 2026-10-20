export const BACKGROUND_PRESETS=[
  {id:'midnight',name:'Midnight',category:'Solid',style:{background:'#05070d'}},
  {id:'deep-navy',name:'Deep Navy',category:'Solid',style:{background:'#071a33'}},
  {id:'warm-charcoal',name:'Warm Charcoal',category:'Solid',style:{background:'#181514'}},
  {id:'royal-blue',name:'Royal Blue',category:'Gradient',style:{background:'linear-gradient(135deg,#07162f 0%,#123e78 55%,#08111f 100%)'}},
  {id:'purple-dawn',name:'Purple Dawn',category:'Gradient',style:{background:'linear-gradient(135deg,#170b2d 0%,#52206f 52%,#bf5a69 100%)'}},
  {id:'emerald-depth',name:'Emerald Depth',category:'Gradient',style:{background:'linear-gradient(135deg,#061714 0%,#0d4f43 55%,#071b20 100%)'}},
  {id:'amber-glow',name:'Amber Glow',category:'Gradient',style:{background:'radial-gradient(circle at 50% 115%,#b96820 0%,#332011 38%,#090b10 75%)'}},
  {id:'soft-rays',name:'Soft Rays',category:'Pattern',style:{backgroundColor:'#0b1830',backgroundImage:'repeating-conic-gradient(from 220deg at 50% 120%,rgba(255,255,255,.055) 0deg 7deg,transparent 7deg 16deg)'}},
  {id:'quiet-grid',name:'Quiet Grid',category:'Pattern',style:{backgroundColor:'#111820',backgroundImage:'linear-gradient(rgba(255,255,255,.035) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.035) 1px,transparent 1px)',backgroundSize:'48px 48px'}},
  {id:'soft-vignette',name:'Soft Vignette',category:'Pattern',style:{background:'radial-gradient(ellipse at center,#26344a 0%,#111827 48%,#03060c 100%)'}}
];

export function backgroundPreset(id){return BACKGROUND_PRESETS.find(item=>item.id===id)||BACKGROUND_PRESETS[0]}
export function presetBackgroundStyle(background){return background?.type==='preset'?backgroundPreset(background.presetId).style:null}
export function presetDescriptor(preset){return{type:'preset',presetId:preset.id}}
