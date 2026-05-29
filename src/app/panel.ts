import { createAddressPanel } from '../features/address-autofill/panel';
import { createLinkExtractorPanel } from '../features/link-extractor/panel';
import { createRegisterPanel } from '../features/register/panel';
import type { RegisterController } from '../features/register/types';
import { createSettingsDialog } from '../features/settings/panel';
import { createSmsPanel } from '../features/sms/panel';
import { createVersionNotice } from '../features/version-check/panel';
import { isFeatureTab, loadAppState, saveActiveTab, savePanelCollapsed } from './state';
import { PANEL_STYLES } from './styles';
import type { FeaturePanelHandle, FeatureTab } from './types';

export function createPanel(root: ShadowRoot, registerController: RegisterController): void {
  root.innerHTML = '';

  const style = document.createElement('style');
  style.textContent = PANEL_STYLES;

  const shell = document.createElement('div');
  shell.className = 'opx-shell';

  const collapseButton = document.createElement('button');
  collapseButton.className = 'opx-collapse-toggle';
  collapseButton.type = 'button';
  collapseButton.textContent = 'Collapse';
  collapseButton.title = 'Collapse sidebar';
  collapseButton.setAttribute('aria-expanded', 'true');

  const panel = document.createElement('aside');
  panel.className = 'opx-panel';

  const topbar = document.createElement('div');
  topbar.className = 'opx-topbar';

  const tabs = document.createElement('div');
  tabs.className = 'opx-tabs';

  const registerTab = createTab('register', 'Register');
  const linkTab = createTab('link', 'Links');
  const addressTab = createTab('address', 'Address');
  const smsTab = createTab('sms', 'SMS');
  tabs.append(registerTab, linkTab, addressTab, smsTab);

  const settingsButton = document.createElement('button');
  settingsButton.className = 'opx-icon-button';
  settingsButton.type = 'button';
  settingsButton.textContent = '⚙';
  settingsButton.title = 'Open settings';
  settingsButton.setAttribute('aria-label', 'Open settings');

  const state = document.createElement('div');
  state.className = 'opx-state';

  const registerView = createView();
  const linkView = createView();
  const addressView = createView();
  const smsView = createView();

  const handles: Record<FeatureTab, FeaturePanelHandle> = {
    register: createRegisterPanel(registerView, registerController),
    link: createLinkExtractorPanel(linkView),
    address: createAddressPanel(addressView),
    sms: createSmsPanel(smsView),
  };
  const versionNotice = createVersionNotice();
  const settingsDialog = createSettingsDialog({
    onVersionChecked: () => versionNotice.update(true),
  });

  let activeTab: FeatureTab = 'register';

  const setCollapsed = (collapsed: boolean) => {
    shell.classList.toggle('is-collapsed', collapsed);
    collapseButton.textContent = collapsed ? 'Expand' : 'Collapse';
    collapseButton.title = collapsed ? 'Expand sidebar' : 'Collapse sidebar';
    collapseButton.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
  };

  const setActiveTab = async (tab: string) => {
    if (!isFeatureTab(tab)) {
      return;
    }
    activeTab = tab;
    await saveActiveTab(tab);
    renderActiveTab();
    await handles[tab].onShow?.();
    await updateState();
  };

  const renderActiveTab = () => {
    for (const item of [registerTab, linkTab, addressTab, smsTab]) {
      item.classList.toggle('is-active', item.dataset.tab === activeTab);
    }
    registerView.hidden = activeTab !== 'register';
    linkView.hidden = activeTab !== 'link';
    addressView.hidden = activeTab !== 'address';
    smsView.hidden = activeTab !== 'sms';
  };

  const updateState = async () => {
    const saved = await loadAppState();
    activeTab = saved.activeTab;
    setCollapsed(saved.panelCollapsed);
    renderActiveTab();
    state.textContent = getStateLabel(activeTab, registerController);
    await handles[activeTab].update();
  };

  registerTab.addEventListener('click', () => void setActiveTab('register'));
  linkTab.addEventListener('click', () => void setActiveTab('link'));
  addressTab.addEventListener('click', () => void setActiveTab('address'));
  smsTab.addEventListener('click', () => void setActiveTab('sms'));
  settingsButton.addEventListener('click', () => settingsDialog.open());

  collapseButton.addEventListener('click', () => {
    const collapsed = !shell.classList.contains('is-collapsed');
    setCollapsed(collapsed);
    void savePanelCollapsed(collapsed);
  });

  topbar.append(tabs, settingsButton);
  panel.append(topbar, versionNotice.element, state, registerView, linkView, addressView, smsView, settingsDialog.element);
  shell.append(collapseButton, panel);
  root.append(style, shell);

  window.setInterval(() => void updateState(), 1000);
  window.setTimeout(() => void versionNotice.update(), 800);
  void updateState().then(() => {
    void handles[activeTab].onShow?.();
  });
}

function getStateLabel(activeTab: FeatureTab, registerController: RegisterController): string {
  if (activeTab === 'register') {
    return registerController.getPageState().label;
  }
  if (activeTab === 'link') {
    return 'Links: ChatGPT session';
  }
  if (activeTab === 'address') {
    return 'Address: random profile';
  }
  return 'SMS: verification codes';
}

function createView(): HTMLElement {
  const view = document.createElement('section');
  view.className = 'opx-view';
  return view;
}

function createTab(tab: FeatureTab, label: string): HTMLButtonElement {
  const button = document.createElement('button');
  button.className = 'opx-tab';
  button.type = 'button';
  button.dataset.tab = tab;
  button.textContent = label;
  return button;
}
