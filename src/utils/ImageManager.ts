// src/utils/ImageManager.ts
type AssetKey = 'trianglebase' | 'limb1' | 'limb2' | 'gripper' | 'jcircle' | 'other';

const urls: Record<AssetKey, string> = {
  trianglebase: new URL('../assets/trianglebase.svg', import.meta.url).href,
  limb1:       new URL('../assets/limb1.svg', import.meta.url).href,
  limb2:       new URL('../assets/limb2.svg', import.meta.url).href,
  gripper:     new URL('../assets/gripper.svg', import.meta.url).href,
  jcircle:     new URL('../assets/jcircle.svg', import.meta.url).href,
  other:       new URL('../assets/trianglebase.svg', import.meta.url).href, // fallback
};

const images: Record<AssetKey, HTMLImageElement> = {
  trianglebase: new Image(),
  limb1:       new Image(),
  limb2:       new Image(),
  gripper:     new Image(),
  jcircle:     new Image(),
  other:       new Image(),
};

export function loadAllImages(): Promise<typeof images> {
  const keys = Object.keys(images) as AssetKey[];
  let loaded = 0;
  const total = keys.length;
  return new Promise((resolve) => {
    keys.forEach((k) => {
      const img = images[k];
      img.src = urls[k];
      // optional: set crossOrigin if your setup needs it:
      // img.crossOrigin = 'anonymous';
      img.onload = () => {
        loaded += 1;
        if (loaded === total) resolve(images);
      };
      img.onerror = (ev) => {
        console.error('Image load error for', urls[k], ev);
        // still count it so we don't hang if one asset fails
        loaded += 1;
        if (loaded === total) resolve(images);
      };
    });
    // If all images were already cached and onload didn't fire, check completeness after a tick
    setTimeout(() => {
      const allComplete = keys.every((k) => images[k].complete);
      if (allComplete) resolve(images);
    }, 100);
  });
}

export function getImage(key: AssetKey) {
  return images[key];
}
