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
    assert.equal((await fetch(`${base}/presenter?token=service-token`)).status,404);
    server.publish({outputs:{'output-1':{live:{title:'Welcome'}}}});
    const snapshot=await(await fetch(`${base}/api/state?token=service-token`)).json();assert.equal(snapshot.revision,1);assert.equal(snapshot.state.outputs['output-1'].live.title,'Welcome');
  }finally{await new Promise(resolve=>server.close(resolve));rmSync(directory,{recursive:true,force:true})}
});
