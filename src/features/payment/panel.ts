import type { FeaturePanelHandle } from '../../app/types';

export function createPaymentPanel(container: HTMLElement): FeaturePanelHandle {
  container.classList.add('opx-empty-view');
  container.textContent = 'Payment module coming soon';
  return {
    update() {},
  };
}
