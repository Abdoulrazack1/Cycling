// test/pagination.test.js — Cf. AUDIT item #27
// Vérifie que pageClause résiste aux injections SQL via les query params.
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { pageClause } = require('../src/config/database');

describe('pageClause (anti-injection)', () => {

  test('limite et offset valides', () => {
    const clause = pageClause(10, 20);
    assert.match(clause, /LIMIT 10 OFFSET 20/);
  });

  test('valeurs string sont parseInt', () => {
    const clause = pageClause('25', '50');
    assert.match(clause, /LIMIT 25 OFFSET 50/);
  });

  test('SQL injection dans limit est neutralisée', () => {
    const clause = pageClause('10; DROP TABLE users; --', '0');
    assert.ok(!clause.includes('DROP'), `clause ne doit pas contenir DROP : ${clause}`);
    assert.match(clause, /LIMIT \d+ OFFSET \d+/);
  });

  test('valeurs négatives sont clampées à 0', () => {
    const clause = pageClause(-5, -10);
    assert.match(clause, /LIMIT (10|50) OFFSET 0/); // default limit kicks in
  });

  test('limit dépasse maxLimit est clampé', () => {
    const clause = pageClause(99999, 0, { maxLimit: 100 });
    assert.match(clause, /LIMIT 100 /);
  });

  test('valeurs undefined/null utilisent le défaut', () => {
    const clause = pageClause(undefined, undefined, { defaultLimit: 25 });
    assert.match(clause, /LIMIT 25 OFFSET 0/);
  });

});
