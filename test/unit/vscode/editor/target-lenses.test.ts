import { describe, expect, it } from 'vitest';
import type { ConnectionConfig } from '../../../../src/shared/connection';
import { targetLenses, type TargetLensTexts } from '../../../../src/vscode/editor/target-lenses';

const TEXTS: TargetLensTexts = {
  pickConnection: 'Select connection',
  pickDatabase: 'Select database',
  connectionTooltip: 'Another connection',
  databaseTooltip: 'Another database',
  pickTooltip: 'Choose both',
  production: 'PROD',
  readOnly: 'RO',
};

const config: ConnectionConfig = {
  id: 'c1',
  name: 'Local',
  driver: 'mysql',
  host: '127.0.0.1',
  port: 3306,
  user: 'root',
};

describe('targetLenses', () => {
  it('invites the user to pick a connection when the document has none', () => {
    expect(targetLenses(undefined, undefined, true, TEXTS)).toEqual({
      connection: { title: 'Select connection', tooltip: 'Choose both' },
    });
  });

  it('shows the connection the document runs on, with where it points', () => {
    const lenses = targetLenses({ connectionId: 'c1' }, config, true, TEXTS);
    expect(lenses.connection.title).toBe('$(plug) Local');
    expect(lenses.connection.tooltip).toBe('Local — root@127.0.0.1:3306\nAnother connection');
  });

  it('shows the database the document is pinned to', () => {
    const lenses = targetLenses({ connectionId: 'c1', database: 'app' }, config, true, TEXTS);
    expect(lenses.database?.title).toBe('$(database) app');
    expect(lenses.database?.tooltip).toBe('app\nAnother database');
  });

  it('falls back to the database the connection opens itself', () => {
    const lenses = targetLenses(
      { connectionId: 'c1' },
      { ...config, database: 'shop' },
      true,
      TEXTS,
    );
    expect(lenses.database?.title).toBe('$(database) shop');
  });

  it('asks for a database when neither the document nor the connection names one', () => {
    const lenses = targetLenses({ connectionId: 'c1' }, config, true, TEXTS);
    expect(lenses.database).toEqual({ title: 'Select database', tooltip: 'Choose both' });
  });

  it('shows no database lens for a driver without databases', () => {
    const sqlite: ConnectionConfig = {
      id: 'f1',
      name: 'File',
      driver: 'sqlite',
      file: '/tmp/a.db',
    };
    expect(targetLenses({ connectionId: 'f1' }, sqlite, false, TEXTS).database).toBeUndefined();
  });

  it('marks a production and a read-only connection', () => {
    const lenses = targetLenses(
      { connectionId: 'c1' },
      { ...config, production: true, readOnly: true },
      true,
      TEXTS,
    );
    expect(lenses.connection.title).toBe('PROD RO $(plug) Local');
  });

  it('has no database lens either while there is no connection', () => {
    expect(targetLenses(undefined, undefined, false, TEXTS).database).toBeUndefined();
  });

  it('falls back to the invitation when the connection was deleted', () => {
    expect(targetLenses({ connectionId: 'gone' }, undefined, true, TEXTS)).toEqual({
      connection: { title: 'Select connection', tooltip: 'Choose both' },
    });
  });

  it('tells what a click does in every shown lens', () => {
    const lenses = targetLenses({ connectionId: 'c1', database: 'app' }, config, true, TEXTS);
    expect(lenses.connection.tooltip).toContain('Another connection');
    expect(lenses.database?.tooltip).toContain('Another database');
  });
});
