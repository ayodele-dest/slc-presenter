import { spawn } from 'node:child_process';
import { extname } from 'node:path';

export function requiresVideoTranscode(path=''){
  return extname(String(path)).toLowerCase()==='.wmv';
}

export function wmvTranscodeArgs(source,destination){
  return ['-y','-hide_banner','-loglevel','error','-i',source,'-map','0:v:0','-map','0:a?','-vf','scale=trunc(iw/2)*2:trunc(ih/2)*2','-c:v','libx264','-preset','fast','-crf','20','-pix_fmt','yuv420p','-c:a','aac','-b:a','160k','-movflags','+faststart',destination];
}

export function transcodeWmvToMp4(ffmpegPath,source,destination){
  return new Promise((resolve,reject)=>{
    let diagnostics='';
    const child=spawn(ffmpegPath,wmvTranscodeArgs(source,destination),{windowsHide:true});
    child.stderr.on('data',chunk=>{diagnostics=(diagnostics+chunk.toString()).slice(-8000)});
    child.once('error',reject);
    child.once('close',code=>code===0?resolve(destination):reject(new Error(diagnostics.trim()||`Video conversion exited with code ${code}.`)));
  });
}
