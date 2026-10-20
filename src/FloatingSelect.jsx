import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Icon from './Icon.jsx';

export default function FloatingSelect({label,value,options,onChange}) {
  const anchor = useRef(null);
  const [open,setOpen] = useState(false);
  const [position,setPosition] = useState(null);
  const selected = options.find(option=>option.value===value);
  useEffect(()=>{
    if(!open)return;
    const place=()=>{
      const rect=anchor.current?.getBoundingClientRect();
      if(!rect)return;
      const width=Math.max(180,rect.width);
      const height=Math.min(320,options.length*38+12);
      setPosition({left:Math.max(8,Math.min(rect.left,window.innerWidth-width-8)),top:rect.bottom+height+8<=window.innerHeight?rect.bottom+4:Math.max(8,rect.top-height-4),width});
    };
    const dismiss=event=>{if(!anchor.current?.contains(event.target)&&!event.target.closest('.slc-floating-select-menu'))setOpen(false)};
    const key=event=>{if(event.key==='Escape')setOpen(false)};
    place();
    addEventListener('resize',place);addEventListener('scroll',place,true);
    addEventListener('pointerdown',dismiss);addEventListener('keydown',key);
    return()=>{removeEventListener('resize',place);removeEventListener('scroll',place,true);removeEventListener('pointerdown',dismiss);removeEventListener('keydown',key)};
  },[open,options.length]);
  return <div className="slc-floating-select" ref={anchor}>
    <button type="button" aria-label={label} aria-haspopup="listbox" aria-expanded={open} onClick={()=>setOpen(current=>!current)}>{label}<span>{selected?.label||'Select'}</span><Icon name="chevronDown"/></button>
    {open&&position&&createPortal(<div className="slc-floating-select-menu" role="listbox" aria-label={label} style={position}>{options.map(option=><button type="button" role="option" aria-selected={option.value===value} key={option.value} onClick={()=>{onChange(option.value);setOpen(false)}}><span>{option.value===value&&<Icon name="check"/>}</span>{option.label}</button>)}</div>,document.body)}
  </div>;
}
