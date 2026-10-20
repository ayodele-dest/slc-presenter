export function recoverySnapshot({serviceId=null,serviceFilePath=null,name='New Service',items=[],dirty=false,selected=null,preview=null,live=null}){
  return{version:2,serviceId,serviceFilePath,name,items,dirty,selected,preview,live,updatedAt:Date.now()};
}

export function edgeSlide(item,edge){
  const slides=Array.isArray(item?.slides)?item.slides:[];
  if(!slides.length)return null;
  return edge==='last'?slides.at(-1):slides[0];
}
