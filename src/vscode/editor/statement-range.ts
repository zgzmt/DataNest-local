// The statement a CodeLens sits above, as plain numbers so it survives the command call:
// the editor may be edited between the click and the handler, so offsets are re-read
// there, never positions.

export interface StatementRange {
  readonly documentUri: string;
  readonly start: number;
  readonly end: number;
}

/** Reads the arguments a lens passes; anything malformed means "do nothing". */
export function statementRangeOf(args: unknown): StatementRange | undefined {
  if (typeof args !== 'object' || args === null) {
    return undefined;
  }
  const { documentUri, start, end } = args as Partial<StatementRange>;
  if (
    typeof documentUri !== 'string' ||
    typeof start !== 'number' ||
    typeof end !== 'number' ||
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    end < start ||
    start < 0
  ) {
    return undefined;
  }
  return { documentUri, start, end };
}
