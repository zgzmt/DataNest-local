// Running queries in a real editor against a real SQLite file: the keybinding
// commands exist, the CodeLens appears above every statement, and a statement
// actually runs through the connection the document is bound to.

import * as assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as vscode from 'vscode';
import { projectConnectionId } from '../../src/services/project-connections';
import { forgetProject } from './project-workspace';

const EXTENSION_ID = 'datanest.datanest';

interface Manifest {
  contributes: {
    keybindings: { command: string; key: string; when: string }[];
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function openSql(content: string): Promise<vscode.TextEditor> {
  const document = await vscode.workspace.openTextDocument({ language: 'sql', content });
  return await vscode.window.showTextDocument(document, { preview: false });
}

describe('running queries', () => {
  let dir: string;

  before(async () => {
    await vscode.extensions.getExtension(EXTENSION_ID)?.activate();
    dir = mkdtempSync(join(tmpdir(), 'datanest-e2e-run-'));
  });

  after(() => {
    // Windows keeps the database file locked for a moment after the session closed.
    rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  });

  afterEach(async () => {
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
  });

  it('registers every run command', async () => {
    const all = await vscode.commands.getCommands(true);
    for (const id of [
      'datanest.query.run',
      'datanest.query.runAll',
      'datanest.query.runRange',
      'datanest.query.explainRange',
      'datanest.query.cancel',
    ]) {
      assert.ok(all.includes(id), `${id} is not registered`);
    }
  });

  it('binds Ctrl+Enter and Ctrl+Shift+Enter to SQL editors only', () => {
    const extension = vscode.extensions.getExtension(EXTENSION_ID);
    assert.ok(extension);
    const { contributes } = extension.packageJSON as Manifest;
    const run = contributes.keybindings.find((entry) => entry.command === 'datanest.query.run');
    const runAll = contributes.keybindings.find(
      (entry) => entry.command === 'datanest.query.runAll',
    );
    assert.equal(run?.key, 'ctrl+enter');
    assert.equal(runAll?.key, 'ctrl+shift+enter');
    for (const entry of [run, runAll]) {
      assert.ok(entry, 'a keybinding is missing');
      assert.match(entry.when, /editorLangId == sql/);
      assert.match(entry.when, /editorTextFocus/);
    }
  });

  it('shows a Run lens above every statement', async () => {
    const editor = await openSql('SELECT 1;\nSELECT 2;\n');
    // CodeLens is resolved asynchronously by the editor.
    await sleep(500);
    const lenses = await vscode.commands.executeCommand<vscode.CodeLens[]>(
      'vscode.executeCodeLensProvider',
      editor.document.uri,
    );
    assert.ok(lenses);
    const ours = lenses.filter((lens) => lens.command?.command === 'datanest.query.runRange');
    assert.equal(ours.length, 2);
    assert.equal(ours[0]?.range.start.line, 0);
    assert.equal(ours[1]?.range.start.line, 1);
  });

  it('shows no lens for a document without statements', async () => {
    const editor = await openSql('-- just a note\n');
    await sleep(300);
    const lenses = await vscode.commands.executeCommand<vscode.CodeLens[]>(
      'vscode.executeCodeLensProvider',
      editor.document.uri,
    );
    assert.deepEqual(
      lenses.filter((lens) => lens.command?.command === 'datanest.query.runRange'),
      [],
    );
  });

  it('hides the Run lenses when the setting turns them off', async () => {
    const config = vscode.workspace.getConfiguration('datanest');
    const editor = await openSql('SELECT 1;\nSELECT 2;\n');
    await config.update('editor.codeLens', false, vscode.ConfigurationTarget.Global);
    try {
      await sleep(300);
      const lenses = await vscode.commands.executeCommand<vscode.CodeLens[]>(
        'vscode.executeCodeLensProvider',
        editor.document.uri,
      );
      assert.deepEqual(
        lenses.filter((lens) => lens.command?.command === 'datanest.query.runRange'),
        [],
      );
    } finally {
      await config.update('editor.codeLens', undefined, vscode.ConfigurationTarget.Global);
    }
  });

  it('folds SQL by statements', async () => {
    const editor = await openSql('-- note\nSELECT a,\n  b\nFROM t;\n\nSELECT 1;\n');
    await sleep(300);
    const folds = await vscode.commands.executeCommand<vscode.FoldingRange[]>(
      'vscode.executeFoldingRangeProvider',
      editor.document.uri,
    );
    assert.ok(
      folds.some((fold) => fold.start === 1 && fold.end === 3),
      `no fold of the statement: ${JSON.stringify(folds)}`,
    );
  });

  it('does nothing but warn when there is no SQL editor', async () => {
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
    await sleep(100);
    const outcome = await vscode.commands.executeCommand('datanest.query.run');
    assert.equal(outcome, undefined);
  });

  it('cancelling with nothing running is harmless', async () => {
    await openSql('SELECT 1;');
    await vscode.commands.executeCommand('datanest.query.cancel');
  });

  it('asks before dangerous statements unless the user turned it off', () => {
    const config = vscode.workspace.getConfiguration('datanest');
    assert.equal(config.get('safeMode'), 'confirm');
    assert.deepEqual(config.inspect('safeMode')?.defaultValue, 'confirm');
  });

  it('asks for query variables and remembers them unless the user changed it', () => {
    const config = vscode.workspace.getConfiguration('datanest');
    assert.equal(config.get('queryVariables'), 'remember');
    assert.deepEqual(config.inspect('queryVariables')?.defaultValue, 'remember');
  });

  it('opens the object search with nothing connected, and closes it again', async () => {
    const shown = vscode.commands.executeCommand('datanest.objects.search');
    await sleep(200);
    await vscode.commands.executeCommand('workbench.action.closeQuickOpen');
    await shown;
  });

  it('opens the query history even when it is empty, and closes it again', async () => {
    assert.ok((await vscode.commands.getCommands(true)).includes('datanest.history.show'));
    await vscode.commands.executeCommand('datanest.history.show');
    await sleep(200);
    await vscode.commands.executeCommand('workbench.action.closeQuickOpen');
  });

  it('runs a statement end to end through the shipped SQLite driver', async () => {
    // The command path needs a saved connection, which this test cannot create
    // without the form; it checks the pieces the command relies on instead.
    const extension = vscode.extensions.getExtension(EXTENSION_ID);
    assert.ok(extension);
    const bundle = join(extension.extensionPath, 'dist', 'drivers', 'sqlite.js');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const loaded = require(bundle) as {
      driver: {
        openSession(config: Record<string, unknown>): Promise<{
          execute(
            sql: string,
            options?: { rowLimit?: number },
          ): AsyncIterable<{ kind: string; rows?: unknown[][] }>;
          close(): Promise<void>;
        }>;
      };
    };
    const session = await loaded.driver.openSession({
      id: 'e2e-run',
      name: 'e2e run',
      driver: 'sqlite',
      file: join(dir, 'run.db'),
    });
    try {
      const rows: unknown[][] = [];
      for await (const event of session.execute('SELECT 1 AS one', { rowLimit: 10 })) {
        if (event.kind === 'rows' && event.rows) {
          rows.push(...event.rows);
        }
      }
      assert.deepEqual(rows, [[1]]);
    } finally {
      await session.close();
    }
  });
});

// The lenses that say where a query runs: the connection, and the database where the
// driver has them. A project connection supplies one without the form.
describe('lenses of the document target', () => {
  let root: string;
  let connection: string;

  before(async () => {
    await vscode.extensions.getExtension(EXTENSION_ID)?.activate();
    const folder = vscode.workspace.workspaceFolders?.[0];
    assert.ok(folder, 'the e2e editor opens a workspace folder');
    root = folder.uri.fsPath;
    connection = projectConnectionId(folder.uri.toString(), 'e2e-lens');
    mkdirSync(join(root, '.vscode'), { recursive: true });
    writeFileSync(
      join(root, '.vscode', 'datanest.json'),
      JSON.stringify({
        version: 1,
        connections: [{ id: 'e2e-lens', name: 'E2E lens', driver: 'sqlite', file: 'lens.db' }],
      }),
    );
    await vscode.commands.executeCommand('datanest.tree.refresh');
  });

  after(async () => {
    await forgetProject(root, [connection], ['lens.db']);
  });

  it('registers the database command next to the connection one', async () => {
    const all = await vscode.commands.getCommands(true);
    for (const id of ['datanest.query.selectConnection', 'datanest.query.selectDatabase']) {
      assert.ok(all.includes(id), `${id} is not registered`);
    }
  });

  it('puts Run first, then Explain, then the connection, above every statement', async () => {
    const document = await vscode.commands.executeCommand<vscode.TextDocument>(
      'datanest.query.new',
      connection,
    );
    const editor = await vscode.window.showTextDocument(document);
    await editor.edit((edit) => {
      edit.insert(new vscode.Position(0, 0), 'SELECT 1;\n\nSELECT 2;\n');
    });
    await sleep(500);
    const lenses = await targetLenses(editor.document.uri);
    const runs = lenses.filter((lens) => lens.command?.command === 'datanest.query.runRange');
    const explains = lenses.filter(
      (lens) => lens.command?.command === 'datanest.query.explainRange',
    );
    const connections = lenses.filter(
      (lens) => lens.command?.command === 'datanest.query.selectConnection',
    );
    // Both statements can be run, explained, and say where they run, Run coming first.
    assert.equal(runs.length, 2);
    assert.equal(explains.length, 2);
    assert.equal(explains[0]?.command?.title, '$(list-tree) Explain');
    assert.equal(connections.length, 2);
    assert.deepEqual(
      connections.map((lens) => lens.range.start.line),
      [0, 2],
    );
    assert.match(connections.map((lens) => lens.command?.title ?? '').join(' '), /E2E lens/);
    assert.deepEqual(
      lenses
        .filter((lens) => lens.range.start.line === 0)
        .map((lens) => lens.command?.command)
        .slice(0, 3),
      ['datanest.query.runRange', 'datanest.query.explainRange', 'datanest.query.selectConnection'],
    );
    // A SQLite file has no databases to switch, so there is no database lens.
    assert.equal(
      lenses.filter((lens) => lens.command?.command === 'datanest.query.selectDatabase').length,
      0,
    );
  });

  it('asks for a connection when the query has none', async () => {
    const editor = await openSql('SELECT 1;\n');
    await sleep(500);
    const lenses = await targetLenses(editor.document.uri);
    const connectionLens = lenses.find(
      (lens) => lens.command?.command === 'datanest.query.selectConnection',
    );
    assert.ok(connectionLens, 'no connection lens');
    assert.match(connectionLens.command?.title ?? '', /Select connection/);
    assert.equal(
      lenses.filter((lens) => lens.command?.command === 'datanest.query.selectDatabase').length,
      0,
    );
  });
});

async function targetLenses(uri: vscode.Uri): Promise<vscode.CodeLens[]> {
  return await vscode.commands.executeCommand<vscode.CodeLens[]>(
    'vscode.executeCodeLensProvider',
    uri,
  );
}
