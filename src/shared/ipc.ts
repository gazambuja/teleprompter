export const IPC = {
  settingsGet: 'settings:get',
  settingsSet: 'settings:set',
  fileOpenText: 'file:open-text',
  fileSaveText: 'file:save-text',
  windowSetAlwaysOnTop: 'window:set-always-on-top',
  windowSetOpacity: 'window:set-opacity',
  windowSetBounds: 'window:set-bounds',
  windowSetIgnoreMouse: 'window:set-ignore-mouse',
  windowClose: 'window:close',
  appGetVersion: 'app:get-version',
  sttModelStatus: 'stt:model-status',
  sttModelPrepare: 'stt:model-prepare',
  sttModelCancel: 'stt:model-cancel'
} as const;
