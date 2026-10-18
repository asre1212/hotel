/* Local Whisper capture. Audio and transcript never enter sync or storage. */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const fieldNames = ['name','city','country','notes','rating'];
  let worker, pending, sequence=0, generation=0, recorder, stream, timer, chunks=[];
  let mode='idle', previous={}, undo=null, getHotels=()=>[];
  const status = message => $('voice-status').textContent=message;
  const snapshot = () => Object.fromEntries(fieldNames.map(k=>[k,$('f-'+k).value]));
  function controls(next) {
    mode=next;
    const active=next==='recording', busy=next==='busy';
    const button=$('voice-record');
    const label=active?'Stop voice recording':busy?'Processing voice entry':'Start voice recording';
    button.disabled=busy;
    button.setAttribute('aria-pressed',String(active));
    button.setAttribute('aria-label',label); button.title=label;
    $('voice-panel').setAttribute('aria-busy',String(busy));
    for (const id of ['voice-parse','voice-text','voice-load','voice-undo']) $(id).disabled=active||busy;
    $('saveBtn').disabled=active||busy;
  }
  function reveal() { $('voice-panel').hidden=false; $('voice-record').setAttribute('aria-expanded','true'); }
  function abortWorker(message='Canceled.') {
    worker?.terminate(); worker=null;
    if (pending) { const p=pending;pending=null;clearTimeout(p.timeout);p.reject(new Error(message)); }
  }
  function call(op,audio) {
    if (pending) return Promise.reject(new Error('Wait for the current recording to finish.'));
    if (!worker) {
      worker=new Worker(new URL('voice-worker.js?v=1.7.0',document.baseURI),{type:'module'});
      worker.onmessage=({data})=>{
        if (data.progress) {status(data.progress);return;}
        if (!pending||data.id!==pending.id) return;
        const p=pending;pending=null;clearTimeout(p.timeout);
        data.error?p.reject(new Error(data.error)):p.resolve(data);
      };
      worker.onerror=()=>abortWorker('Speech model could not load. Retry online or type below.');
      worker.onmessageerror=()=>abortWorker('Speech result could not be read. Please retry.');
    }
    return new Promise((resolve,reject)=>{
      const id=++sequence;
      pending={id,resolve,reject,timeout:setTimeout(()=>abortWorker('Speech processing timed out. Retry online or type below.'),240000)};
      try { worker.postMessage({id,op,audio},audio?[audio.buffer]:[]); }
      catch (_) { abortWorker('Speech engine unavailable. Retry or type below.'); }
    });
  }
  function release() { clearTimeout(timer);stream?.getTracks().forEach(t=>t.stop());stream=null; }
  function cancel(message='Recording canceled. Audio discarded.') {
    const wasActive=mode!=='idle';
    generation++;
    if (recorder?.state==='recording') recorder.stop();
    recorder=null;release();chunks=[];
    if (pending) abortWorker();
    controls('idle');
    if (wasActive) status(message);
  }
  function reset() {
    cancel();previous={};undo=null;
    $('voice-text').value='';$('voice-panel').hidden=true;$('voice-undo').hidden=true;
    $('voice-record').setAttribute('aria-expanded','false');
    status('Tap the microphone, speak one hotel, then tap again to stop.');
  }
  async function loadModel() {
    reveal();const gen=++generation;controls('busy');
    status('Loading Whisper. First use downloads speech files; Wi-Fi is recommended.');
    try {await call('load');if(gen===generation)status('Whisper is ready on this device. Tap the microphone to record.');}
    catch(e) {if(gen===generation)status(e.message);}
    finally {if(gen===generation)controls('idle');}
  }
  async function start() {
    reveal();
    if (!window.isSecureContext||!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder) {
      status('Open the HTTPS web app in Safari to use the microphone, or type your entry below.');return;
    }
    const gen=++generation, baseline=snapshot();controls('busy');
    status('Allow microphone access to record locally.');
    try {
      const acquired=await navigator.mediaDevices.getUserMedia({audio:{channelCount:1,echoCancellation:true,noiseSuppression:true}});
      if (gen!==generation) {acquired.getTracks().forEach(t=>t.stop());return;}
      stream=acquired;chunks=[];
      const active=new MediaRecorder(stream);recorder=active;
      active.ondataavailable=e=>{if(gen===generation&&e.data.size)chunks.push(e.data);};
      active.onstop=()=>{
        if(gen!==generation)return;
        recorder=null;release();controls('busy');
        transcribe(active.mimeType,gen,baseline);
      };
      active.onerror=()=>{if(gen===generation)cancel('Recording failed. Please retry.');};
      active.start();controls('recording');
      status('Recording on this device… tap the microphone to stop. Maximum 60 seconds.');
      timer=setTimeout(stop,60000);
    } catch(e) {
      if(gen!==generation)return;
      release();controls('idle');
      status(e.name==='NotAllowedError'?'Microphone permission denied. Allow microphone access in Safari settings, or type below.':'Could not start the microphone. Please retry or type below.');
    }
  }
  function stop() {
    if(recorder?.state!=='recording')return;
    controls('busy');status('Finishing recording…');recorder.stop();release();
  }
  async function transcribe(mimeType,gen,baseline) {
    let context;
    try {
      status('Transcribing on your device. First use downloads the Whisper speech model…');
      const blob=new Blob(chunks,{type:mimeType});chunks=[];
      if(!blob.size)throw new Error('No audio recorded. Please try again.');
      context=new (window.AudioContext||window.webkitAudioContext)();
      const decoded=await context.decodeAudioData(await blob.arrayBuffer());
      if(gen!==generation)return;
      if(!decoded.duration||decoded.duration>65)throw new Error('Please record one hotel in 60 seconds or less.');
      const Offline=window.OfflineAudioContext||window.webkitOfflineAudioContext;
      const offline=new Offline(1,Math.ceil(decoded.duration*16000),16000);
      const source=offline.createBufferSource();source.buffer=decoded;source.connect(offline.destination);source.start();
      const pcm=(await offline.startRendering()).getChannelData(0);
      if(gen!==generation)return;
      let energy=0;for(const sample of pcm)energy+=sample*sample;
      if(!pcm.length||Math.sqrt(energy/pcm.length)<.002)throw new Error('No clear speech detected. Try again closer to the microphone.');
      const result=await call('transcribe',pcm);
      if(gen!==generation)return;
      const text=String(result.text||'').trim();
      if(!text)throw new Error('No speech recognized. Please try again.');
      $('voice-text').value=text;fillFields(baseline);
    } catch(e) {if(gen===generation)status(e.message);}
    finally {
      if(context)await context.close().catch(()=>{});
      if(gen===generation)controls('idle');
    }
  }
  function fillFields(baseline=snapshot()) {
    const result=HotelVoiceParser.parse($('voice-text').value,getHotels());
    const before=snapshot(), filled=[], kept=[];
    for(const field of fieldNames) {
      if(result.fields[field]===undefined||result.fields[field]==='')continue;
      const input=$('f-'+field), value=String(result.fields[field]);
      // Keep manually edited fields, including edits made while inference runs.
      if(input.value!==baseline[field] || (input.value && input.value!==previous[field] && input.value!==value)) {
        kept.push(field==='name'?'hotel name':field);continue;
      }
      if(field==='rating' && $('statusSeg').dataset.val==='wishlist') {
        result.issues.push('Switch to Stayed to use the spoken rating.');continue;
      }
      input.value=value;previous[field]=value;filled.push(field==='name'?'hotel name':field);
      input.dispatchEvent(new Event('input',{bubbles:true}));
    }
    if(filled.length) {undo={before,after:snapshot()};$('voice-undo').hidden=false;}
    const missing=result.issues.filter(issue=>!/^Check /.test(issue)||!$('f-'+(issue.includes('hotel name')?'name':issue.includes('country')?'country':'city')).value);
    status([
      filled.length?`Filled ${filled.join(', ')}. Review the fields, then Save entry.`:'No fields changed. Review the transcript or enter the fields below.',
      kept.length?`Kept your existing ${kept.join(', ')}; clear a field and tap Fill fields to replace it.`:'',
      ...missing
    ].filter(Boolean).join(' '));
  }
  function undoFill() {
    if(!undo)return;
    for(const field of fieldNames) {
      const input=$('f-'+field);
      if(input.value===undo.after[field]) {input.value=undo.before[field];input.dispatchEvent(new Event('input',{bubbles:true}));}
    }
    previous={};undo=null;$('voice-undo').hidden=true;status('Voice fill undone. Your manual edits were kept.');
  }
  window.HotelVoice={reset,cancel,init(options={}) {
    getHotels=options.getHotels||getHotels;
    $('voice-record').onclick=()=>mode==='recording'?stop():mode==='idle'?start():null;
    $('voice-toggle').onclick=()=>{reveal();$('voice-text').focus();};
    $('voice-parse').onclick=()=>fillFields();$('voice-load').onclick=loadModel;$('voice-undo').onclick=undoFill;
    $('voice-cancel').onclick=()=>{cancel();$('voice-panel').hidden=true;$('voice-record').setAttribute('aria-expanded','false');};
    document.addEventListener('visibilitychange',()=>{if(document.hidden&&mode!=='idle')cancel('Recording or processing canceled when the app went into the background. Please retry.');});
    window.addEventListener('pagehide',()=>cancel());
  }};
})();
