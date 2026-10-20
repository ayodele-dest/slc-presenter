import http from 'node:http';
import { createReadStream, readFileSync, statSync } from 'node:fs';
import { extname, resolve, sep } from 'node:path';
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.gif':'image/gif','.mp4':'video/mp4','.webm':'video/webm','.mov':'video/quicktime','.m4v':'video/x-m4v','.wmv':'video/x-ms-wmv'};
export function createPresenterServer(staticDir,{mediaFile,networkToken=''}={}){
  const root=resolve(staticDir);
  let networkState={},revision=0;const clients=new Set();
  const authorized=req=>{const address=req.socket.remoteAddress||'',local=address==='127.0.0.1'||address==='::1'||address==='::ffff:127.0.0.1';if(local)return true;const url=new URL(req.url,'http://localhost');return Boolean(networkToken)&&url.searchParams.get('token')===networkToken};
  const server=http.createServer((req,res)=>{
    if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return}
    const parsedUrl=new URL(req.url,'http://localhost'),pathname=parsedUrl.pathname;
    if(pathname==='/api/network/state'){if(!authorized(req)){res.writeHead(403);res.end('Invalid network output token');return}const body=JSON.stringify({revision,state:networkState});res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Access-Control-Allow-Origin':'*'});res.end(req.method==='HEAD'?undefined:body);return}
    if(pathname==='/api/network/events'){if(!authorized(req)){res.writeHead(403);res.end('Invalid network output token');return}res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache, no-transform','Connection':'keep-alive','Access-Control-Allow-Origin':'*'});res.write(`event: state\ndata: ${JSON.stringify({revision,state:networkState})}\n\n`);clients.add(res);req.on('close',()=>clients.delete(res));return}
    if(pathname.startsWith('/media/')){if(!authorized(req)){res.writeHead(403);res.end('Invalid network output token');return}const id=decodeURIComponent(pathname.slice(7)),file=mediaFile?.(id);if(!file){res.writeHead(404);res.end('Media not found');return}try{const stat=statSync(file),type=mime[extname(file).toLowerCase()]||'application/octet-stream',range=req.headers.range;if(range){const[startText,endText]=range.replace(/bytes=/,'').split('-'),start=Number(startText),end=endText?Number(endText):stat.size-1;if(!Number.isFinite(start)||start<0||end>=stat.size){res.writeHead(416,{'Content-Range':`bytes */${stat.size}`});res.end();return}res.writeHead(206,{'Content-Range':`bytes ${start}-${end}/${stat.size}`,'Accept-Ranges':'bytes','Content-Length':end-start+1,'Content-Type':type});if(req.method==='HEAD'){res.end();return}createReadStream(file,{start,end}).pipe(res);return}res.writeHead(200,{'Content-Length':stat.size,'Content-Type':type,'Accept-Ranges':'bytes'});if(req.method==='HEAD'){res.end();return}createReadStream(file).pipe(res);return}catch{res.writeHead(404);res.end('Media not found');return}}
    const route=['/','/presenter','/presenter-output','/network-output'].includes(pathname);
    if(pathname==='/network-output'&&!authorized(req)){res.writeHead(403);res.end('Invalid network output token');return}
    let file;
    try{file=route?resolve(root,'index.html'):resolve(root,`.${decodeURIComponent(pathname)}`)}catch{res.writeHead(400);res.end();return}
    if(file!==resolve(root,'index.html')&&!file.startsWith(`${root}${sep}`)){res.writeHead(403);res.end();return}
    try{const body=readFileSync(file);res.setHeader('Content-Type',mime[extname(file)]||'application/octet-stream');res.setHeader('Cache-Control',extname(file)==='.html'?'no-cache':'public, max-age=3600');res.end(req.method==='HEAD'?undefined:body)}catch{res.writeHead(404);res.end('Not found')}
  });
  server.publishNetworkState=state=>{networkState=state&&typeof state==='object'?state:{};revision++;const payload=`event: state\ndata: ${JSON.stringify({revision,state:networkState})}\n\n`;for(const client of clients)try{client.write(payload)}catch{clients.delete(client)}};
  server.networkClients=()=>clients.size;
  return server;
}

export function createNetworkOutputServer(staticDir,{mediaFile,token}){
  const root=resolve(staticDir);let state={},revision=0;const clients=new Set(),cookieName='slc_network_output';
  const heartbeat=setInterval(()=>{for(const client of clients)try{client.write(`: heartbeat ${Date.now()}\n\n`)}catch{clients.delete(client)}},15000);heartbeat.unref?.();
  const isAuthorized=(req,url)=>url.searchParams.get('token')===token||String(req.headers.cookie||'').split(';').some(value=>value.trim()===`${cookieName}=${token}`);
  const serveFile=(req,res,file,cache='public, max-age=3600')=>{if(file!==resolve(root,'index.html')&&!file.startsWith(`${root}${sep}`)){res.writeHead(403);res.end();return}try{const body=readFileSync(file);res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream','Cache-Control':cache,'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'self'; img-src 'self' data: blob:; media-src 'self' blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'"});res.end(req.method==='HEAD'?undefined:body)}catch{res.writeHead(404);res.end('Not found')}};
  const server=http.createServer((req,res)=>{if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return}const url=new URL(req.url,'http://localhost'),pathname=url.pathname;if(!isAuthorized(req,url)){res.writeHead(403,{'Content-Type':'text/plain; charset=utf-8'});res.end('This SLC Network Output link is invalid or has expired.');return}if(url.searchParams.get('token')===token)res.setHeader('Set-Cookie',`${cookieName}=${token}; HttpOnly; SameSite=Strict; Path=/`);
    if(pathname==='/api/state'){const body=JSON.stringify({revision,state});res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(req.method==='HEAD'?undefined:body);return}
    if(pathname==='/api/events'){res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache, no-transform','Connection':'keep-alive'});res.write(`event: state\ndata: ${JSON.stringify({revision,state})}\n\n`);clients.add(res);req.on('close',()=>clients.delete(res));return}
    if(pathname.startsWith('/media/')){const id=decodeURIComponent(pathname.slice(7)),file=mediaFile?.(id);if(!file){res.writeHead(404);res.end('Media not found');return}try{const stat=statSync(file),type=mime[extname(file).toLowerCase()]||'application/octet-stream',range=req.headers.range;if(range){const[startText,endText]=range.replace(/bytes=/,'').split('-'),start=Number(startText),end=endText?Number(endText):stat.size-1;if(!Number.isFinite(start)||start<0||end>=stat.size){res.writeHead(416,{'Content-Range':`bytes */${stat.size}`});res.end();return}res.writeHead(206,{'Content-Range':`bytes ${start}-${end}/${stat.size}`,'Accept-Ranges':'bytes','Content-Length':end-start+1,'Content-Type':type});if(req.method==='HEAD'){res.end();return}createReadStream(file,{start,end}).pipe(res);return}res.writeHead(200,{'Content-Length':stat.size,'Content-Type':type,'Accept-Ranges':'bytes','Cache-Control':'private, max-age=3600'});if(req.method==='HEAD'){res.end();return}createReadStream(file).pipe(res);return}catch{res.writeHead(404);res.end('Media not found');return}}
    if(pathname==='/network-output')return serveFile(req,res,resolve(root,'index.html'),'no-cache');
    if(pathname.startsWith('/assets/')){let file;try{file=resolve(root,`.${decodeURIComponent(pathname)}`)}catch{res.writeHead(400);res.end();return}return serveFile(req,res,file)}
    res.writeHead(404);res.end('Not found');
  });
  server.publish=next=>{state=next&&typeof next==='object'?next:{};revision++;const payload=`event: state\ndata: ${JSON.stringify({revision,state})}\n\n`;for(const client of clients)try{client.write(payload)}catch{clients.delete(client)}};
  server.connections=()=>clients.size;
  server.on('close',()=>clearInterval(heartbeat));
  return server;
}
