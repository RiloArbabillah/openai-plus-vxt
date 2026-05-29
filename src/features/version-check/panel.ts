import { checkLatestVersion } from './github';
import { ignoreReleaseVersion } from './state';
import type { ReleaseVersionInfo, VersionCheckResult } from './types';

export interface VersionNoticeHandle {
  element: HTMLElement;
  update(force?: boolean): Promise<void>;
}

export function createVersionNotice(): VersionNoticeHandle {
  const notice = document.createElement('section');
  notice.className = 'opx-version-notice';
  notice.hidden = true;

  const title = document.createElement('div');
  title.className = 'opx-version-notice-title';

  const body = document.createElement('div');
  body.className = 'opx-version-notice-body';

  const actions = document.createElement('div');
  actions.className = 'opx-version-notice-actions';

  const downloadButton = document.createElement('button');
  downloadButton.className = 'opx-mini-button';
  downloadButton.type = 'button';
  downloadButton.textContent = 'Download update';

  const releaseButton = document.createElement('button');
  releaseButton.className = 'opx-mini-button opx-mini-button-secondary';
  releaseButton.type = 'button';
  releaseButton.textContent = 'Release notes';

  const ignoreButton = document.createElement('button');
  ignoreButton.className = 'opx-mini-button opx-mini-button-secondary';
  ignoreButton.type = 'button';
  ignoreButton.textContent = 'Ignore';

  actions.append(downloadButton, releaseButton, ignoreButton);
  notice.append(title, body, actions);

  let latest: ReleaseVersionInfo | null = null;

  downloadButton.addEventListener('click', () => {
    if (latest?.downloadUrl) {
      window.open(latest.downloadUrl, '_blank', 'noopener,noreferrer');
    }
  });

  releaseButton.addEventListener('click', () => {
    if (latest?.htmlUrl) {
      window.open(latest.htmlUrl, '_blank', 'noopener,noreferrer');
    }
  });

  ignoreButton.addEventListener('click', async () => {
    if (!latest) {
      return;
    }
    await ignoreReleaseVersion(latest.version);
    notice.hidden = true;
  });

  const update = async (force = false) => {
    const result = await checkLatestVersion(force);
    latest = result.latest;
    renderResult(result, notice, title, body);
  };

  return {
    element: notice,
    update,
  };
}

function renderResult(
  result: VersionCheckResult,
  notice: HTMLElement,
  title: HTMLElement,
  body: HTMLElement,
): void {
  if (!result.latest || !result.updateAvailable || result.ignored) {
    notice.hidden = true;
    return;
  }

  title.textContent = `New version found: v${result.latest.version}`;
  body.textContent = buildBody(result.currentVersion, result.latest);
  notice.hidden = false;
}

function buildBody(currentVersion: string, latest: ReleaseVersionInfo): string {
  const notes = latest.body
    .split(/\r?\n/)
    .map((line) => line.replace(/^#+\s*/, '').trim())
    .filter(Boolean)
    .slice(0, 2)
    .join(' / ');
  const prefix = `Current v${currentVersion}, latest ${latest.tagName || `v${latest.version}`}`;
  return notes ? `${prefix}. ${notes}` : prefix;
}
