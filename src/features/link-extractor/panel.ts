import { loadLinkExtractorState, saveLinkExtractorState } from '../../app/state';
import type { FeaturePanelHandle } from '../../app/types';
import { extractAccessToken, normalizeCheckoutOptions } from './checkout';
import type { ChatGptSessionResponse, CheckoutLinkResponse, CheckoutOptions } from './types';

const REGION_OPTIONS = [
  ['ID', 'Indonesia / IDR'],
  ['DE', 'Germany / EUR'],
  ['JP', 'Japan / JPY'],
  ['US', 'United States / USD'],
];

export function createLinkExtractorPanel(container: HTMLElement): FeaturePanelHandle {
  const linkSummary = document.createElement('div');
  linkSummary.className = 'opx-summary';

  const sessionCard = document.createElement('div');
  sessionCard.className = 'opx-session-card';
  const emailValue = createSessionRow('Email', 'Not loaded');
  const planValue = createSessionRow('Plan', 'Not loaded');
  const tokenValue = createSessionRow('Token', 'Not loaded');
  sessionCard.append(emailValue.row, planValue.row, tokenValue.row);

  const refreshSessionButton = createButton('Load ChatGPT session', 'opx-button opx-button-secondary');

  const planSelect = createSelect([
    ['chatgptplusplan', 'ChatGPT Plus'],
    ['chatgptteamplan', 'ChatGPT Team'],
  ]);
  const uiModeSelect = createSelect([
    ['custom', 'Short link / custom'],
    ['hosted', 'Long link / hosted'],
  ]);
  const regionSelect = createSelect(REGION_OPTIONS);
  const workspaceInput = createInput('Workspace name', 'text');
  const seatsInput = createInput('Seat count', 'number');
  const promoCampaignInput = createInput('Promo campaign ID', 'text');
  seatsInput.min = '2';
  seatsInput.step = '1';

  const mainGrid = document.createElement('div');
  mainGrid.className = 'opx-grid';
  const planField = createField('Plan type', planSelect);
  const uiModeField = createField('Link format', uiModeSelect);
  const regionField = createField('Billing region', regionSelect);
  mainGrid.append(planField, uiModeField, regionField);

  const promoField = createField('Promo campaign', promoCampaignInput);

  const teamOptions = document.createElement('div');
  teamOptions.className = 'opx-team-options';
  const teamGrid = document.createElement('div');
  teamGrid.className = 'opx-grid';
  teamGrid.append(
    createField('Workspace', workspaceInput),
    createField('Seats', seatsInput),
  );
  teamOptions.append(teamGrid);

  const tokenInput = document.createElement('textarea');
  tokenInput.className = 'opx-textarea opx-token-textarea';
  tokenInput.placeholder = 'Auto-load or paste ChatGPT session JSON / Access Token';
  tokenInput.autocomplete = 'off';
  tokenInput.spellcheck = false;

  const tokenHint = document.createElement('div');
  tokenHint.className = 'opx-hint';
  tokenHint.textContent = 'Switching to the Links tab will load /api/auth/session; the token is only used on the current page.';

  const generateLinkButton = createButton('Generate checkout link');
  const linkOutput = document.createElement('textarea');
  linkOutput.className = 'opx-textarea opx-output';
  linkOutput.placeholder = 'Generated checkout link';
  linkOutput.readOnly = true;
  linkOutput.spellcheck = false;

  const linkButtonRow = document.createElement('div');
  linkButtonRow.className = 'opx-button-row';
  const copyLinkButton = createButton('Copy link', 'opx-button opx-button-secondary');
  const openLinkButton = createButton('Open link', 'opx-button opx-button-secondary');
  const clearLinkButton = createButton('Clear', 'opx-button opx-button-secondary');
  linkButtonRow.append(copyLinkButton, openLinkButton, clearLinkButton);

  const linkStatus = document.createElement('div');
  linkStatus.className = 'opx-status';
  linkStatus.textContent = 'Waiting to load the ChatGPT session.';

  let generatedLink = '';
  let sessionAccessToken = '';
  let sessionFetchInFlight = false;
  let sessionFetchedOnce = false;

  const update = async () => {
    const saved = await loadLinkExtractorState();
    setCheckoutOptions(saved.checkoutOptions);
  };

  const onShow = async () => {
    await refreshSession();
  };

  const syncLinkOptions = async () => {
    try {
      const options = readCheckoutOptions();
      await saveLinkExtractorState({ checkoutOptions: options });
      setLinkSummary(options);
      setStatus(linkStatus, 'Local parameters updated', 'ok');
    } catch (error) {
      setStatus(linkStatus, errorMessage(error), 'error');
    }
  };

  for (const item of [planSelect, uiModeSelect, regionSelect, workspaceInput, seatsInput, promoCampaignInput]) {
    item.addEventListener('change', () => void syncLinkOptions());
    item.addEventListener('input', () => void syncLinkOptions());
  }

  refreshSessionButton.addEventListener('click', () => void refreshSession());

  tokenInput.addEventListener('paste', () => window.setTimeout(() => normalizeTokenInput(false), 0));
  tokenInput.addEventListener('input', () => {
    sessionAccessToken = '';
    if (tokenInput.value.includes('accessToken') || tokenInput.value.length > 900) {
      normalizeTokenInput(false);
    }
  });

  generateLinkButton.addEventListener('click', async () => {
    setStatus(linkStatus, 'Generating checkout link...', 'pending');
    const token = tokenInput.value.trim() ? normalizeTokenInput(true) : sessionAccessToken;
    if (!token) {
      setStatus(linkStatus, 'No accessToken found. Load the session first or paste it manually.', 'error');
      return;
    }

    let options: CheckoutOptions;
    try {
      options = readCheckoutOptions();
      await saveLinkExtractorState({ checkoutOptions: options });
    } catch (error) {
      setStatus(linkStatus, errorMessage(error), 'error');
      return;
    }

    let response: CheckoutLinkResponse;
    try {
      response = await browser.runtime.sendMessage({
        type: 'opx:create-checkout-link',
        raw: token,
        options,
      });
    } catch (error) {
      setStatus(linkStatus, `Generation failed: ${String(error)}`, 'error');
      return;
    }

    const link = response?.link || response?.url || '';
    if (!isCheckoutLinkResponse(response) || !response.ok || !link) {
      setStatus(linkStatus, response?.message || 'Generation failed: invalid response', 'error');
      setGeneratedLink('');
      return;
    }

    setGeneratedLink(link);
    setStatus(linkStatus, response.message, 'ok');
  });

  copyLinkButton.addEventListener('click', async () => {
    if (!generatedLink) {
      return;
    }
    await navigator.clipboard.writeText(generatedLink);
    setStatus(linkStatus, 'Link copied', 'ok');
  });

  openLinkButton.addEventListener('click', () => {
    if (generatedLink) {
      window.open(generatedLink, '_blank', 'noopener,noreferrer');
    }
  });

  clearLinkButton.addEventListener('click', () => {
    tokenInput.value = '';
    sessionAccessToken = '';
    tokenHint.textContent = 'Switching to the Links tab will load /api/auth/session; the token is only used on the current page.';
    tokenHint.classList.remove('is-ok');
    setGeneratedLink('');
    setSessionRows('', '', '');
    setStatus(linkStatus, 'Cleared', 'ok');
    tokenInput.focus();
  });

  container.append(
    linkSummary,
    sessionCard,
    refreshSessionButton,
    mainGrid,
    promoField,
    teamOptions,
    tokenInput,
    tokenHint,
    generateLinkButton,
    createField('Checkout link', linkOutput),
    linkButtonRow,
    linkStatus,
  );
  void update();
  setGeneratedLink('');
  return { update, onShow };

  async function refreshSession(): Promise<void> {
    if (sessionFetchInFlight) {
      return;
    }
    sessionFetchInFlight = true;
    refreshSessionButton.disabled = true;
    setStatus(linkStatus, 'Loading https://chatgpt.com/api/auth/session ...', 'pending');
    try {
      const response: ChatGptSessionResponse = await browser.runtime.sendMessage({
        type: 'opx:fetch-chatgpt-session',
      });
      sessionFetchedOnce = true;
      if (!isChatGptSessionResponse(response)) {
        setStatus(linkStatus, 'Invalid session response', 'error');
        return;
      }

      const session = response.session;
      setSessionRows(session?.email || '', session?.planType || '', session?.accessToken || '');
      if (session?.accessToken) {
        sessionAccessToken = session.accessToken;
        tokenInput.value = session.accessToken;
        tokenHint.textContent = 'Loaded accessToken from the ChatGPT session.';
        tokenHint.classList.add('is-ok');
      }
      setStatus(linkStatus, response.message, response.ok ? 'ok' : 'error');
    } catch (error) {
      setStatus(linkStatus, `Failed to load session: ${String(error)}`, 'error');
    } finally {
      refreshSessionButton.disabled = false;
      sessionFetchInFlight = false;
    }
  }

  function setCheckoutOptions(optionsInput: unknown): void {
    const options = normalizeCheckoutOptions(optionsInput);
    planSelect.value = options.planName;
    uiModeSelect.value = options.uiMode;
    regionSelect.value = options.region;
    workspaceInput.value = options.workspaceName;
    seatsInput.value = String(options.seatQuantity);
    promoCampaignInput.value = options.promoCampaignId;
    setLinkSummary(options);
  }

  function readCheckoutOptions(): CheckoutOptions {
    return normalizeCheckoutOptions({
      planName: planSelect.value,
      uiMode: uiModeSelect.value,
      region: regionSelect.value,
      workspaceName: workspaceInput.value,
      seatQuantity: Number(seatsInput.value || 5),
      promoCampaignId: promoCampaignInput.value,
    });
  }

  function setLinkSummary(options: CheckoutOptions): void {
    const planText = options.planName === 'chatgptteamplan' ? `Team · ${options.seatQuantity} seats` : 'Plus';
    const modeText = options.uiMode === 'hosted' ? 'Long link hosted' : 'Short link custom';
    const sessionText = sessionFetchedOnce ? 'session loaded' : 'session pending';
    const promoText = options.promoCampaignId ? `promo ${options.promoCampaignId}` : 'promo default';
    linkSummary.textContent = `${planText} · ${modeText} · ${options.region} · ${promoText} · ${sessionText}`;
    teamOptions.hidden = options.planName !== 'chatgptteamplan';
    regionField.hidden = options.planName === 'chatgptteamplan';
  }

  function normalizeTokenInput(showError: boolean): string {
    try {
      const token = extractAccessToken(tokenInput.value);
      if (tokenInput.value.trim() !== token) {
        tokenInput.value = token;
      }
      tokenHint.textContent = 'Extracted accessToken locally.';
      tokenHint.classList.add('is-ok');
      return token;
    } catch (error) {
      tokenHint.classList.remove('is-ok');
      if (showError) {
        setStatus(linkStatus, errorMessage(error), 'error');
      }
      return '';
    }
  }

  function setGeneratedLink(link: string): void {
    generatedLink = link;
    linkOutput.value = link;
    copyLinkButton.disabled = !link;
    openLinkButton.disabled = !link;
  }

  function setSessionRows(email: string, planType: string, accessToken: string): void {
    emailValue.value.textContent = email || 'Not loaded';
    planValue.value.textContent = planType || 'Not loaded';
    tokenValue.value.textContent = accessToken ? 'Loaded' : 'Missing';
  }
}

function createSessionRow(label: string, initialValue: string): { row: HTMLElement; value: HTMLElement } {
  const row = document.createElement('div');
  row.className = 'opx-session-row';
  const labelElement = document.createElement('span');
  labelElement.textContent = label;
  const value = document.createElement('strong');
  value.textContent = initialValue;
  row.append(labelElement, value);
  return { row, value };
}

function createButton(label: string, className = 'opx-button'): HTMLButtonElement {
  const button = document.createElement('button');
  button.className = className;
  button.type = 'button';
  button.textContent = label;
  return button;
}

function createInput(placeholder: string, type: string): HTMLInputElement {
  const input = document.createElement('input');
  input.className = 'opx-input';
  input.type = type;
  input.placeholder = placeholder;
  return input;
}

function createSelect(options: string[][]): HTMLSelectElement {
  const select = document.createElement('select');
  select.className = 'opx-select';
  for (const [value, label] of options) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    select.append(option);
  }
  return select;
}

function createField(label: string, control: HTMLElement): HTMLElement {
  const field = document.createElement('label');
  field.className = 'opx-field';
  const caption = document.createElement('span');
  caption.className = 'opx-label';
  caption.textContent = label;
  field.append(caption, control);
  return field;
}

function setStatus(element: HTMLElement, message: string, type: 'pending' | 'ok' | 'error'): void {
  element.textContent = message;
  element.dataset.type = type;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isCheckoutLinkResponse(value: unknown): value is CheckoutLinkResponse {
  return Boolean(
    value &&
      typeof value === 'object' &&
      typeof (value as CheckoutLinkResponse).ok === 'boolean' &&
      typeof (value as CheckoutLinkResponse).message === 'string',
  );
}

function isChatGptSessionResponse(value: unknown): value is ChatGptSessionResponse {
  return Boolean(
    value &&
      typeof value === 'object' &&
      typeof (value as ChatGptSessionResponse).ok === 'boolean' &&
      typeof (value as ChatGptSessionResponse).message === 'string',
  );
}
