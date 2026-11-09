// What the lenses above a SQL document say about where it runs: the connection and the
// database the editor is bound to, each with a click to switch it. Free of `vscode`, so
// the wording and which lenses appear are covered by unit tests (like the status bar).

import { describeTarget, type ConnectionConfig } from '../../shared/connection';
import type { DocumentBinding } from './document-bindings';

export interface TargetLensTexts {
  /** The lens that asks for a connection: the document is not bound to one. */
  readonly pickConnection: string;
  /** The database of a connection that opens its own, which can then be switched. */
  readonly pickDatabase: string;
  /** Tooltip of a lens that shows a connection or a database. */
  readonly connectionTooltip: string;
  readonly databaseTooltip: string;
  /** Tooltip of the lens that asks for a connection. */
  readonly pickTooltip: string;
  /** Marks of a production and of a read-only connection, as in the status bar. */
  readonly production: string;
  readonly readOnly: string;
}

export interface TargetLens {
  readonly title: string;
  readonly tooltip: string;
}

export interface TargetLenses {
  readonly connection: TargetLens;
  /** Absent without a connection, and for drivers that have no databases to switch. */
  readonly database?: TargetLens;
}

/**
 * The two lenses above the first statement: where the document runs and how to switch it.
 * A connection that was deleted while its editor stayed open shows as "no connection",
 * exactly like the status bar.
 */
export function targetLenses(
  binding: DocumentBinding | undefined,
  config: ConnectionConfig | undefined,
  databases: boolean,
  texts: TargetLensTexts,
): TargetLenses {
  const connection = connectionLens(binding, config, texts);
  if (binding === undefined || config === undefined || !databases) {
    return { connection };
  }
  const database = binding.database ?? config.database ?? '';
  return {
    connection,
    database:
      database === ''
        ? { title: texts.pickDatabase, tooltip: texts.pickTooltip }
        : {
            title: `$(database) ${database}`,
            tooltip: tooltipFor(database, texts.databaseTooltip),
          },
  };
}

function connectionLens(
  binding: DocumentBinding | undefined,
  config: ConnectionConfig | undefined,
  texts: TargetLensTexts,
): TargetLens {
  if (binding === undefined || config === undefined) {
    return { title: texts.pickConnection, tooltip: texts.pickTooltip };
  }
  // Production and read-only stand out the same way they do in the status bar.
  const marks = [
    ...(config.production === true ? [texts.production] : []),
    ...(config.readOnly === true ? [texts.readOnly] : []),
  ];
  const target = describeTarget(config);
  const what = target === '' ? config.name : `${config.name} — ${target}`;
  return {
    title: [...marks, `$(plug) ${config.name}`].join(' '),
    tooltip: tooltipFor(what, texts.connectionTooltip),
  };
}

function tooltipFor(what: string, hint: string): string {
  return `${what}\n${hint}`;
}
