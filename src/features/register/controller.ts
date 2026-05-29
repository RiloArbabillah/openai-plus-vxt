import { fillEmailAndContinue, isChatGptLoginPage } from './chatgpt-auth-page';
import { fillOtpAndContinue, isEmailVerificationPage } from './openai-email-verification-page';
import { fillAboutYouAndCreate, isAboutYouPage } from './openai-about-you-page';
import { parseAccountInput } from './account-input';
import { loadRegisterState, saveRegisterState } from '../../app/state';
import type { ActionResult, PageState, RegisterController } from './types';

let autoProfileStarted = false;

export function createRegisterController(): RegisterController {
  return {
    getPageState,
    loadState: loadRegisterState,
    saveInput: async (rawInput: string) => {
      const parsed = parseAccountInput(rawInput);
      return saveRegisterState({
        rawInput,
        email: parsed.email,
        accountLine: parsed.accountLine,
        inputMode: parsed.mode,
        autoOtp: parsed.mode === 'outlook-line',
      });
    },
    fillEmailFromInput: async () => {
      const state = await loadRegisterState();
      const parsed = parseAccountInput(state.rawInput);
      if (!parsed.ok) {
        return fail(parsed.message);
      }
      if (!isChatGptLoginPage()) {
        return fail('The current page is not the ChatGPT login page');
      }
      await saveRegisterState({
        email: parsed.email,
        accountLine: parsed.accountLine,
        inputMode: parsed.mode,
        autoOtp: parsed.mode === 'outlook-line',
        otpRequestedAt: Date.now(),
      });
      return fillEmailAndContinue(parsed.email);
    },
    fillOtp: async (code: string) => {
      if (!isEmailVerificationPage()) {
        return fail('The current page is not the email verification page');
      }
      return fillOtpAndContinue(code);
    },
    waitForOutlookOtp: async () => {
      if (!isEmailVerificationPage()) {
        return fail('The current page is not the email verification page');
      }
      const state = await loadRegisterState();
      if (!state.accountLine) {
        return fail('The current input is not an Outlook account line, so the code cannot be fetched automatically');
      }

      const response = await browser.runtime.sendMessage({
        type: 'opx:wait-outlook-otp',
        accountLine: state.accountLine,
        apiBase: state.apiBase,
        since: state.otpRequestedAt || state.updatedAt || Date.now(),
        timeoutMs: 180_000,
        intervalMs: 5_000,
      });

      if (!isActionResult(response)) {
        return fail('The Outlook API did not return a valid result');
      }

      if (!response.ok || !response.code) {
        return response;
      }

      const fillResult = await fillOtpAndContinue(response.code);
      return {
        ...fillResult,
        code: response.code,
        message: fillResult.ok ? `Received and submitted verification code: ${response.code}` : fillResult.message,
      };
    },
    fillProfileAndCreate: async () => {
      if (!isAboutYouPage()) {
        return fail('The current page is not the profile form page');
      }
      return fillAboutYouAndCreate();
    },
    autoRunForCurrentPage: async () => {
      if (!isAboutYouPage() || autoProfileStarted) {
        return;
      }
      autoProfileStarted = true;
      await waitForPageReady();
      await fillAboutYouAndCreate();
    },
  };
}

function getPageState(): PageState {
  if (isChatGptLoginPage()) {
    return {
      kind: 'login',
      label: 'ChatGPT login page',
      canFillEmail: true,
      canFillOtp: false,
      canFillProfile: false,
    };
  }

  if (isEmailVerificationPage()) {
    return {
      kind: 'email-verification',
      label: 'Email verification page',
      canFillEmail: false,
      canFillOtp: true,
      canFillProfile: false,
    };
  }

  if (isAboutYouPage()) {
    return {
      kind: 'about-you',
      label: 'Profile form page',
      canFillEmail: false,
      canFillOtp: false,
      canFillProfile: true,
    };
  }

  return {
    kind: 'unknown',
    label: 'Unrecognized page',
    canFillEmail: false,
    canFillOtp: false,
    canFillProfile: false,
  };
}

function fail(message: string): ActionResult {
  return { ok: false, message };
}

function isActionResult(value: unknown): value is ActionResult {
  return Boolean(
    value &&
      typeof value === 'object' &&
      typeof (value as ActionResult).ok === 'boolean' &&
      typeof (value as ActionResult).message === 'string',
  );
}

function waitForPageReady(): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, 800));
}
