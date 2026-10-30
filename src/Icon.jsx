import React from 'react';
import {
  AlertTriangle, ArrowDown, ArrowLeft, ArrowUp, BookOpen, Check, ChevronDown,
  ChevronLeft, ChevronRight, ChevronUp, Circle, ClipboardCheck, Copy, Eye,
  EyeOff, FileDown, FilePlus2, FolderOpen, Image, Import, LayoutTemplate,
  ListPlus, Minus, Monitor, MonitorUp, MoreVertical, Music2, Pencil, Play, Plus,
  Presentation, RotateCcw, Save, Search, Settings, Shapes, Square, Trash2,
  Type, Upload, X,
} from 'lucide-react';

const icons={
  add:Plus,back:ArrowLeft,background:Image,black:Square,check:Check,
  chevronDown:ChevronDown,chevronLeft:ChevronLeft,chevronRight:ChevronRight,
  chevronUp:ChevronUp,clear:X,close:X,collapse:ChevronUp,copy:Copy,
  down:ArrowDown,duplicate:Copy,edit:Pencil,expand:ChevronDown,eye:Eye,
  eyeOff:EyeOff,fileDown:FileDown,import:Import,library:BookOpen,
  folder:FolderOpen,minus:Minus,more:MoreVertical,new:FilePlus2,open:FolderOpen,outputs:MonitorUp,
  play:Play,presentation:Presentation,reset:RotateCcw,remove:Trash2,
  save:Save,schedule:ListPlus,search:Search,serviceCheck:ClipboardCheck,
  settings:Settings,shape:Shapes,song:Music2,status:Circle,text:Type,
  theme:LayoutTemplate,up:ArrowUp,upload:Upload,warning:AlertTriangle,
  monitor:Monitor,
};

export default function Icon({name,size=14,strokeWidth=1.8,className='',...props}){
  const Component=typeof name==='string'?icons[name]:name;
  if(!Component)return null;
  return <Component className={`slc-icon ${className}`.trim()} size={size} strokeWidth={strokeWidth} aria-hidden="true" focusable="false" {...props}/>;
}
