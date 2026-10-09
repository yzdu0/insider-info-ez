import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function loadTs(path, mocks, globals = {}) {
  const loaded = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  vm.runInNewContext(code, { module: loaded, exports: loaded.exports, require: (name) => {
    assert.ok(name in mocks, `Unexpected dependency: ${name}`);
    return mocks[name];
  }, ...globals }, { filename: path });
  return loaded.exports;
}

// Exercise the hook's resource lifecycle with browser/provider doubles. Effects
// run on mount; state updates are observable without needing a DOM or microphone.
function voiceHarness({ permissionError, deferredConnection = false } = {}) {
  const states = [];
  const cleanups = [];
  const hookSlots = []; let cursor = 0;
  const timers = new Map();
  const listeners = new Map();
  const documentListeners = new Map();
  const submissions = [];
  const recovered = [];
  const sessions = [];
  const worklets = [];
  const contexts = [];
  let stoppedTracks = 0;
  let microphoneRequests = 0;
  let resolveConnection;
  const track = { stop: () => stoppedTracks++, addEventListener: () => {} };
  const stream = { getTracks: () => [track], getAudioTracks: () => [track] };
  class AudioContext {
    constructor() { contexts.push(this); this.audioWorklet = { addModule: async () => {} }; }
    resume() { return Promise.resolve(); }
    close() { this.closed = true; return Promise.resolve(); }
    createMediaStreamSource() { return { connect() {}, disconnect() {} }; }
  }
  class AudioWorkletNode {
    constructor() { this.port = { postMessage: (data) => { this.stopRequested = data === 'stop'; } }; worklets.push(this); }
    connect() {}
    disconnect() {}
  }
  class GoogleGenAI {
    live = { connect: async ({ callbacks }) => {
      const session = { callbacks, sent: [], sendRealtimeInput(data) { this.sent.push(data); }, close() { this.closed = true; callbacks.onclose({}); } };
      sessions.push(session);
      if (deferredConnection) await new Promise((resolve) => { resolveConnection = resolve; });
      return session;
    } };
  }
  const react = {
    useRef(current) { const i=cursor++; if(!hookSlots[i]) hookSlots[i]={current}; return hookSlots[i]; },
    useCallback(fn,deps) { const i=cursor++; if(!hookSlots[i] || deps.some((v,j)=>!Object.is(v,hookSlots[i].deps[j]))) hookSlots[i]={fn,deps}; return hookSlots[i].fn; },
    useEffect(fn,deps) { const i=cursor++; if(!hookSlots[i] || deps.some((v,j)=>!Object.is(v,hookSlots[i].deps[j]))) { hookSlots[i]?.cleanup?.(); const cleanup=fn(); hookSlots[i]={deps,cleanup}; if(cleanup) cleanups.push(cleanup); } },
    useState(initial) { const i=cursor++; if(!hookSlots[i]) {hookSlots[i]={index:states.length}; states.push(initial);} const index=hookSlots[i].index; return [states[index],v=>{states[index]=v;}]; },
  };
  const globals = {
    AbortController, DOMException,
    navigator: { mediaDevices: { getUserMedia: async () => { microphoneRequests++; if (permissionError) throw permissionError; return stream; } } },
    window: { AudioContext, AudioWorkletNode, addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener: (name) => listeners.delete(name) },
    document: { hidden: false, addEventListener: (name, fn) => documentListeners.set(name, fn), removeEventListener: (name) => documentListeners.delete(name) },
    AudioContext, AudioWorkletNode,
    fetch: async () => ({ ok: true, json: async () => ({ token: 'test-token', model: 'test-model' }) }),
    btoa: (value) => Buffer.from(value, 'binary').toString('base64'),
    setTimeout: (fn, ms) => { const id = {}; timers.set(id, { fn, ms }); return id; },
    clearTimeout: (id) => timers.delete(id),
  };
  const mocks = { react, '@google/genai': { GoogleGenAI }, './transcription': { MAX_TRANSCRIPT_LENGTH: 4000, transcriptionConfig: {} } };
  mocks['./prepared-voice-connection'] = loadTs('lib/prepared-voice-connection.ts', mocks, globals);
  const { useMicrophone: mountVoiceHook } = loadTs('lib/use-microphone.ts', mocks, globals);
  const render = (enabled=true) => { cursor=0; return mountVoiceHook(text=>submissions.push(text),text=>recovered.push(text),enabled); };
  const voice = render();
  return {
    voice, render, states, submissions, recovered, sessions, worklets, contexts, listeners, timers,
    documentListeners, document: globals.document,
    get microphoneRequests() { return microphoneRequests; },
    get stoppedTracks() { return stoppedTracks; },
    resolveConnection: () => resolveConnection(),
    event: (content, index = sessions.length - 1) => sessions[index].callbacks.onmessage({ serverContent: content }),
    audio: (data) => worklets.at(-1).port.onmessage({ data }),
    unmount: () => cleanups.forEach((fn) => fn()),
  };
}

test('pauses submit final speech automatically and keep one microphone session open', async () => {
  const h = voiceHarness(); await h.voice.start();
  h.event({interimInputTranscription:{text:'Use a map'}});
  assert.equal(h.submissions.length,0);
  h.event({inputTranscription:{text:'Use a map.'}});
  assert.deepEqual(h.submissions,['Use a map.']);
  assert.equal(h.states[0],'recording');
  assert.equal(h.sessions[0].closed,undefined);
  assert.equal(h.contexts[0].closed,undefined);
  h.event({generationComplete:true}); h.event({turnComplete:true});
  assert.equal(h.submissions.length,1,'Completion messages must not duplicate speech');
  h.event({interimInputTranscription:{text:'Use a map'}});
  h.event({inputTranscription:{text:'Use a map.',finished:true}});
  assert.deepEqual(h.submissions,['Use a map.','Use a map.'],'Identical sentences in different turns are valid');
  assert.equal(h.microphoneRequests,1);
  assert.equal(h.sessions.length,1);
  h.unmount(); assert.equal(h.timers.size,0);
});

test('muting stops hardware immediately and flushes the last chunk before stream end', async () => {
  const h=voiceHarness(); await h.voice.start();
  h.event({interimInputTranscription:{text:'A final thought'}});
  h.audio({pcm:new Int16Array([2000,-2000]).buffer});
  h.voice.stop(); h.voice.stop();
  assert.equal(h.states[0],'finishing'); assert.ok(h.stoppedTracks > 0);
  h.audio({pcm:new Int16Array([2000,-2000]).buffer}); h.audio({stopped:true});
  assert.deepEqual(h.sessions[0].sent.map((entry)=>Object.keys(entry)[0]),['audio','audio','audioStreamEnd']);
  h.event({inputTranscription:{text:'A final thought.'}});
  assert.deepEqual(h.submissions,['A final thought.']);
  assert.equal(h.states[0],'idle'); assert.equal(h.contexts[0].closed,true);
  h.event({inputTranscription:{text:'Late duplicate'}});
  assert.equal(h.submissions.length,1); h.unmount();
});

test('silent microphone disable creates no empty message or error', async () => {
  const h=voiceHarness(); await h.voice.start();
  h.audio({pcm:new Int16Array([0,1,-1,0]).buffer});
  h.voice.stop(); h.audio({stopped:true});
  assert.equal(h.states[0],'idle'); assert.equal(h.states[2],'');
  assert.equal(h.submissions.length,0); assert.equal(h.contexts[0].closed,true); h.unmount();
});

test('lost focus preserves only unfinished speech and rejects late session events', async () => {
  const h=voiceHarness(); await h.voice.start();
  h.event({inputTranscription:{text:'Already submitted.'}});
  h.event({interimInputTranscription:{text:'An unfinished thought'}});
  h.listeners.get('blur')();
  assert.deepEqual(h.recovered,['An unfinished thought']);
  await h.voice.start();
  h.event({inputTranscription:{text:'Old session.'}},0);
  assert.deepEqual(h.submissions,['Already submitted.']);
  assert.equal(h.states[1],''); h.voice.cancel(); h.unmount();
});

test('disable during setup closes resources even when the provider resolves late', async () => {
  const h=voiceHarness({deferredConnection:true}); const starting=h.voice.start();
  await new Promise((resolve)=>setImmediate(resolve)); h.voice.stop(); h.resolveConnection(); await starting;
  assert.equal(h.states[0],'idle'); assert.equal(h.sessions[0].closed,true);
  assert.equal(h.contexts[0].closed,true); assert.ok(h.stoppedTracks > 0);
  assert.equal(h.worklets.length,0); h.unmount();
});

test('finalization timeout preserves the draft without inventing a final transcript', async () => {
  const h=voiceHarness(); await h.voice.start();
  h.event({interimInputTranscription:{text:'A partial thought'}});
  h.voice.stop(); h.audio({stopped:true});
  [...h.timers.values()].find((timer)=>timer.ms===12000).fn();
  assert.deepEqual(h.recovered,['A partial thought']); assert.equal(h.submissions.length,0);
  assert.match(h.states[2],/timed out/); h.unmount();
});

test('permission denial and oversized speech release resources and keep text usable', async () => {
  const denied=voiceHarness({permissionError:new DOMException('denied','NotAllowedError')});
  await denied.voice.start(); assert.equal(denied.states[0],'idle'); assert.match(denied.states[2],/permission was denied/);
  assert.ok(denied.sessions.every((session)=>session.sent.length===0)); denied.unmount();
  for (const field of ['interimInputTranscription','inputTranscription']) {
    const h=voiceHarness(); await h.voice.start(); h.event({[field]:{text:'x'.repeat(4001)}});
    assert.equal(h.recovered[0].length,4001); assert.equal(h.submissions.length,0);
    assert.equal(h.states[0],'idle'); assert.equal(h.contexts[0].closed,true); h.unmount();
  }
});

test('disconnects preserve unfinished speech and turn the microphone off', async () => {
  const h=voiceHarness(); await h.voice.start(); h.event({interimInputTranscription:{text:'Partial'}});
  h.sessions[0].callbacks.onerror({});
  assert.deepEqual(h.recovered,['Partial']); assert.equal(h.states[0],'idle');
  assert.ok(h.stoppedTracks > 0); assert.match(h.states[2],/lost its connection/); h.unmount();
});

function capture(sampleRate) {
  let Processor;
  const messages = [];
  class AudioWorkletProcessor { constructor() { this.port = { postMessage: (data) => messages.push(data) }; } }
  vm.runInNewContext(fs.readFileSync('public/audio/pcm-capture.js', 'utf8'), {
    AudioWorkletProcessor, sampleRate, registerProcessor: (_, cls) => { Processor = cls; },
  });
  return { processor: new Processor(), messages };
}

test('PCM conversion preserves 16kHz timing, little-endian samples, and the final partial chunk', () => {
  for (const rate of [16000, 44100, 48000]) {
    const { processor, messages } = capture(rate);
    const samples = new Float32Array(Math.round(rate * 0.125)).fill(0.5);
    for (let offset = 0; offset < samples.length; offset += 128) processor.process([[samples.slice(offset, offset + 128)]]);
    processor.port.onmessage({ data: 'stop' });
    const buffers = messages.filter((entry) => entry.pcm).map((entry) => Buffer.from(entry.pcm));
    const pcm = Buffer.concat(buffers);
    assert.ok(Math.abs(pcm.length / 2 - 2000) <= 1, `Wrong duration at ${rate}Hz`);
    assert.equal(buffers[0].length, 3200);
    assert.ok(buffers[1].length < 3200, 'Last chunk must flush even when not full');
    for (let i = 0; i < pcm.length; i += 2) assert.equal(pcm.readInt16LE(i), 16384);
    assert.equal(messages.at(-1).stopped, true);
    assert.equal(processor.process([[new Float32Array(128)]]), false);
  }
});

test('PCM capture mixes stereo to mono and clips without wrapping', () => {
  const { processor, messages } = capture(16000);
  processor.process([[new Float32Array([1, 2, -2]), new Float32Array([-1, 2, -2])]]);
  processor.port.onmessage({ data: 'stop' });
  const pcm = Buffer.from(messages[0].pcm);
  assert.deepEqual([0, 2, 4].map((offset) => pcm.readInt16LE(offset)), [0, 32767, -32768]);
});

test('token endpoint restricts origin and configuration and never returns permanent credentials', async () => {
  let config;
  const { POST } = loadTs('app/api/transcription/token/route.ts', {
    '@google/genai': { ApiError: class extends Error {}, GoogleGenAI: class {
      authTokens = { create: async (request) => { config = request.config; return { name: 'ephemeral-test-token' }; } };
    } },
    '@/lib/transcription': { transcriptionConfig: { responseModalities: ['TEXT'], realtimeInputConfig: { automaticActivityDetection: { disabled: false, silenceDurationMs: 900 } } } },
  }, { process: { env: { GEMINI_API_KEY: 'permanent-test-key' } }, Response, URL });
  const wrong = await POST(new Request('http://localhost:3000/api/transcription/token', { method: 'POST', headers: { origin: 'https://example.com' } }));
  assert.equal(wrong.status, 403);
  assert.equal(config, undefined);
  const response = await POST(new Request('http://localhost:3000/api/transcription/token', { method: 'POST', headers: { origin: 'http://localhost:3000' } }));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const body = await response.text();
  assert.ok(body.includes('ephemeral-test-token'));
  assert.ok(!body.includes('permanent-test-key'));
  assert.equal(config.uses, 1);
  assert.equal(config.liveConnectConstraints.model, 'gemini-3.5-transcribe-live');
  assert.equal(config.liveConnectConstraints.config.realtimeInputConfig.automaticActivityDetection.disabled, false);
  assert.ok(Date.parse(config.expireTime) <= Date.now() + 900000);
});

test('preloading opens the connection without microphone access, and enabling the mic consumes it', async () => {
  const h = voiceHarness();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(h.sessions.length, 1);
  assert.equal(h.states[3], true);
  assert.equal(h.microphoneRequests, 0);
  assert.equal(h.contexts.length, 0);
  assert.equal(h.sessions[0].sent.length, 0);
  await h.voice.start();
  assert.equal(h.sessions.length, 1, 'Use the already prepared connection');
  assert.equal(h.microphoneRequests, 1);
  h.voice.cancel();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(h.sessions[0].closed, true);
  assert.equal(h.sessions.length, 2, 'Prepare the next session after cancellation');
  assert.equal(h.microphoneRequests, 1);
  h.unmount();
});

test('idle expiry refreshes the connection without recording', async () => {
  const h = voiceHarness();
  await new Promise((resolve) => setImmediate(resolve));
  [...h.timers.values()].find((timer) => timer.ms === 120000).fn();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(h.sessions[0].closed, true);
  assert.equal(h.sessions.length, 2);
  assert.equal(h.microphoneRequests, 0);
  h.unmount();
});

test('hidden pages close preloading and visibility restores it', async () => {
  const h = voiceHarness();
  await new Promise((resolve) => setImmediate(resolve));
  h.document.hidden = true;
  h.documentListeners.get('visibilitychange')();
  assert.equal(h.sessions[0].closed, true);
  assert.equal(h.states[3], false);
  h.document.hidden = false;
  h.documentListeners.get('visibilitychange')();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(h.sessions.length, 2);
  assert.equal(h.states[3], true);
  assert.equal(h.microphoneRequests, 0);
  h.unmount();
});

function shortcutHarness(disabled=false,active=false) {
  const listeners=new Map(); let toggles=0; let cancels=0;
  const {useMicrophoneShortcut:mount}=loadTs('lib/use-microphone-shortcut.ts',{
    react:{useEffect:(fn)=>fn()},
  },{window:{addEventListener:(name,fn,capture)=>{assert.equal(capture,true);listeners.set(name,fn);},removeEventListener(){}}});
  mount({active,toggle:()=>toggles++,cancel:()=>cancels++},disabled);
  return {counts:()=>({toggles,cancels}),key(type,values){
    let prevented=false;
    listeners.get(type)?.({code:'Space',ctrlKey:false,altKey:false,metaKey:false,shiftKey:false,isComposing:false,repeat:false,preventDefault(){prevented=true;},stopPropagation(){},...values});
    return prevented;
  }};
}

test('Alt+Space toggles once per press, ignores release, and preserves ordinary typing',()=>{
  const h=shortcutHarness();
  assert.equal(h.key('keydown',{code:'KeyA'}),false);
  assert.equal(h.key('keydown',{}),false);
  assert.equal(h.key('keydown',{ctrlKey:true,altKey:true}),false);
  assert.equal(h.key('keydown',{altKey:true,shiftKey:true}),false);
  assert.equal(h.key('keydown',{altKey:true,isComposing:true}),false);
  assert.equal(h.key('keydown',{altKey:true}),true);
  h.key('keydown',{altKey:true,repeat:true}); h.key('keyup',{altKey:true});
  assert.deepEqual(h.counts(),{toggles:1,cancels:0});
  h.key('keydown',{altKey:true}); assert.deepEqual(h.counts(),{toggles:2,cancels:0});
  const disabled=shortcutHarness(true); assert.equal(disabled.key('keydown',{altKey:true}),false);
  const active=shortcutHarness(true,true); active.key('keydown',{altKey:true}); active.key('keydown',{code:'Escape'});
  assert.deepEqual(active.counts(),{toggles:1,cancels:1},'An active mic can be disabled even during an AI request');
});

test('waveform follows PCM volume and resets on mute, cancel, and capture failure',async()=>{
  const h=voiceHarness(); await h.voice.start();
  const loud=new Int16Array([12000,-12000,12000,-12000]).buffer;
  h.audio({pcm:loud}); assert.ok(h.states[4]>0 && h.states[4]<=1);
  h.audio({pcm:new ArrayBuffer(8)}); assert.equal(h.states[4],0);
  h.audio({pcm:loud}); h.voice.stop(); assert.equal(h.states[4],0);
  h.audio({pcm:loud}); assert.equal(h.states[4],0); h.voice.cancel();
  await h.voice.start(); h.audio({pcm:loud}); h.worklets.at(-1).onprocessorerror();
  assert.equal(h.states[4],0); assert.equal(h.states[0],'idle'); h.unmount();
});

test('provider session limit gracefully finishes instead of leaving an active mic',async()=>{
  const h=voiceHarness(); await h.voice.start();
  [...h.timers.values()].find((timer)=>timer.ms===9*60000).fn();
  assert.ok(h.stoppedTracks>0); h.audio({stopped:true});
  assert.equal(h.states[0],'idle'); assert.match(h.states[2],/session ended/); h.unmount();
});


test('disabling voice after an API failure preserves unfinished speech and allows fresh preloading on retry', async () => {
  const h=voiceHarness(); await h.voice.start();
  h.event({inputTranscription:{text:'Final sentence.'}});
  h.event({interimInputTranscription:{text:'Unfinished next sentence'}});
  h.render(false);
  assert.deepEqual(h.recovered,['Unfinished next sentence']);
  assert.equal(h.states[0],'idle'); assert.ok(h.stoppedTracks>0);
  h.event({inputTranscription:{text:'Late final'}});
  assert.deepEqual(h.submissions,['Final sentence.']);
  const restarted=h.render(true); await restarted.start();
  assert.equal(h.states[0],'recording');
  h.unmount();
});
