import type { FeaturePanelHandle } from '../../app/types';
import type { RegisterController } from './types';

export function createRegisterPanel(container: HTMLElement, controller: RegisterController): FeaturePanelHandle {
  const accountInput = document.createElement('textarea');
  accountInput.className = 'opx-textarea';
  accountInput.placeholder = 'Email or Outlook line';
  accountInput.autocomplete = 'off';
  accountInput.spellcheck = false;

  const inputHint = document.createElement('div');
  inputHint.className = 'opx-hint';
  inputHint.textContent = 'Supports user@example.com or email----password----client_id----refresh_token';

  const emailButton = createButton('Fill email and continue');
  const otp = document.createElement('input');
  otp.className = 'opx-input';
  otp.type = 'text';
  otp.inputMode = 'numeric';
  otp.placeholder = 'Verification code';
  otp.autocomplete = 'one-time-code';

  const otpButton = createButton('Fill code and continue');
  const autoOtpButton = createButton('Auto-fetch and fill code', 'opx-button opx-button-secondary');
  const profileButton = createButton('Fill profile and create');

  const status = document.createElement('div');
  status.className = 'opx-status';
  status.textContent = 'Waiting for action';

  const update = async () => {
    const page = controller.getPageState();
    const saved = await controller.loadState();
    if (accountInput.value !== saved.rawInput) {
      accountInput.value = saved.rawInput;
    }
    emailButton.disabled = !page.canFillEmail;
    otpButton.disabled = !page.canFillOtp;
    autoOtpButton.disabled = !page.canFillOtp || !saved.autoOtp;
    profileButton.disabled = !page.canFillProfile;
    inputHint.textContent = saved.autoOtp
      ? 'Outlook line mode: the verification page will auto-fetch codes through the local API'
      : 'Single-email mode: enter the verification code manually';
  };

  accountInput.addEventListener('input', async () => {
    const saved = await controller.saveInput(accountInput.value);
    inputHint.textContent = saved.autoOtp
      ? 'Outlook line mode: the verification page will auto-fetch codes through the local API'
      : 'Single-email mode: enter the verification code manually';
  });

  emailButton.addEventListener('click', async () => {
    setStatus(status, 'Submitting email...', 'pending');
    await controller.saveInput(accountInput.value);
    setResult(status, await controller.fillEmailFromInput());
    await update();
  });

  otpButton.addEventListener('click', async () => {
    setStatus(status, 'Submitting verification code...', 'pending');
    setResult(status, await controller.fillOtp(otp.value));
    await update();
  });

  autoOtpButton.addEventListener('click', async () => {
    setStatus(status, 'Waiting for Outlook verification code...', 'pending');
    setResult(status, await controller.waitForOutlookOtp());
    await update();
  });

  profileButton.addEventListener('click', async () => {
    setStatus(status, 'Filling profile...', 'pending');
    setResult(status, await controller.fillProfileAndCreate());
    await update();
  });

  container.append(accountInput, inputHint, emailButton, otp, otpButton, autoOtpButton, profileButton, status);
  void update();
  return { update };
}

function createButton(label: string, className = 'opx-button'): HTMLButtonElement {
  const button = document.createElement('button');
  button.className = className;
  button.type = 'button';
  button.textContent = label;
  return button;
}

function setResult(element: HTMLElement, result: { ok: boolean; message: string }): void {
  setStatus(element, result.message, result.ok ? 'ok' : 'error');
}

function setStatus(element: HTMLElement, message: string, type: 'pending' | 'ok' | 'error'): void {
  element.textContent = message;
  element.dataset.type = type;
}
