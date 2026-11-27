import vm from 'node:vm';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const source=fs.readFileSync('agents.js','utf8');
const panes=[{pane:'p1',terminal:'t1',tab:'t',name:'Alpha',status:'working',app:'pi'},{pane:'p2',terminal:'remote/t2',tab:'t',status:'idle'},{pane:'shell',terminal:'shell',tab:'t',status:null},{pane:'mod',terminal:null,tab:'t',status:'working'},{pane:'foreign',terminal:'t3',tab:'other',status:'blocked'}];
const spaces=[{id:'w',tabs:[{id:'t',name:'One'}]},{id:'foreign',tabs:[{id:'other',name:'Other'}]}];
const native=[{address:'t1',space:'w'},{address:'foreign/t',space:'foreign'}];
async function run(agents,source) {
 const context=vm.createContext({});
 const api={agents,panes:()=>panes,spaces:()=>spaces,focused:()=>({space:'w'}),closeOverlay(){},openOverlay(){},props(){},setShared(){},shared(){}};
 function host(name,exports){return new vm.SyntheticModule(Object.keys(exports),function(){for(const[k,v] of Object.entries(exports))this.setExport(k,v)},{context,identifier:name});}
 const h=host('herdr',api),g=host('gpui-kit',{div(){}}), m=new vm.SourceTextModule(source,{context});
 m.linkRequests(m.moduleRequests.map(r=>r.specifier==='herdr'?h:g));m.instantiate();await m.evaluate();
 return JSON.parse(JSON.stringify(m.namespace.agentMethods.localAgents.call({worldId:'w'})));
}
async function check(s){
 assert.deepEqual(await run(()=>native,s),[native[0]]);
 const fallback=await run({},s);
 assert.deepEqual(fallback.map(a=>a.address),['t1','remote/t2']);
 assert.equal(fallback[0].pane_name,'Alpha');assert.equal(fallback[1].tab_name,'One');assert.equal(fallback[1].status,'idle');
}
if(process.argv[2]==='negative') {
 let rejected=false;try{await check(source.replace('if (typeof herdrAgents === "function")','if (true)'));}catch(e){rejected=true;console.log('known broken unguarded native agents export rejected:',String(e));}assert(rejected);
}else {await check(source);console.log('native API and corrupted export fallback, remote identity, world/status exclusion and order passed');}
