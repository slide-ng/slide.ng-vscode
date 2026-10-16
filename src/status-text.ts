// The text of the status bar item.
export type ServerState = 'stopped' | 'starting' | 'running' | 'busy';

export interface StatusInput {
  state: ServerState;
  port: number;
  /** Current slide and total, when known. */
  current?: number;
  total?: number;
  /** Running, but not started by this window. */
  external?: boolean;
}

export function statusText({ state, port, current, total }: StatusInput): string {
  const slide = current && total ? ` ${current}/${total}` : '';
  switch (state) {
    case 'running':
      return `$(broadcast) slide.ng :${port}${slide}`;
    case 'starting':
      return `$(sync~spin) slide.ng starting${slide}`;
    case 'busy':
      return `$(warning) slide.ng port ${port} in use`;
    default:
      return `$(circle-outline) slide.ng${slide}`;
  }
}

export function statusTooltip({ state, port, external }: StatusInput): string {
  switch (state) {
    case 'running':
      return `Dev server on port ${port}${external ? ' (started outside this window)' : ''}. Click to open the preview.`;
    case 'starting':
      return `Starting the dev server on port ${port}...`;
    case 'busy':
      return `Something else is listening on port ${port}. Change slide-ng.dev.port.`;
    default:
      return 'Dev server stopped. Click to start it.';
  }
}
