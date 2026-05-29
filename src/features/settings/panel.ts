import { checkLatestVersion } from '../version-check/github';
import { loadAddressAutofillSettings, saveAddressAutofillSettings } from './state';

const TG_GROUP_URL = 'https://t.me/fuck_open';

export interface SettingsDialogOptions {
  onVersionChecked?: () => Promise<void> | void;
}

export interface SettingsDialogHandle {
  element: HTMLElement;
  open(): void;
  update(): Promise<void>;
}

export function createSettingsDialog(options: SettingsDialogOptions = {}): SettingsDialogHandle {
  const overlay = document.createElement('div');
  overlay.className = 'opx-settings-overlay';
  overlay.hidden = true;

  const dialog = document.createElement('section');
  dialog.className = 'opx-settings-dialog';
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-label', 'Extension settings');

  const header = document.createElement('div');
  header.className = 'opx-settings-header';
  const titleGroup = document.createElement('div');
  titleGroup.className = 'opx-settings-title';
  const title = document.createElement('strong');
  title.textContent = 'Settings';
  const version = document.createElement('span');
  version.className = 'opx-version-badge';
  version.textContent = `v${browser.runtime.getManifest().version}`;
  const closeButton = createIconButton('×', 'Close settings');
  titleGroup.append(title, version);
  header.append(titleGroup, closeButton);

  const payOpenAiCheckbox = document.createElement('input');
  payOpenAiCheckbox.type = 'checkbox';
  payOpenAiCheckbox.className = 'opx-checkbox';

  const payPalSignupCheckbox = document.createElement('input');
  payPalSignupCheckbox.type = 'checkbox';
  payPalSignupCheckbox.className = 'opx-checkbox';

  const payOpenAiItem = createSettingItem(
    payOpenAiCheckbox,
    'OpenAI payment page autofill',
    'Used on pay.openai.com/c/pay to fill name, country, address, postal code, phone number, and accept the terms.',
  );
  const payPalSignupItem = createSettingItem(
    payPalSignupCheckbox,
    'PayPal signup page autofill',
    'Used on paypal.com/checkoutweb/signup to fill country, email, card details, name, address, and password hint.',
  );

  const checkUpdateButton = document.createElement('button');
  checkUpdateButton.className = 'opx-external-link-button';
  checkUpdateButton.type = 'button';
  checkUpdateButton.title = 'Check the latest GitHub Release now';
  checkUpdateButton.textContent = 'Check for updates';

  const tgGroupButton = document.createElement('button');
  tgGroupButton.className = 'opx-external-link-button';
  tgGroupButton.type = 'button';
  tgGroupButton.title = 'Open Telegram group';
  tgGroupButton.append(createTelegramIcon(), document.createTextNode('Telegram group: t.me/fuck_open'));

  const hint = document.createElement('div');
  hint.className = 'opx-hint';
  hint.textContent = 'Country, city, and address fetching are managed in the Address tab.';

  const status = document.createElement('div');
  status.className = 'opx-status';

  dialog.append(header, payOpenAiItem, payPalSignupItem, checkUpdateButton, tgGroupButton, hint, status);
  overlay.append(dialog);

  closeButton.addEventListener('click', close);
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) {
      close();
    }
  });

  payOpenAiCheckbox.addEventListener('change', async () => {
    await saveAddressAutofillSettings({ payOpenAiEnabled: payOpenAiCheckbox.checked });
    setStatus(status, 'Settings saved', 'ok');
  });
  payPalSignupCheckbox.addEventListener('change', async () => {
    await saveAddressAutofillSettings({ payPalSignupEnabled: payPalSignupCheckbox.checked });
    setStatus(status, 'Settings saved', 'ok');
  });
  tgGroupButton.addEventListener('click', () => {
    window.open(TG_GROUP_URL, '_blank', 'noopener,noreferrer');
  });
  checkUpdateButton.addEventListener('click', async () => {
    checkUpdateButton.disabled = true;
    setStatus(status, 'Checking the latest GitHub version...', 'pending');
    try {
      const result = await checkLatestVersion(true);
      await options.onVersionChecked?.();
      if (result.latest && result.updateAvailable) {
        setStatus(status, `A new version v${result.latest.version} is available. An update notice is now shown at the top.`, 'ok');
      } else if (result.latest) {
        setStatus(status, `You are already on the latest version v${result.currentVersion}`, 'ok');
      } else {
        setStatus(status, result.error || 'No available release was found yet', 'pending');
      }
    } catch (error) {
      setStatus(status, error instanceof Error ? error.message : String(error), 'error');
    } finally {
      checkUpdateButton.disabled = false;
    }
  });

  const update = async () => {
    const settings = await loadAddressAutofillSettings();
    payOpenAiCheckbox.checked = settings.payOpenAiEnabled;
    payPalSignupCheckbox.checked = settings.payPalSignupEnabled;
    const enabledCount = Number(settings.payOpenAiEnabled) + Number(settings.payPalSignupEnabled);
    setStatus(status, enabledCount > 0 ? `${enabledCount} autofill option(s) enabled` : 'Autofill is disabled', enabledCount > 0 ? 'ok' : 'pending');
  };

  return {
    element: overlay,
    open: () => {
      overlay.hidden = false;
      void update();
    },
    update,
  };

  function close(): void {
    overlay.hidden = true;
  }
}

function createSettingItem(checkbox: HTMLInputElement, title: string, description: string): HTMLElement {
  const item = document.createElement('div');
  item.className = 'opx-setting-item';

  const label = document.createElement('label');
  label.className = 'opx-check-row';
  const titleElement = document.createElement('span');
  titleElement.textContent = title;
  label.append(checkbox, titleElement);

  const descriptionElement = document.createElement('div');
  descriptionElement.className = 'opx-setting-description';
  descriptionElement.textContent = description;

  item.append(label, descriptionElement);
  return item;
}

function createTelegramIcon(): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.classList.add('opx-telegram-icon');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');

  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('fill', 'currentColor');
  path.setAttribute('d', 'M21.9 4.3 18.7 19c-.2 1-.8 1.2-1.6.8l-4.6-3.4-2.2 2.1c-.2.2-.4.4-.9.4l.3-4.7 8.5-7.7c.4-.3-.1-.5-.6-.2L7.1 12.9 2.6 11.5c-1-.3-1-1 0-1.4L20.2 3.3c.8-.3 1.5.2 1.7 1Z');
  svg.append(path);
  return svg;
}

function createIconButton(label: string, title: string): HTMLButtonElement {
  const button = document.createElement('button');
  button.className = 'opx-icon-button';
  button.type = 'button';
  button.textContent = label;
  button.title = title;
  button.setAttribute('aria-label', title);
  return button;
}

function setStatus(element: HTMLElement, message: string, type: 'pending' | 'ok' | 'error'): void {
  element.textContent = message;
  element.dataset.type = type;
}
