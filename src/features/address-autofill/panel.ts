import type { FeaturePanelHandle } from '../../app/types';
import { loadAddressAutofillSettings, saveAddressAutofillSettings } from '../settings/state';
import type { AddressAutofillSettings } from '../settings/types';
import { ADDRESS_COUNTRY_OPTIONS } from './address-source';
import { fillPayOpenAiAddressNow } from './pay-openai-autofill';
import { fillPaypalAddressNow } from './paypal-autofill';
import type { AddressProfile, RandomAddressResponse } from './types';

interface AddressSection {
  title: string;
  collapsed?: boolean;
  items: Array<{ label: string; value: string }>;
}

export function createAddressPanel(container: HTMLElement): FeaturePanelHandle {
  const summary = document.createElement('div');
  summary.className = 'opx-summary';

  const countrySelect = createCountrySelect();
  const cityInput = document.createElement('input');
  cityInput.className = 'opx-input';
  cityInput.type = 'text';
  cityInput.placeholder = 'Leave city empty for random selection, for example Tokyo / Berlin / New York';
  cityInput.autocomplete = 'off';

  const formGrid = document.createElement('div');
  formGrid.className = 'opx-grid';
  formGrid.append(
    createField('Country', countrySelect),
    createField('City', cityInput),
  );

  const buttonRow = document.createElement('div');
  buttonRow.className = 'opx-button-row opx-address-actions';
  const fetchButton = createButton('Get address');
  buttonRow.append(fetchButton);

  const currentList = document.createElement('div');
  currentList.className = 'opx-copy-list';

  const status = document.createElement('div');
  status.className = 'opx-status';

  container.append(
    summary,
    formGrid,
    buttonRow,
    currentList,
    status,
  );

  countrySelect.addEventListener('change', () => void saveScopeSettings('Country saved'));
  cityInput.addEventListener('change', () => void saveScopeSettings('City saved'));
  fetchButton.addEventListener('click', () => void fetchAddress());

  const update = async () => {
    const settings = await loadAddressAutofillSettings();
    renderSettings(settings);
  };

  void update();
  return { update };

  async function saveScopeSettings(message: string): Promise<void> {
    const current = await loadAddressAutofillSettings();
    const countryCode = countrySelect.value;
    const city = cityInput.value.trim();
    const scopeChanged = current.countryCode !== countryCode || current.city.trim() !== city;
    const settings = await saveAddressAutofillSettings({
      countryCode,
      city,
      lastAddress: scopeChanged ? null : current.lastAddress,
    });
    renderSettings(settings);
    setStatus(status, message, 'ok');
  }

  async function fetchAddress(): Promise<void> {
    fetchButton.disabled = true;
    setStatus(status, 'Loading random address...', 'pending');
    try {
      const response = await browser.runtime.sendMessage({
        type: 'opx:fetch-random-address',
        countryCode: countrySelect.value,
        city: cityInput.value.trim(),
      });
      if (!isRandomAddressResponse(response) || !response.ok || !response.address) {
        setStatus(status, response?.message || 'Failed to load address', 'error');
        return;
      }
      const next = await saveAddressAutofillSettings({
        countryCode: countrySelect.value,
        city: cityInput.value.trim(),
        lastAddress: response.address,
      });
      renderSettings(next);
      const autofillMessage = await fillCurrentPaymentPage(response.address);
      setStatus(status, autofillMessage ? `${response.message}；${autofillMessage}` : response.message, 'ok');
    } catch (error) {
      setStatus(status, `Failed to load address: ${errorMessage(error)}`, 'error');
    } finally {
      fetchButton.disabled = false;
    }
  }

  async function fillCurrentPaymentPage(address: AddressProfile): Promise<string> {
    if (location.hostname === 'pay.openai.com') {
      return (await fillPayOpenAiAddressNow(address)).message;
    }
    if (location.hostname.endsWith('paypal.com')) {
      return (await fillPaypalAddressNow(address, true, false)).message;
    }
    return '';
  }

  function renderSettings(settings: AddressAutofillSettings): void {
    countrySelect.value = settings.countryCode;
    cityInput.value = settings.city;
    renderSummary(settings);
    renderAddress(settings.lastAddress);
  }

  function renderSummary(settings: AddressAutofillSettings): void {
    const countryLabel = countrySelect.selectedOptions[0]?.textContent || settings.countryCode;
    const cityLabel = settings.city || 'Random city';
    summary.textContent = `${countryLabel} · ${cityLabel}`;
  }

  function renderAddress(address: AddressProfile | null): void {
    currentList.textContent = '';
    if (!address) {
      currentList.append(createEmpty('No address yet. Click "Get address".'));
      return;
    }

    for (const section of addressSections(address)) {
      currentList.append(createSection(section));
    }
  }

  function createCopyRow(label: string, value: string): HTMLButtonElement {
    const row = document.createElement('button');
    row.className = 'opx-copy-row';
    row.type = 'button';
    row.title = 'Click to copy';
    const labelElement = document.createElement('span');
    labelElement.className = 'opx-copy-label';
    labelElement.textContent = `${label}：`;
    const valueElement = document.createElement('strong');
    valueElement.textContent = value;
    const feedbackElement = document.createElement('span');
    feedbackElement.className = 'opx-copy-feedback';
    feedbackElement.textContent = 'Copied';
    feedbackElement.hidden = true;
    let feedbackTimer: number | null = null;
    row.append(labelElement, valueElement, feedbackElement);
    row.addEventListener('click', async () => {
      await navigator.clipboard.writeText(value);
      if (feedbackTimer) {
        window.clearTimeout(feedbackTimer);
      }
      row.classList.add('is-copied');
      feedbackElement.hidden = false;
      feedbackTimer = window.setTimeout(() => {
        row.classList.remove('is-copied');
        feedbackElement.hidden = true;
        feedbackTimer = null;
      }, 1400);
    });
    return row;
  }

  function createSection(section: AddressSection): HTMLElement {
    const body = document.createElement('div');
    body.className = 'opx-copy-section-body';
    for (const item of section.items) {
      if (!item.value) {
        continue;
      }
      body.append(createCopyRow(item.label, item.value));
    }

    if (section.collapsed) {
      const details = document.createElement('details');
      details.className = 'opx-accordion-section';
      const summaryElement = document.createElement('summary');
      summaryElement.textContent = section.title;
      details.append(summaryElement, body);
      return details;
    }

    const wrapper = document.createElement('section');
    wrapper.className = 'opx-copy-section';
    const title = document.createElement('div');
    title.className = 'opx-copy-section-title';
    title.textContent = section.title;
    wrapper.append(title, body);
    return wrapper;
  }
}

function addressSections(address: AddressProfile): AddressSection[] {
  return [
    {
      title: 'Address details',
      items: [
        { label: 'Country', value: `${address.countryLabel || address.countryCode} / ${address.countryCode}` },
        { label: 'Name', value: address.fullName },
        { label: 'Phone', value: address.phone },
        { label: 'Address 1', value: address.line1 },
        { label: 'Address 2', value: address.line2 },
        { label: 'City', value: address.city },
        { label: 'State/Province', value: address.stateFull ? `${address.stateFull} / ${address.state}` : address.state },
        { label: 'Postal code', value: address.postalCode },
      ],
    },
    {
      title: 'Credit card details',
      items: [
        { label: 'Card type', value: address.creditCard.type },
        { label: 'Card number', value: address.creditCard.number },
        { label: 'CVV', value: address.creditCard.cvv },
        { label: 'Expiry', value: address.creditCard.expires },
        { label: 'Last four', value: address.creditCard.last4 },
      ],
    },
    {
      title: 'Identity details',
      collapsed: true,
      items: [
        { label: 'Gender', value: address.identity.gender },
        { label: 'Title', value: address.identity.title },
        { label: 'Birthday', value: address.identity.birthday },
        { label: 'Username', value: address.identity.username },
        { label: 'Password', value: address.identity.password },
        { label: 'Temporary email', value: address.identity.temporaryMail },
        { label: 'System', value: address.identity.system },
        { label: 'Website', value: address.identity.website },
        { label: 'Security question', value: address.identity.securityQuestion },
        { label: 'Security answer', value: address.identity.securityAnswer },
      ],
    },
    {
      title: 'Employment details',
      collapsed: true,
      items: [
        { label: 'Company', value: address.employment.companyName },
        { label: 'Occupation', value: address.employment.occupation },
        { label: 'Employment status', value: address.employment.employmentStatus },
        { label: 'Monthly salary', value: address.employment.monthlySalary },
        { label: 'Company size', value: address.employment.companySize },
        { label: 'Education', value: address.employment.educationalBackground },
      ],
    },
  ];
}

function createCountrySelect(): HTMLSelectElement {
  const select = document.createElement('select');
  select.className = 'opx-select';
  const randomCountryOption = document.createElement('option');
  randomCountryOption.value = 'RANDOM';
  randomCountryOption.textContent = 'Random country';
  select.append(randomCountryOption);
  for (const country of ADDRESS_COUNTRY_OPTIONS) {
    const option = document.createElement('option');
    option.value = country.code;
    option.textContent = `${country.label} / ${country.code}`;
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

function createButton(label: string, className = 'opx-button'): HTMLButtonElement {
  const button = document.createElement('button');
  button.className = className;
  button.type = 'button';
  button.textContent = label;
  return button;
}

function createEmpty(text: string): HTMLElement {
  const item = document.createElement('div');
  item.className = 'opx-empty-inline';
  item.textContent = text;
  return item;
}

function setStatus(element: HTMLElement, message: string, type: 'pending' | 'ok' | 'error'): void {
  element.textContent = message;
  element.dataset.type = type;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isRandomAddressResponse(value: unknown): value is RandomAddressResponse {
  return Boolean(
    value &&
      typeof value === 'object' &&
      typeof (value as RandomAddressResponse).ok === 'boolean' &&
      typeof (value as RandomAddressResponse).message === 'string',
  );
}
