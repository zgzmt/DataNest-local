import { describe, expect, it, vi } from 'vitest';

vi.mock('vscode', () => ({
  CompletionItemKind: new Proxy({}, { get: () => 0 }),
  CompletionTriggerKind: { Invoke: 0, TriggerCharacter: 1, TriggerForIncompleteCompletions: 2 },
  CompletionItem: function CompletionItem() {
    return undefined;
  },
  SnippetString: function SnippetString() {
    return undefined;
  },
}));

import type { CompletionContext } from 'vscode';
import { SqlCompletionProvider } from '../../../../src/vscode/editor/completion';
import { RecordingLogger } from '../../../helpers/fakes';

/** How the editor asks: by hand (Ctrl+Space), or because a trigger character was typed. */
function asked(triggerCharacter?: string): CompletionContext {
  // The mocked module stands in for the enum, so the values are plain numbers here.
  return {
    triggerKind: 1,
    ...(triggerCharacter === undefined ? {} : { triggerCharacter }),
  } as unknown as CompletionContext;
}

const SPACE = asked(' ');
const NEWLINE = asked('\n');
const DOT = asked('.');
const BY_HAND = { triggerKind: 0 } as unknown as CompletionContext;

function provider(sql: string) {
  const get = vi.fn(() => undefined);
  const instance = new SqlCompletionProvider({
    editors: { bindings: { get } },
    store: { get: vi.fn() },
    manager: {},
    cache: {},
    logger: new RecordingLogger(),
  } as never);
  const document = {
    languageId: 'sql',
    uri: { toString: () => 'file:///a.sql' },
    getText: () => sql,
    offsetAt: () => sql.length,
  };
  return { provider: instance, get, document };
}

describe('completion triggers (V16.2)', () => {
  it('answers a space that ends FROM, JOIN, INTO, UPDATE or TABLE', async () => {
    for (const sql of [
      'SELECT * FROM ',
      'SELECT * FROM a JOIN ',
      'INSERT INTO ',
      'UPDATE ',
      'CREATE TABLE ',
    ]) {
      const { provider: instance, get, document } = provider(sql);
      await instance.provideCompletionItems(document as never, {} as never, {} as never, SPACE);
      expect(get, sql).toHaveBeenCalledTimes(1);
    }
  });

  it('answers a newline that ends such a word too', async () => {
    const { provider: instance, get, document } = provider('SELECT *\nFROM\n');
    await instance.provideCompletionItems(document as never, {} as never, {} as never, NEWLINE);
    expect(get).toHaveBeenCalledTimes(1);
  });

  it('stays quiet on a space elsewhere, so the list does not open mid-expression', async () => {
    for (const sql of [
      'SELECT ',
      'SELECT a, ',
      'SELECT * FROM t WHERE a = 1 ',
      'SELECT * FROM t ',
    ]) {
      const { provider: instance, get, document } = provider(sql);
      const items = await instance.provideCompletionItems(
        document as never,
        {} as never,
        {} as never,
        SPACE,
      );
      expect(items, sql).toBeUndefined();
      expect(get, sql).not.toHaveBeenCalled();
    }
  });

  it('still answers a dot and a request made by hand', async () => {
    for (const context of [DOT, BY_HAND]) {
      const { provider: instance, get, document } = provider('SELECT t. ');
      const items = await instance.provideCompletionItems(
        document as never,
        {} as never,
        {} as never,
        context,
      );
      expect(items === undefined).toBe(false);
      expect(get).toHaveBeenCalledTimes(1);
    }
  });
});
