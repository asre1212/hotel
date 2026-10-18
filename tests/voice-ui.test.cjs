const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
(async()=>{
 let server;
 let base=process.env.TEST_URL;
 if(!base){
   server=http.createServer((req,res)=>{
     const file=path.join(__dirname,'..',new URL(req.url,'http://localhost').pathname.replace(/^\/$/,'/index.html'));
     if(!file.startsWith(path.resolve(__dirname,'..')+path.sep)){res.writeHead(403);res.end();return;}
     fs.readFile(file,(error,data)=>{res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':'text/html');res.writeHead(error?404:200);res.end(error?'Not found':data);});
   });
   await new Promise(r=>server.listen(0,'127.0.0.1',r));base=`http://127.0.0.1:${server.address().port}`;
 }
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH});
 const context=await browser.newContext({viewport:{width:390,height:844}});
 const page=await context.newPage(), errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base);await page.evaluate(()=>openEdit());
 assert.equal(await page.locator('#voice-record svg').count(),1);
 assert.equal((await page.locator('#voice-record').textContent()).trim(),'');
 await page.locator('#voice-toggle').click();
 await page.locator('#voice-text').fill('Aman Tokyo in Tokyo, Japan. Rating four point seven five out of five. Notes: quiet rooms and excellent breakfast.');
 await page.locator('#voice-parse').click();
 for(const [f,v] of Object.entries({name:'Aman Tokyo',city:'Tokyo',country:'Japan',rating:'4.75',notes:'quiet rooms and excellent breakfast'}))assert.equal(await page.locator('#f-'+f).inputValue(),v);
 assert.equal(await page.evaluate(()=>state.hotels.length),0); // Only Save persists.
 await page.screenshot({path:'/tmp/hotel-voice-filled.png',fullPage:true});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await page.locator('#saveBtn').click();
 let saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('hj.hotels.v1')));
 assert.equal(saved.length,1);assert.equal(saved[0].rating,4.75);assert.equal(saved[0].city,'Tokyo');
 assert.equal(Object.hasOwn(saved[0],'transcript'),false);
 await page.reload();assert.equal(await page.locator('#list .entry').count(),1);
 await page.evaluate(()=>openEdit());
 await page.locator('#f-city').fill('Manual city');
 await page.locator('#voice-toggle').click();
 await page.locator('#voice-text').fill('Hotel X in Paris, France. Rating 4.5. Notes: garden.');await page.locator('#voice-parse').click();
 assert.equal(await page.locator('#f-city').inputValue(),'Manual city');
 assert.match(await page.locator('#voice-status').textContent(),/Kept your existing city/);
 await page.locator('#f-notes').fill('Manually corrected note');await page.locator('#voice-undo').click();
 assert.equal(await page.locator('#f-name').inputValue(),'');assert.equal(await page.locator('#f-city').inputValue(),'Manual city');
 assert.equal(await page.locator('#f-notes').inputValue(),'Manually corrected note');
 await page.evaluate(()=>{closeAllSheets();openEdit();setStatus('wishlist');});
 await page.locator('#voice-toggle').click();await page.locator('#voice-text').fill('Aman Tokyo. Rating 4.5.');await page.locator('#voice-parse').click();
 assert.equal(await page.locator('#f-rating').inputValue(),'');assert.match(await page.locator('#voice-status').textContent(),/Switch to Stayed/);
 await page.evaluate(()=>{closeAllSheets();openEdit();});
 await page.locator('#voice-toggle').click();await page.locator('#voice-text').fill('Hotel <img src=x onerror=alert(1)> in Tokyo.');await page.locator('#voice-parse').click();
 assert.equal(await page.locator('#voice-panel img').count(),0);await page.locator('#saveBtn').click();
 assert.equal(await page.locator('#list img').count(),0);assert.equal(await page.locator('#list .entry').count(),2);
 // Real UI + deterministic microphone/worker substitutes exercise the asynchronous lifecycle.
 await page.evaluate(()=>{
   openEdit();window.stoppedTracks=0;window.workerTerminations=0;window.micRequests=0;
   navigator.mediaDevices.getUserMedia=async()=>{window.micRequests++;return {getTracks:()=>[{stop(){window.stoppedTracks++}}]};};
   window.MediaRecorder=class{
     constructor(){this.state='inactive';this.mimeType='audio/webm';}
     start(){this.state='recording';}
     stop(){this.state='inactive';this.ondataavailable?.({data:new Blob(['test'])});queueMicrotask(()=>this.onstop?.());}
   };
   window.Worker=class{
     postMessage({id,op}){window.finishTranscription=(text='Park Hyatt in Kyoto, Japan. Rating four and a half. Notes: lovely gardens.')=>this.onmessage({data:op==='load'?{id,ready:true}:{id,text}});}
     terminate(){window.workerTerminations++;}
   };
   window.AudioContext=class{async decodeAudioData(){return {duration:1};}async close(){}};
   window.OfflineAudioContext=class{
     createBufferSource(){return {connect(){},start(){}};}
     async startRendering(){return {getChannelData:()=>new Float32Array(16000).fill(.1)};}
   };
 });
 await page.locator('#voice-record').click();assert.equal(await page.locator('#voice-record').getAttribute('aria-pressed'),'true');
 assert.equal(await page.locator('#saveBtn').isDisabled(),true);
 await page.screenshot({path:'/tmp/hotel-voice-recording.png',fullPage:true});
 await page.locator('#voice-record').click();await page.waitForFunction(()=>typeof finishTranscription==='function');
 assert.equal(await page.locator('#voice-record').isDisabled(),true);assert.equal(await page.evaluate(()=>stoppedTracks),1);
 await page.locator('#f-notes').fill('Edited while transcribing');
 await page.evaluate(()=>finishTranscription());
 await page.waitForFunction(()=>document.getElementById('voice-record').disabled===false);
 assert.equal(await page.locator('#f-name').inputValue(),'Park Hyatt');assert.equal(await page.locator('#f-city').inputValue(),'Kyoto');
 assert.equal(await page.locator('#f-rating').inputValue(),'4.5');assert.equal(await page.locator('#f-notes').inputValue(),'Edited while transcribing');
 assert.equal(await page.locator('#saveBtn').isEnabled(),true);
 // Closing while permission is pending releases the later stream without recording.
 await page.evaluate(()=>{closeAllSheets();openEdit();navigator.mediaDevices.getUserMedia=()=>new Promise(r=>window.resolveMic=r);});
 await page.locator('#voice-record').click();await page.evaluate(()=>{closeAllSheets();resolveMic({getTracks:()=>[{stop(){stoppedTracks++}}]});});
 assert.equal(await page.evaluate(()=>stoppedTracks),2);
 // Closing during processing prevents late writes to the next hotel draft.
 await page.evaluate(()=>{openEdit();navigator.mediaDevices.getUserMedia=async()=>({getTracks:()=>[{stop(){stoppedTracks++}}]});window.finishTranscription=null;});
 await page.locator('#voice-record').click();await page.locator('#voice-record').click();await page.waitForFunction(()=>typeof finishTranscription==='function');
 await page.evaluate(()=>{window.lateResult=finishTranscription;closeAllSheets();openEdit();lateResult();});
 assert.equal(await page.locator('#f-name').inputValue(),'');assert.equal(await page.evaluate(()=>workerTerminations),1);
 // Backgrounding cancels capture and leaves the button reusable.
 await page.locator('#voice-record').click();
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});
 assert.equal(await page.locator('#voice-record').getAttribute('aria-pressed'),'false');assert.equal(await page.locator('#voice-record').isEnabled(),true);
 assert.match(await page.locator('#voice-status').textContent(),/background/);
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:false});navigator.mediaDevices.getUserMedia=async()=>{throw new DOMException('Denied','NotAllowedError');};});
 await page.locator('#voice-record').click();assert.match(await page.locator('#voice-status').textContent(),/permission denied/);
 assert.equal(await page.locator('#voice-record').isEnabled(),true);
 assert.deepEqual(errors,[]);
 console.log('UI passed: five fields, save/reload, manual edits, undo, wishlist, injection, mic toggle, stale results, cancellation, background and permission denial.');
 await browser.close();
 if(server)await new Promise(r=>server.close(r));
})().catch(e=>{console.error(e);process.exit(1);});
