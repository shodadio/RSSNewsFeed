/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type HapticType =
  | 'light'
  | 'medium'
  | 'heavy'
  | 'selection'
  | 'success'
  | 'warning'
  | 'error'
  | 'soft'
  | 'rigid';

export const isIOSDevice = (): boolean => false;
export const hasVibrateSupport = (): boolean => false;
export const isHapticsEnabled = (): boolean => false;
export const setHapticsEnabled = (_enabled: boolean): void => {};
export const isAudioTactileEnabled = (): boolean => false;
export const setAudioTactileEnabled = (_enabled: boolean): void => {};

export const triggerHaptic = (_type: HapticType = 'light'): void => {
  // Haptics removed completely per user request.
};

export const getHapticsInfo = () => {
  return {
    enabled: false,
    hasVibrate: false,
    isIOS: false,
    audioTactile: false,
    hardwareType: 'Disabled',
    isSupported: false
  };
};
