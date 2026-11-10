import { describe, expect, it } from 'vitest';
import { statementRangeOf } from '../../../../src/vscode/editor/statement-range';

describe('statementRangeOf (V16.5)', () => {
  const good = { documentUri: 'file:///a.sql', start: 10, end: 20 };

  it('reads what a lens passes along', () => {
    expect(statementRangeOf(good)).toEqual(good);
  });

  it('accepts an empty statement: a lens may sit above nothing yet', () => {
    expect(statementRangeOf({ ...good, start: 5, end: 5 })).toEqual({ ...good, start: 5, end: 5 });
  });

  it('refuses anything that is not a range', () => {
    for (const args of [
      undefined,
      null,
      42,
      'file:///a.sql',
      {},
      { documentUri: 'file:///a.sql' },
      { documentUri: 1, start: 0, end: 1 },
      { documentUri: 'file:///a.sql', start: '0', end: 1 },
      { documentUri: 'file:///a.sql', start: 5, end: 4 },
      { documentUri: 'file:///a.sql', start: -1, end: 4 },
      { documentUri: 'file:///a.sql', start: Number.NaN, end: 4 },
      { documentUri: 'file:///a.sql', start: 0, end: Number.POSITIVE_INFINITY },
    ]) {
      expect(statementRangeOf(args), JSON.stringify(args)).toBeUndefined();
    }
  });

  it('keeps an empty document uri as given: the caller decides what to do with it', () => {
    expect(statementRangeOf({ ...good, documentUri: '' })).toEqual({ ...good, documentUri: '' });
  });
});
