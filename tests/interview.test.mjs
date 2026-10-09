import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { webcrypto } from 'node:crypto';

function load(path, mocks = {}, globals = {}) {
  const loaded = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(code, { module: loaded, exports: loaded.exports, require: (name) => {
    assert.ok(name in mocks, `Unexpected dependency ${name}`); return mocks[name];
  }, ...globals });
  return loaded.exports;
}
const problems = load('lib/problems.ts');
const session = load('lib/interview-session.ts');
const skills = load('lib/skills.ts', {'./problems':problems});
const skillFeedback = load('lib/skill-feedback.ts', {'./skills':skills});
const details = load('lib/problem-details.ts', { 'server-only': {} });
const interview = load('lib/interview.ts', { './problems': problems, './problem-details': details, './interview-session': session });
function history(count, reply = false) {
  const messages = [{role:'assistant',content:'Let’s begin.'}];
  for (let i = 0; i < count; i++) {
    messages.push({role:'user',content:`Thought ${i + 1}`});
    if (reply || i < count - 1) messages.push({role:'assistant',content:`Question ${i + 1}`});
  }
  return messages;
}
function request(messages, mode = 'interview') {
  return {problemId:'two-sum',language:'python',code:'def two_sum(elements, target): pass',messages,mode};
}

test('Gemini failures distinguish access, configuration, quota, timeout and service errors without logging secrets', async () => {
  class ApiError extends Error {
    constructor(status) { super('Sensitive provider body and API key'); this.status = status; }
  }
  for (const [failure, status, message] of [
    [new ApiError(403), 502, /authenticate/],
    [new ApiError(400), 502, /rejected the request/],
    [new ApiError(429), 429, /quota/],
    [new ApiError(503), 502, /temporarily unavailable/],
    [Object.assign(new Error('Sensitive provider body'), {name:'AbortError'}), 504, /timed out/],
    [new Error('Sensitive provider body'), 502, /connect/],
  ]) {
    const logs = [];
    const route = load('app/api/interview/route.ts', {
      '@google/genai': {ApiError, GoogleGenAI: class {models = {generateContent:async()=>{throw failure;}};}},
      '@/lib/interview': interview, '@/lib/skills':skills, '@/lib/skill-feedback':skillFeedback,
    }, {process:{env:{GEMINI_API_KEY:'secret-test-key'}}, Request, Response, Error, console:{error:(...args)=>logs.push(args)}});
    const response = await route.POST(new Request('http://localhost/api/interview', {
      method:'POST', body:JSON.stringify(request(history(1))),
    }));
    assert.equal(response.status, status);
    assert.match((await response.json()).error, message);
    assert.equal(logs.length, 1);
    assert.doesNotMatch(JSON.stringify(logs), /secret-test-key|Sensitive provider body|def two_sum/);
  }
});

test('20 messages are accepted and end with feedback; a 21st is rejected', () => {
  const last = request(history(20));
  assert.ok(interview.parseInterviewRequest(last));
  assert.equal(interview.isFinalInterviewRequest(last), true);
  assert.equal(interview.parseInterviewRequest(request(history(21))), null);
  assert.equal(interview.isFinalInterviewRequest(request(history(19))), false);
  const contents = interview.buildInterviewContents(last);
  assert.equal(JSON.parse(contents[0].parts[0].text).requestedMode, 'feedback');
  assert.match(contents.at(-1).parts[0].text, /interview is now over/);
});

test('giving up supports zero messages or an assistant-ended history without adding a candidate message', () => {
  for (const count of [0, 1, 20]) {
    const data = request(history(count, true), 'feedback');
    assert.ok(interview.parseInterviewRequest(data));
    assert.equal(interview.isFinalInterviewRequest(data), true);
    assert.equal(session.countUserMessages(data.messages), count);
  }
  assert.equal(interview.parseInterviewRequest(request(history(1, true))), null);
});

test('bounded history preserves all 20 candidate turns and the latest message', () => {
  const original = history(20).map((message) => ({...message, content: message.role === 'user' ? 'u'.repeat(4000) : 'a'.repeat(12000)}));
  const bounded = session.prepareInterviewHistory(original);
  assert.equal(bounded.length, original.length);
  assert.equal(session.countUserMessages(bounded), 20);
  assert.ok(bounded.reduce((total, message) => total + message.content.length, 0) <= session.MAX_HISTORY_CHARACTERS);
  assert.equal(bounded.at(-1).content, original.at(-1).content);
  assert.match(bounded[0].content, /Earlier message shortened/);
  assert.equal(original[0].content.length, 12000, 'The displayed conversation must remain intact');
  assert.ok(interview.parseInterviewRequest(request(bounded, 'feedback')));
});

// A stateful component harness exercises UI transitions without a browser or
// provider. Hooks retain state between renders; API and voice are test doubles.
function workspace({deferredReplies = false} = {}) {
  const slots = []; let cursor = 0; let tree; let failNext = false; let dirty = false;
  let effects = []; const replies = [];
  const saved = [];
  const requests = []; const voice = {state:'idle',active:false,ready:true,preview:'',error:'',cancel(){},warm(){},start:async()=>{},stop(){},cancelHold(){}};
  let voiceEnabled; let transcript; let recover;
  const react = {
    useState(initial) { const index = cursor++; if (!(index in slots)) slots[index] = initial; return [slots[index], (value) => { const next = typeof value === 'function' ? value(slots[index]) : value; if (!Object.is(next,slots[index])) dirty = true; slots[index] = next; }]; },
    useRef(initial) { const index = cursor++; if (!(index in slots)) slots[index] = {current:initial}; return slots[index]; },
    useCallback(fn,deps) { const index=cursor++; if (!slots[index] || deps.some((value,i)=>!Object.is(value,slots[index].deps[i]))) slots[index]={fn,deps}; return slots[index].fn; },
    useEffect(fn,deps) { const index=cursor++; if (!slots[index] || deps.some((value,i)=>!Object.is(value,slots[index].deps[i]))) { slots[index]?.cleanup?.(); slots[index]={deps}; effects.push(()=>{slots[index].cleanup=fn();}); } },
  };
  const {default: Workspace} = load('app/interview-workspace.tsx', {
    react, 'react/jsx-runtime': {jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})},
    'next/dynamic': () => 'Editor', 'next/link':'Link', 'react-markdown':'Markdown', 'remark-gfm':()=>{},
    '@/lib/skills':skills, '@/lib/skill-store':{saveSkillSession:session=>{saved.push(session);return '';}}, './session-skills':{SessionSkills:'SessionSkills'},
    '@/lib/problems':problems, '@/lib/interview-session':session, '@/lib/transcription':{MAX_TRANSCRIPT_LENGTH:4000},
    '@/lib/use-microphone':{useMicrophone:(onTranscript, _onRecover, enabled)=>{transcript=onTranscript;recover=_onRecover;voiceEnabled=enabled;return voice;}},
    '@/lib/use-microphone-shortcut':{useMicrophoneShortcut(){}}, './microphone-button':{MicrophoneButton:'VoiceButton'}, './voice-waveform':{VoiceWaveform:'Waveform'},
  }, {
    window:{confirm:()=>true}, AbortSignal, queueMicrotask, crypto:webcrypto,
    fetch: async (_url, options) => {
      const payload = JSON.parse(options.body); requests.push(payload);
      if (deferredReplies) await new Promise((resolve)=>replies.push(resolve));
      const ok = !failNext; failNext = false;
      return {ok, json:async()=>ok ? {reply:payload.mode === 'feedback' ? 'What worked\nObserved reasoning.\nWhat to improve\nNext step' : 'Tell me more.',ended:interview.isFinalInterviewRequest(payload),...(interview.isFinalInterviewRequest(payload)?{assessment:{skills:[],cards:[]}}:{})} : {error:'Try again.'}};
    },
  });
  const render = () => {
    let attempts=0;
    do { dirty=false; cursor=0; effects=[]; tree=Workspace({initialProblemId:'two-sum'}); effects.forEach((effect)=>effect()); assert.ok(++attempts < 30,'Render did not settle'); } while(dirty);
    return tree;
  };
  function nodes(node) {
    if (!node || typeof node !== 'object') return [];
    if (Array.isArray(node)) return node.flatMap((child) => nodes(child));
    return [node, ...nodes(node.props?.children)];
  }
  const find = (predicate) => { const node=nodes(tree).find(predicate); assert.ok(node,'Missing element'); return node; };
  const settle = async () => { await new Promise((resolve)=>setImmediate(resolve)); render(); };
  render();
  return { requests, saved, render, settle, find, get voiceEnabled(){return voiceEnabled;}, failNext:()=>{failNext=true;},
    async reply() { assert.ok(replies.length); replies.shift()(); await settle(); },
    transcript:(text)=>transcript(text), recover:(text)=>recover(text),
    async send(text) {
      find((node)=>node.type==='textarea').props.onChange({target:{value:text}}); render();
      find((node)=>node.type==='form').props.onSubmit({preventDefault(){}}); render(); await settle();
    },
    async giveUp() { find((node)=>node.props?.className==='give-up-button').props.onClick(); render(); await settle(); },
  };
}

test('workspace ends automatically at 20; typed, voice, and review actions cannot add turn 21', async () => {
  const h=workspace();
  for(let i=1;i<=20;i++) await h.send(`My reasoning ${i}`);
  assert.equal(h.requests.length,20);
  assert.equal(h.requests.at(-1).mode,'feedback');
  assert.equal(session.countUserMessages(h.requests.at(-1).messages),20);
  assert.equal(h.find((node)=>node.type==='textarea').props.disabled,true);
  assert.equal(h.find((node)=>node.type==='VoiceButton').props.disabled,true);
  assert.equal(h.find((node)=>node.props?.className==='review-button').props.disabled,true);
  assert.equal(h.voiceEnabled,false);
  h.transcript('Late transcript'); await h.settle();
  await h.send('One more');
  assert.equal(h.requests.length,20);
});

test('give up uses the conversation and latest code; restart resets the count and retains code', async () => {
  const h=workspace();
  await h.send('I think a set could help.');
  h.find((node)=>node.type==='Editor').props.onChange('my latest code'); h.render();
  await h.giveUp();
  assert.equal(h.requests.at(-1).mode,'feedback');
  assert.equal(session.countUserMessages(h.requests.at(-1).messages),1);
  assert.equal(h.requests.at(-1).code,'my latest code');
  assert.equal(h.find((node)=>node.type==='textarea').props.disabled,true);
  h.find((node)=>node.type==='button' && node.props.children==='New interview').props.onClick(); h.render();
  assert.equal(h.find((node)=>node.type==='textarea').props.disabled,false);
  assert.equal(h.find((node)=>node.type==='Editor').props.value,'my latest code');
  assert.equal(h.voiceEnabled,true);
  await h.send('A new start');
  assert.equal(session.countUserMessages(h.requests.at(-1).messages),1);
});

test('failed final feedback remains retryable without consuming another turn', async () => {
  const h=workspace();
  h.failNext(); await h.giveUp();
  assert.equal(h.requests.length,1);
  assert.equal(session.countUserMessages(h.requests[0].messages),0);
  assert.equal(h.find((node)=>node.type==='textarea').props.disabled,true);
  h.find((node)=>node.type==='button' && node.props.children==='Retry feedback').props.onClick();
  await h.settle();
  assert.equal(h.requests.length,2);
  assert.deepEqual(h.requests[1],h.requests[0]);
});

test('continuous speech queues replies in order and preserves sentence-time code snapshots', async () => {
  const h=workspace({deferredReplies:true});
  h.find(n=>n.type==='Editor').props.onChange('first snapshot'); h.render();
  h.transcript('First sentence'); h.render(); await h.settle();
  assert.equal(h.requests.length,1);
  h.find(n=>n.type==='Editor').props.onChange('second snapshot'); h.render();
  h.transcript('Second sentence'); h.render(); await h.settle();
  assert.equal(h.requests.length,1,'No concurrent interviewer request');
  await h.reply(); await h.settle();
  assert.equal(h.requests.length,2);
  assert.equal(h.requests[0].code,'first snapshot');
  assert.equal(h.requests[1].code,'second snapshot');
  assert.deepEqual(h.requests[1].messages.slice(-3).map(m=>m.content),['First sentence','Tell me more.','Second sentence']);
  await h.reply();
});

test('a failed speech reply keeps subsequent speech queued until retry succeeds', async () => {
  const h=workspace({deferredReplies:true});
  h.failNext(); h.transcript('First sentence'); h.render(); await h.settle();
  h.transcript('Second sentence'); h.render(); await h.settle();
  await h.reply(); await h.settle();
  assert.equal(h.requests.length,1);
  assert.equal(h.voiceEnabled,false);
  h.recover('Unfinished third sentence'); h.render();
  h.find(n=>n.type==='button' && n.props.children==='Retry response').props.onClick();
  h.render(); await h.settle();
  assert.deepEqual(h.requests[1],h.requests[0]);
  await h.reply(); await h.settle();
  assert.equal(h.requests.length,3);
  assert.equal(h.requests[2].messages.at(-1).content,'Second sentence');
  await h.reply();
  assert.equal(h.find(n=>n.type==='textarea').props.value,'Unfinished third sentence');
  assert.equal(h.find(n=>n.type==='textarea').props.disabled,false);
});

test('queued continuous speech respects the 20-message cap', async () => {
  const h=workspace({deferredReplies:true});
  for(let i=1;i<=25;i++) { h.transcript(`Sentence ${i}`); h.render(); await h.settle(); }
  assert.equal(h.requests.length,1);
  assert.equal(h.voiceEnabled,false);
  for(let i=1;i<=20;i++) { await h.reply(); await h.settle(); }
  assert.equal(h.requests.length,20);
  assert.equal(h.requests.at(-1).messages.at(-1).content,'Sentence 20');
  assert.equal(h.requests.at(-1).mode,'feedback');
});


test('completed feedback saves one skill session, retries save only on success, and new interviews get distinct identities',async()=>{
  const h=workspace(); h.failNext(); await h.giveUp();
  assert.equal(h.saved.length,0);
  h.find(n=>n.type==='button'&&n.props.children==='Retry feedback').props.onClick();await h.settle();
  assert.equal(h.saved.length,1); assert.equal(h.saved[0].problemId,'two-sum');
  assert.equal(h.find(n=>n.type==='SessionSkills').props.session.id,h.saved[0].id);
  h.find(n=>n.type==='button'&&n.props.children==='New interview').props.onClick();h.render();
  await h.giveUp();assert.equal(h.saved.length,2);assert.notEqual(h.saved[1].id,h.saved[0].id);
});
