import test from'node:test';
import assert from'node:assert/strict';
import{mkdtempSync,writeFileSync,rmSync,mkdirSync}from'node:fs';
import{join}from'node:path';
import{tmpdir}from'node:os';
import{once}from'node:events';
import{createNetworkOutputServer}from'../server/app.js';

test('network output exposes only authenticated receiver resources and live state',async()=>{
  const directory=mkdtempSync(join(tmpdir(),'slc-network-output-')),assets=join(directory,'assets'),media=join(directory,'welcome.png');mkdirSync(assets);writeFileSync(join(directory,'index.html'),'<main>receiver</main>');writeFileSync(join(assets,'app.js'),'receiver');writeFileSync(media,'image');
  const server=createNetworkOutputServer(directory,{token:'service-token',mediaFile:id=>id==='welcome'?media:null});server.listen(0,'127.0.0.1');await once(server,'listening');const base=`http://127.0.0.1:${server.address().port}`;
  try{
    assert.equal((await fetch(`${base}/network-output`)).status,403);
    const receiver=await fetch(`${base}/network-output?token=service-token`);assert.equal(receiver.status,200);assert.match(await receiver.text(),/receiver/);assert.equal(receiver.headers.get('referrer-policy'),'no-referrer');
    const cookie=receiver.headers.get('set-cookie').split(';')[0];assert.equal((await fetch(`${base}/assets/app.js`,{headers:{cookie}})).status,200);assert.equal((await fetch(`${base}/media/welcome`)).status,403);assert.equal((await fetch(`${base}/media/welcome`,{headers:{cookie}})).status,200);
    const cached=await fetch(`${base}/media/welcome`,{headers:{cookie}});assert.equal(cached.headers.get('accept-ranges'),'bytes');assert.match(cached.headers.get('cache-control'),/max-age=86400/);const etag=cached.headers.get('etag');assert.ok(etag);assert.equal((await fetch(`${base}/media/welcome`,{headers:{cookie,'if-none-match':etag}})).status,304);
    assert.equal((await fetch(`${base}/media/welcome`,{headers:{cookie,range:'bytes=4-1'}})).status,416);
    assert.equal((await fetch(`${base}/media/welcome`,{headers:{cookie,range:'bytes=999-1000'}})).status,416);
    assert.equal((await fetch(`${base}/presenter?token=service-token`)).status,404);
    server.publish({outputs:{'output-1':{live:{title:'Welcome'}}}});
    const snapshot=await(await fetch(`${base}/api/state?token=service-token`)).json();assert.equal(snapshot.revision,1);assert.equal(snapshot.state.outputs['output-1'].live.title,'Welcome');
    server.setToken('replacement-token');
    assert.equal((await fetch(`${base}/api/state?token=service-token`)).status,403);
    assert.equal((await fetch(`${base}/api/state?token=replacement-token`)).status,200);
  }finally{await new Promise(resolve=>server.close(resolve));rmSync(directory,{recursive:true,force:true})}
});

test('network output can be force-closed while a receiver is connected',async()=>{
  const directory=mkdtempSync(join(tmpdir(),'slc-network-close-'));writeFileSync(join(directory,'index.html'),'<main>receiver</main>');
  const server=createNetworkOutputServer(directory,{token:'service-token',mediaFile:()=>null});server.listen(0,'127.0.0.1');await once(server,'listening');
  const base=`http://127.0.0.1:${server.address().port}`,controller=new AbortController();
  try{
    const receiver=await fetch(`${base}/api/events?token=service-token`,{signal:controller.signal});assert.equal(receiver.status,200);assert.equal(server.connections(),1);
    const closed=new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Network server did not close with an active receiver')),2000);server.close(()=>{clearTimeout(timer);resolve()});server.closeAllConnections?.()});
    await closed;
  }finally{controller.abort();if(server.listening)await new Promise(resolve=>server.close(resolve));rmSync(directory,{recursive:true,force:true})}
});
