import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function load(path,mocks={},globals={}) {
  const loaded={exports:{}};
  const code=ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
  vm.runInNewContext(code,{module:loaded,exports:loaded.exports,require:name=>{assert.ok(name in mocks,`Unexpected ${name}`);return mocks[name];},...globals});
  return loaded.exports;
}
const problems=load('lib/problems.ts');
const skills=load('lib/skills.ts',{'./problems':problems});
const schema=load('lib/skill-feedback.ts',{'./skills':skills});
const anki=load('lib/anki.ts');
const observation={skillId:'testing',status:'practise',evidence:{source:'candidate',quote:'I only tested one example.'},explanation:'Only one test was considered.',nextStep:'Try empty input and a no-solution case.'};
const assessment={skills:[observation],cards:[{skillId:'testing',front:'Which boundary cases should you test for an array?',back:'Empty input, one element, repeated values, and no solution.'}]};
const data={problemId:'two-sum',language:'python',code:problems.getProblem('two-sum').starters.python,messages:[{role:'user',content:'I only tested one example.'}],mode:'feedback'};
const session=(id='a',completedAt='2026-10-09T10:00:00.000Z',value=assessment)=>({...value,id,completedAt,problemId:'two-sum',language:'python'});

test('final assessment requires real candidate evidence and rejects interviewer or untouched starter evidence',()=>{
  const feedback={reply:'What worked\nWhat to improve\nNext step',...assessment};
  assert.ok(skills.parseFinalFeedback(JSON.stringify(feedback),data));
  assert.equal(skills.parseFinalFeedback(JSON.stringify(feedback),{...data,messages:[{role:'assistant',content:observation.evidence.quote}]}),null);
  assert.equal(skills.parseFinalFeedback(JSON.stringify({...feedback,skills:[{...observation,evidence:{source:'code',quote:'pass'}}]}),data),null);
  assert.ok(skills.parseFinalFeedback(JSON.stringify({...feedback,skills:[{...observation,evidence:{source:'code',quote:'return False'}}]}),{...data,code:'def two_sum(elements, target):\n    return False'}));
  assert.equal(skills.parseFinalFeedback('not JSON',data),null);
  assert.ok(skills.parseFinalFeedback(JSON.stringify({reply:'No work observed.',skills:[],cards:[]}),{...data,messages:[{role:'assistant',content:'Start here.'}]}));
});

test('invalid, duplicated, oversized observations and unrelated flashcards are rejected',()=>{
  for(const invalid of [
    {...assessment,skills:[observation,observation]},
    {...assessment,skills:[{...observation,skillId:'invented'}]},
    {...assessment,skills:[{...observation,status:'expert'}]},
    {...assessment,skills:[{...observation,explanation:'x'.repeat(801)}]},
    {...assessment,cards:[{...assessment.cards[0],skillId:'memory'}]},
    {...assessment,cards:Array(7).fill(assessment.cards[0])},
    {...assessment,skills:[{...observation,status:'strength'}]},
  ]) assert.equal(skills.parseAssessment(invalid),null);
  assert.deepEqual(JSON.parse(JSON.stringify(skills.parseAssessment({...assessment,untrusted:'discard me'}))),assessment);
});

test('skill history shows latest observations and retains evidence across problems without treating missing skills as weaknesses',()=>{
  const summary=skills.summarizeSkills([session(),session('b','2026-10-10T10:00:00Z',{skills:[{...observation,status:'strength'}],cards:[]})]);
  const testing=summary.find(skill=>skill.id==='testing');
  assert.equal(testing.latest.status,'strength');
  assert.equal(testing.change,'Improved since previous observation');
  assert.equal(testing.observations.length,2);
  assert.equal(summary.find(skill=>skill.id==='memory').latest,undefined);
  assert.equal(skills.parseSkillHistory('{broken'),null);
  assert.equal(skills.parseSkillHistory(JSON.stringify({version:3,sessions:[]})),null);
  assert.equal(skills.parseSkillHistory(JSON.stringify({version:1,sessions:[session(),session()]})),null);
  assert.equal(skills.parseSkillHistory(JSON.stringify({version:1,sessions:[session('a','invalid')]})),null);
});

function storeHarness({denied=false,corrupt=false}={}) {
  const map=new Map(); if(corrupt) map.set('thinkingaloud.skills.v1','broken');
  let notify=0;const events=new Map(); let fail=denied;
  const localStorage={getItem:key=>{if(fail)throw Error('blocked');return map.get(key)??null;},setItem:(key,value)=>{if(fail)throw Error('blocked');map.set(key,value);}};
  const store=load('lib/skill-store.ts',{'./skills':skills,react:{useSyncExternalStore:(subscribe,read)=>{subscribe(()=>notify++);return read();}}},{window:{localStorage,addEventListener:(name,fn)=>events.set(name,fn),removeEventListener:()=>{}}});
  return {store,map,events,localStorage,get notify(){return notify;},allow:()=>{fail=false;}};
}

test('saved sessions survive reload, retries deduplicate, clearing and cross-tab updates notify the dashboard',()=>{
  const h=storeHarness();h.store.useSkillHistory();
  assert.equal(h.store.saveSkillSession(session()),'');assert.equal(h.notify,1);
  assert.equal(h.store.saveSkillSession(session()),'');
  assert.equal(h.store.useSkillHistory().sessions.length,1);
  const restored=skills.parseSkillHistory(h.map.get(h.store.SKILL_STORAGE_KEY));assert.equal(restored[0].cards[0].front,assessment.cards[0].front);
  h.map.set(h.store.SKILL_STORAGE_KEY,JSON.stringify({version:1,sessions:[session('b')]}));h.events.get('storage')({key:h.store.SKILL_STORAGE_KEY});
  assert.equal(h.store.useSkillHistory().sessions[0].id,'b');
  h.store.clearSkillHistory();assert.equal(h.store.useSkillHistory().sessions.length,0);
});

test('bounded storage keeps the latest 100 interviews and does not overwrite corrupt progress',()=>{
  const h=storeHarness();
  for(let i=0;i<105;i++) h.store.saveSkillSession(session(String(i),new Date(Date.UTC(2026,0,1,i)).toISOString()));
  assert.equal(h.store.useSkillHistory().sessions.length,100);
  assert.equal(h.store.useSkillHistory().sessions[0].id,'5');
  const broken=storeHarness({corrupt:true});
  assert.match(broken.store.saveSkillSession(session()),/could not be read/);
  assert.equal(broken.map.get(broken.store.SKILL_STORAGE_KEY),'broken');
  broken.store.clearSkillHistory();assert.equal(broken.store.saveSkillSession(session()),'');
});

test('unavailable storage preserves progress in memory with a visible warning and can recover',()=>{
  const h=storeHarness({denied:true});
  assert.match(h.store.saveSkillSession(session()),/could not be saved/);
  assert.equal(h.store.useSkillHistory().sessions.length,1);
  h.allow(); assert.equal(h.store.saveSkillSession(session('b')),'');
  assert.equal(skills.parseSkillHistory(h.map.get(h.store.SKILL_STORAGE_KEY)).length,2);
});

test('Anki export escapes HTML, quotes, multiline C++ and tabs; tags are mapped and repeated fronts update deterministically',()=>{
  const card={skillId:'testing',front:'What does vector<int> & "value" mean?\nNext\tline',back:'<script>alert(1)</script>\nstd::vector<int> xs;\r\nreturn "ok";'};
  const old=session('a','2026-10-09T00:00:00Z',{skills:[observation],cards:[{...card,back:'old answer'}]});
  const latest=session('b','2026-10-10T00:00:00Z',{skills:[observation],cards:[card]});
  const exported=anki.exportAnki([old,latest]);
  assert.match(exported,/#separator:Tab\n#html:true\n#notetype:Basic\n#tags column:3/);
  const rows=exported.split('\n').filter(line=>line&&!line.startsWith('#'));
  assert.equal(rows.length,1);assert.equal(rows[0].split('\t').length,3);
  assert.match(rows[0],/vector&lt;int&gt; &amp; ""value""/);
  assert.match(rows[0],/&lt;script&gt;alert\(1\)&lt;\/script&gt;<br>/);
  assert.match(rows[0],/Next    line/);assert.doesNotMatch(exported,/<script>|old answer/);
  assert.match(rows[0],/skill::testing problem::two-sum/);
  assert.equal(anki.exportAnki([]),'');
});

test('final endpoint requests structured skills, validates grounding, and ordinary interview replies remain plain text',async()=>{
  const interviewSession=load('lib/interview-session.ts');
  const details=load('lib/problem-details.ts',{'server-only':{}});
  const interview=load('lib/interview.ts',{'./problems':problems,'./problem-details':details,'./interview-session':interviewSession});
  let config;let responseText=JSON.stringify({reply:'What worked\nWhat to improve\nNext step',...assessment});
  const route=load('app/api/interview/route.ts',{'@google/genai':{ApiError:class extends Error {},GoogleGenAI:class {models={generateContent:async options=>{config=options.config;return{text:responseText};}};}},'@/lib/interview':interview,'@/lib/skills':skills,'@/lib/skill-feedback':schema},{Request,Response,process:{env:{GEMINI_API_KEY:'test-secret'}}});
  const post=payload=>route.POST(new Request('http://localhost/api/interview',{method:'POST',body:JSON.stringify(payload)}));
  let response=await post(data);assert.equal(response.status,200);assert.equal((await response.json()).assessment.skills[0].skillId,'testing');
  assert.equal(config.responseMimeType,'application/json');assert.ok(config.responseJsonSchema);
  responseText=JSON.stringify({reply:'Feedback',...assessment,skills:[{...observation,evidence:{source:'candidate',quote:'Invented evidence'}}]});
  response=await post(data);assert.equal(response.status,502);assert.match((await response.json()).error,/retry feedback/);
  responseText='Tell me more.';response=await post({...data,mode:'interview'});
  assert.equal((await response.json()).reply,'Tell me more.');assert.equal(config.responseMimeType,undefined);
});

test('Anki download creates a UTF-8 text file, clicks the download link, and releases its temporary URL',()=>{
  let blob,created,clicked=false,removed=false,revoked,cleanup;
  const anchor={click(){clicked=true;},remove(){removed=true;}};
  const downloader=load('lib/anki.ts',{}, {
    Blob:class {constructor(parts,options){blob={parts,options};}},
    URL:{createObjectURL:()=> 'blob:anki-test',revokeObjectURL:url=>{revoked=url;}},
    document:{createElement:()=>anchor,body:{appendChild:element=>{created=element;}}},
    setTimeout:fn=>{cleanup=fn;},
  });
  downloader.downloadAnki([session()]);
  assert.equal(anchor.download,'thinkingaloud-anki.txt');assert.equal(anchor.href,'blob:anki-test');
  assert.equal(blob.options.type,'text/plain;charset=utf-8');assert.match(blob.parts[0],/#columns:Front\tBack\tTags/);
  assert.equal(created,anchor);assert.equal(clicked,true);assert.equal(removed,true);
  cleanup();assert.equal(revoked,'blob:anki-test');
});


test('legacy skill history migrates merged skills and cards without inventing new technical evidence',()=>{
  const legacy={skills:[
    {...observation,skillId:'requirements',status:'strength'},
    {...observation,skillId:'reasoning',explanation:'Explain assumptions before coding.'},
    {...observation,skillId:'correctness'},
    {...observation,skillId:'testing',status:'strength'},
    {...observation,skillId:'compilers'},
  ],cards:[
    {...assessment.cards[0],skillId:'correctness'},
    {...assessment.cards[0],skillId:'compilers'},
  ]};
  const migrated=skills.parseSkillHistory(JSON.stringify({version:1,sessions:[session('old',undefined,legacy)]}));
  assert.ok(migrated);
  assert.deepEqual(Array.from(migrated[0].skills,item=>item.skillId),['reasoning','testing']);
  assert.ok(migrated[0].skills.every(item=>item.status==='practise'));
  assert.equal(migrated[0].skills[0].explanation,'Explain assumptions before coding.');
  assert.equal(migrated[0].cards.length,1);assert.equal(migrated[0].cards[0].skillId,'testing');
  assert.equal(skills.summarizeSkills(migrated).find(skill=>skill.id==='structures').latest,undefined);
  assert.equal(skills.parseAssessment(legacy),null,'Legacy IDs must not be accepted from the model');
  const current=session('new',undefined,{skills:[{...observation,skillId:'structures'}],cards:[{...assessment.cards[0],skillId:'structures'}]});
  assert.ok(skills.parseSkillHistory(JSON.stringify({version:2,sessions:[current]})));
  assert.equal(skills.parseSkillHistory(JSON.stringify({version:1,sessions:[current]})),null);
  const h=storeHarness();h.map.set(h.store.SKILL_STORAGE_KEY,JSON.stringify({version:1,sessions:[session('old',undefined,legacy)]}));
  assert.equal(h.store.saveSkillSession(current),'');
  assert.equal(JSON.parse(h.map.get(h.store.SKILL_STORAGE_KEY)).version,2);
  assert.equal(h.store.useSkillHistory().sessions.length,2);
});

test('Elo updates depend on problem difficulty and leave unobserved skills unrated',()=>{
  const rated=(difficulty,status)=>skills.summarizeSkills([{...session(),difficulty,skills:[{...observation,status}]}]).find(skill=>skill.id==='testing');
  assert.equal(rated('Medium','strength').rating,1220);
  assert.equal(rated('Medium','practise').rating,1180);
  assert.ok(rated('Expert','strength').delta > rated('Easy','strength').delta);
  assert.ok(Math.abs(rated('Easy','practise').delta) > Math.abs(rated('Expert','practise').delta));
  const missing=skills.summarizeSkills([session()]).find(skill=>skill.id==='memory');
  assert.equal(missing.rating,1200); assert.equal(missing.ratedProblems,0); assert.equal(missing.latest,undefined);
});

test('ratings replay chronologically, deduplicate retries, and reduce repeat-problem weight',()=>{
  const first={...session('first','2026-10-09T00:00:00Z'),difficulty:'Medium',skills:[{...observation,status:'strength'}]};
  const second={...first,id:'second',completedAt:'2026-10-10T00:00:00Z'};
  const find=list=>skills.summarizeSkills(list).find(skill=>skill.id==='testing');
  assert.equal(find([second,first]).rating,find([first,second]).rating);
  assert.equal(find([first,first]).rating,find([first]).rating);
  assert.ok(find([first,second]).observations[0].delta < find([first]).delta);
  assert.equal(find([first,second]).ratedProblems,1);assert.equal(find([first,second]).provisional,true);
  const distinct=['two-sum','valid-parentheses','longest-substring','merge-intervals','shortest-path'].map((problemId,i)=>({...first,problemId,id:String(i),completedAt:new Date(Date.UTC(2026,9,9+i)).toISOString()}));
  assert.equal(find(distinct).provisional,false);
  assert.equal(find(distinct).ratedProblems,5);
});

test('difficulty snapshots survive storage and legacy history derives its problem difficulty',()=>{
  const snapshot={...session(),difficulty:'Expert'};
  const parsed=skills.parseSkillHistory(JSON.stringify({version:2,sessions:[snapshot]}));
  assert.equal(parsed[0].difficulty,'Expert');
  assert.equal(skills.summarizeSkills(parsed).find(skill=>skill.id==='testing').latest.problemRating,1600);
  assert.equal(skills.parseSkillSession({...session(),difficulty:'Unknown'}),null);
  assert.equal(skills.parseSkillSession(session()).difficulty,'Easy');
});
