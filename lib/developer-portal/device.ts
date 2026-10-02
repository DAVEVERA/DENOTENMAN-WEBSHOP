// Recognises the device behind a visit from the browser's user agent, the screen size the
// page reports and, on Chrome, the client hints. Safari never sends the iPhone model, so
// for iPhones the model family is derived from the screen size in points.

export type DeviceScreen = { width: number; height: number; pixelRatio: number };

export type DeviceInfo = {
  /** iPhone, iPad, Android-telefoon, Windows-pc, Mac, … */
  device: string;
  /** The model, or the model family that matches the screen; null when unknown. */
  model: string | null;
  os: string | null;
  browser: string | null;
};

// Portrait size in points and pixel ratio → the iPhones with that screen.
const IPHONE_SCREENS: Array<{ width: number; height: number; ratio: number; models: string }> = [
  { width: 320, height: 568, ratio: 2, models: "iPhone SE (1e generatie) of ouder" },
  { width: 375, height: 667, ratio: 2, models: "iPhone 6/6s/7/8 of SE (2e/3e generatie)" },
  { width: 414, height: 736, ratio: 3, models: "iPhone 6/6s/7/8 Plus" },
  { width: 375, height: 812, ratio: 3, models: "iPhone X/XS/11 Pro of 12/13 mini" },
  { width: 414, height: 896, ratio: 2, models: "iPhone XR of 11" },
  { width: 414, height: 896, ratio: 3, models: "iPhone XS Max of 11 Pro Max" },
  { width: 390, height: 844, ratio: 3, models: "iPhone 12/12 Pro/13/13 Pro/14 of 16e" },
  { width: 428, height: 926, ratio: 3, models: "iPhone 12/13 Pro Max of 14 Plus" },
  { width: 393, height: 852, ratio: 3, models: "iPhone 14 Pro/15/15 Pro of 16" },
  { width: 430, height: 932, ratio: 3, models: "iPhone 14 Pro Max/15 Plus/15 Pro Max of 16 Plus" },
  { width: 402, height: 874, ratio: 3, models: "iPhone 16 Pro, 17 of 17 Pro" },
  { width: 420, height: 912, ratio: 3, models: "iPhone Air" },
  { width: 440, height: 956, ratio: 3, models: "iPhone 16 Pro Max of 17 Pro Max" },
];

export function iphoneModelFromScreen(screen: DeviceScreen | null | undefined): string | null {
  if (!screen) return null;
  const width = Math.min(screen.width, screen.height);
  const height = Math.max(screen.width, screen.height);
  const ratio = Math.round(screen.pixelRatio);
  const match = IPHONE_SCREENS.find((entry) => entry.width === width && entry.height === height && entry.ratio === ratio);
  return match ? match.models : `iPhone met scherm ${width}×${height} (@${ratio}x)`;
}

function version(value: string | undefined, parts = 2): string {
  return (value ?? "").replace(/_/gu, ".").split(".").slice(0, parts).join(".");
}

function browserFrom(ua: string): string | null {
  const edge = ua.match(/Edg(?:A|iOS)?\/(\d+)/u);
  if (edge) return `Edge ${edge[1]}`;
  const samsung = ua.match(/SamsungBrowser\/(\d+)/u);
  if (samsung) return `Samsung Internet ${samsung[1]}`;
  const firefox = ua.match(/(?:Firefox|FxiOS)\/(\d+)/u);
  if (firefox) return `Firefox ${firefox[1]}`;
  const chromeIos = ua.match(/CriOS\/(\d+)/u);
  if (chromeIos) return `Chrome ${chromeIos[1]}`;
  const chrome = ua.match(/Chrome\/(\d+)/u);
  if (chrome) return `Chrome ${chrome[1]}`;
  const safari = ua.match(/Version\/([\d.]+).*Safari/u);
  if (safari) return `Safari ${version(safari[1], 3)}`;
  return null;
}

/**
 * The device in plain Dutch. `hints` are Chrome's client hints (model, platform version),
 * which are exact where the user agent is reduced.
 */
export function describeDevice(userAgent: string, screen?: DeviceScreen | null, hints?: { model?: string | null; platformVersion?: string | null }): DeviceInfo {
  const ua = userAgent || "";
  const browser = browserFrom(ua);
  const hintModel = hints?.model?.trim() || null;

  const iphone = ua.match(/iPhone;.*?OS (\d+[_\d]*)/u);
  if (iphone) {
    // Safari 26 and later freeze the OS in the user agent; its own version follows iOS.
    const safari = ua.match(/Version\/(\d+)\.(\d+)/u);
    const os = safari && Number(safari[1]) >= 26 ? `iOS ${safari[1]}.${safari[2]}` : `iOS ${version(iphone[1])}`;
    return { device: "iPhone", model: iphoneModelFromScreen(screen), os, browser };
  }
  const ipad = ua.match(/iPad;.*?OS (\d+[_\d]*)/u);
  if (ipad) return { device: "iPad", model: null, os: `iPadOS ${version(ipad[1])}`, browser };
  const android = ua.match(/Android (\d+(?:\.\d+)?)(?:; ([^;)]+))?/u);
  if (android) {
    const uaModel = android[2]?.trim();
    const model = hintModel || (uaModel && uaModel !== "K" ? uaModel : null);
    return { device: /Mobile/u.test(ua) ? "Android-telefoon" : "Android-tablet", model, os: `Android ${hints?.platformVersion ? version(hints.platformVersion, 1) : android[1]}`, browser };
  }
  if (/Windows NT/u.test(ua)) {
    // Windows 11 reports itself as NT 10.0; the client hint tells them apart.
    const major = Number(hints?.platformVersion?.split(".")[0] ?? 0);
    return { device: "Windows-pc", model: null, os: major >= 13 ? "Windows 11" : major > 0 ? "Windows 10" : "Windows", browser };
  }
  if (/Macintosh/u.test(ua)) {
    // iPads ask for the desktop site as a Mac; a touch screen gives them away.
    if (screen && screen.pixelRatio >= 2 && Math.max(screen.width, screen.height) <= 1366 && /Version\/[\d.]+ Safari/u.test(ua)) {
      return { device: "iPad of Mac", model: null, os: "macOS/iPadOS", browser };
    }
    return { device: "Mac", model: null, os: "macOS", browser };
  }
  if (/CrOS/u.test(ua)) return { device: "Chromebook", model: null, os: "ChromeOS", browser };
  if (/Linux/u.test(ua)) return { device: "Linux-pc", model: null, os: "Linux", browser };
  return { device: "Onbekend apparaat", model: hintModel, os: null, browser };
}

/** The network a visit came from, without the last part of the address. */
export function networkOf(forwardedFor: string | null | undefined): string | null {
  const ip = forwardedFor?.split(",")[0]?.trim();
  if (!ip) return null;
  const v4 = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.\d{1,3}$/u);
  if (v4) return `${v4[1]}.${v4[2]}.${v4[3]}.0/24`;
  if (ip.includes(":")) {
    const groups = ip.split(":").filter((group, index, all) => group !== "" || index < all.length - 1).slice(0, 3);
    if (groups.length === 3 && groups.every((group) => /^[0-9a-f]{1,4}$/iu.test(group))) return `${groups.join(":").toLowerCase()}::/48`;
  }
  return null;
}
