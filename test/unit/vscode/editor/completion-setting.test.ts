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

import { SqlCompletionProvider } from '../../../../src/vscode/editor/completion';
import { RecordingLogger } from '../../../helpers/fakes';

function provider(enabled?: () => boolean) {
  const get = vi.fn(() => undefined);
  const deps = {
    editors: { bindings: { get } },
    store: { get: vi.fn() },
    manager: {},
    cache: {},
    logger: new RecordingLogger(),
    ...(enabled === undefined ? {} : { enabled }),
  };
  return { provider: new SqlCompletionProvider(deps as never), get };
}

/** How the editor asks when the user calls completion by hand or types a word. */
const INVOKED = { triggerKind: 0 } as never;

const document = {
  languageId: 'sql',
  uri: { toString: () => 'file:///a.sql' },
  getText: () => 'SEL',
  offsetAt: () => 3,
};

describe('the completion setting (V13.4)', () => {
  it('offers nothing and looks at nothing while it is off', async () => {
    const { provider: off, get } = provider(() => false);
    expect(
      await off.provideCompletionItems(document as never, {} as never, {} as never, INVOKED),
    ).toEqual([]);
    expect(get).not.toHaveBeenCalled();
  });

  it('asks again on every request, so switching it needs no restart', async () => {
    let on = false;
    const { provider: live, get } = provider(() => on);
    await live.provideCompletionItems(document as never, {} as never, {} as never, INVOKED);
    expect(get).not.toHaveBeenCalled();
    on = true;
    const items = await live.provideCompletionItems(
      document as never,
      {} as never,
      {} as never,
      INVOKED,
    );
    expect(get).toHaveBeenCalledTimes(1);
    expect(items?.length).toBeGreaterThan(0);
  });

  it('is on when nothing says otherwise', async () => {
    const { provider: plain } = provider();
    expect(
      (
        (await plain.provideCompletionItems(
          document as never,
          {} as never,
          {} as never,
          INVOKED,
        )) ?? []
      ).length,
    ).toBeGreaterThan(0);
  });
});
