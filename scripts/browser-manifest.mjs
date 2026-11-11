export const targets = {
  chrome: { name: 'Chrome', folder: 'dist', shortcuts: 'chrome://extensions/shortcuts', capture: true },
  edge: { name: 'Edge', folder: 'dist-edge', shortcuts: 'edge://extensions/shortcuts', capture: true },
  brave: { name: 'Brave', folder: 'dist-brave', shortcuts: 'brave://extensions/shortcuts', capture: true },
  firefox: { name: 'Firefox', folder: 'dist-firefox', shortcuts: 'about:addons', capture: false }
};

export function browserManifest(base, target) {
  if (!targets[target]) throw new Error(`Unknown browser target: ${target}`);
  const manifest = structuredClone(base);
  manifest.homepage_url = 'https://github.com/saeidshirazi/VolumeBooster';
  if (target === 'firefox') {
    delete manifest.minimum_chrome_version;
    manifest.permissions = manifest.permissions.filter(permission => !['tabCapture', 'offscreen'].includes(permission));
    manifest.background = { scripts: ['background.js'], type: 'module' };
    manifest.browser_specific_settings = {
      gecko: {
        id: 'volumebooster@saeidshirazi.github.io',
        strict_min_version: '142.0',
        data_collection_permissions: { required: ['none'] }
      }
    };
  }
  return manifest;
}
