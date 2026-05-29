import type { ParsedAccountInput } from './types';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function parseAccountInput(rawInput: string): ParsedAccountInput {
  const raw = rawInput.trim();
  if (!raw) {
    return invalid('empty', 'Enter an email or an Outlook account line');
  }

  const firstLine = raw.split(/\r?\n/).map((line) => line.trim()).find(Boolean) || '';
  if (firstLine.includes('----')) {
    const parts = firstLine.split('----').map((item) => item.trim());
    const email = parts[0] || '';
    if (!EMAIL_RE.test(email)) {
      return invalid('invalid', 'The email format in the Outlook line is invalid');
    }
    if (parts.length < 4 || !parts[2] || !parts[3]) {
      return invalid('invalid', 'An Outlook line must use email----password----client_id----refresh_token');
    }
    return {
      ok: true,
      mode: 'outlook-line',
      email,
      accountLine: firstLine,
      message: 'Outlook API automatic code mode',
    };
  }

  if (!EMAIL_RE.test(firstLine)) {
    return invalid('invalid', 'Invalid email format');
  }

  return {
    ok: true,
    mode: 'email',
    email: firstLine,
    accountLine: '',
    message: 'Single-email mode, enter the code manually',
  };
}

function invalid(mode: ParsedAccountInput['mode'], message: string): ParsedAccountInput {
  return {
    ok: false,
    mode,
    email: '',
    accountLine: '',
    message,
  };
}
