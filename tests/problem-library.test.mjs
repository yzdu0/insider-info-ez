import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function load(path, mocks = {}) {
  const loaded = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  vm.runInNewContext(code, { module: loaded, exports: loaded.exports, require: (name) => {
    assert.ok(name in mocks, `Unexpected dependency ${name}`);
    return mocks[name];
  } });
  return loaded.exports;
}
const library = load('lib/problems.ts');
const details = load('lib/problem-details.ts', { 'server-only': {} });
const session = load('lib/interview-session.ts');
const interview = load('lib/interview.ts', { './problems': library, './problem-details': details, './interview-session': session });

test('Every problem appears in one known category with a valid starter and private contract', () => {
  assert.equal(new Set(library.problems.map((problem) => problem.id)).size, library.problems.length);
  for (const problem of library.problems) {
    assert.ok(library.categories.includes(problem.category), problem.id);
    assert.equal(typeof problem.starters[problem.preferredLanguage], 'string', problem.id);
    const contract = details.problemDetails[problem.id];
    assert.ok(contract?.description && contract.examples.length && contract.constraints.length, problem.id);
  }
});

test('All OOP exercises accept each offered language through the interview API validator', () => {
  const problems = library.problems.filter((problem) => problem.category === 'OOP');
  assert.equal(problems.length, 6);
  for (const problem of problems) {
    for (const [language, code] of Object.entries(problem.starters)) {
      assert.ok(interview.parseInterviewRequest({ problemId: problem.id, language, code, mode: 'interview', messages: [{ role: 'user', content: 'What operations should the class support?' }] }), `${problem.id}: ${language}`);
    }
  }
});
