import http from 'node:http';
import { createReadStream, readFileSync, statSync } from 'node:fs';
import { extname, resolve, sep } from 'node:path';
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.gif':'image/gif','.mp4':'video/mp4','.webm':'video/webm','.mov':'video/quicktime','.m4v':'video/x-m4v'};
export function createPresenterServer(staticDir,{mediaFile}={}){
  const root=resolve(staticDir);
  return http.createServer((req,res)=>{
    if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return}
    const pathname=new URL(req.url,'http://localhost').pathname;
    if(pathname.startsWith('/media/')){const id=decodeURIComponent(pathname.slice(7)),file=mediaFile?.(id);if(!file){res.writeHead(404);res.end('Media not found');return}try{const stat=statSync(file),type=mime[extname(file).toLowerCase()]||'application/octet-stream',range=req.headers.range;if(range){const[startText,endText]=range.replace(/bytes=/,'').split('-'),start=Number(startText),end=endText?Number(endText):stat.size-1;if(!Number.isFinite(start)||start<0||end>=stat.size){res.writeHead(416,{'Content-Range':`bytes */${stat.size}`});res.end();return}res.writeHead(206,{'Content-Range':`bytes ${start}-${end}/${stat.size}`,'Accept-Ranges':'bytes','Content-Length':end-start+1,'Content-Type':type});if(req.method==='HEAD'){res.end();return}createReadStream(file,{start,end}).pipe(res);return}res.writeHead(200,{'Content-Length':stat.size,'Content-Type':type,'Accept-Ranges':'bytes'});if(req.method==='HEAD'){res.end();return}createReadStream(file).pipe(res);return}catch{res.writeHead(404);res.end('Media not found');return}}
    const route=['/','/presenter','/presenter-output'].includes(pathname);
    let file;
    try{file=route?resolve(root,'index.html'):resolve(root,`.${decodeURIComponent(pathname)}`)}catch{res.writeHead(400);res.end();return}
    if(file!==resolve(root,'index.html')&&!file.startsWith(`${root}${sep}`)){res.writeHead(403);res.end();return}
    try{const body=readFileSync(file);res.setHeader('Content-Type',mime[extname(file)]||'application/octet-stream');res.setHeader('Cache-Control',extname(file)==='.html'?'no-cache':'public, max-age=3600');res.end(req.method==='HEAD'?undefined:body)}catch{res.writeHead(404);res.end('Not found')}
  });
}
