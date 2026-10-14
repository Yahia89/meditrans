type MapsWindow = Window & {
  google?: { maps: typeof google.maps };
  initMap?: () => void;
};

let pendingLoad: Promise<typeof google.maps> | null = null;

/** Load the existing browser SDK only when a PDF needs driving directions. */
export function loadGoogleMaps(
  apiKey = import.meta.env?.VITE_GOOGLE_MAPS_API_KEY,
  timeoutMs = 10_000,
): Promise<typeof google.maps> {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return Promise.reject(new Error("Google Maps requires a browser."));
  }

  const mapsWindow = window as MapsWindow;
  const readyMaps = () => {
    const maps = mapsWindow.google?.maps;
    return typeof maps?.DirectionsService === "function" ? maps : null;
  };
  const loaded = readyMaps();
  if (loaded) return Promise.resolve(loaded);
  if (pendingLoad) return pendingLoad;

  const existing = document.getElementById("script-loader") as HTMLScriptElement | null
    ?? document.querySelector<HTMLScriptElement>(
      'script[src*="maps.googleapis.com/maps/api/js"]',
    );
  if (!existing && !apiKey) {
    return Promise.reject(new Error("Google Maps API key is unavailable."));
  }
  if (existing?.getAttribute("data-state") === "error") {
    return Promise.reject(new Error("The existing Google Maps script failed to load."));
  }

  const request = new Promise<typeof google.maps>((resolve, reject) => {
    const script = existing ?? document.createElement("script");
    const ownsScript = !existing;
    const previousCallback = mapsWindow.initMap;
    let settled = false;

    const cleanup = () => {
      clearTimeout(timer);
      script.removeEventListener("error", onError);
      // Another component may have chained our callback while loading. Keep its
      // wrapper intact; our settled callback remains safe to call afterward.
      if (mapsWindow.initMap === onReady) {
        if (previousCallback) mapsWindow.initMap = previousCallback;
        else delete mapsWindow.initMap;
      }
    };
    const fail = (message: string) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (ownsScript) {
        script.setAttribute("data-state", "error");
        script.remove();
      }
      reject(new Error(message));
    };
    const onError = () => fail("Google Maps could not be loaded.");
    const onReady = () => {
      try {
        previousCallback?.();
      } finally {
        if (!settled) {
          const maps = readyMaps();
          if (maps) {
            settled = true;
            if (ownsScript) script.setAttribute("data-state", "ready");
            cleanup();
            resolve(maps);
          } else {
            fail("Google Maps directions are unavailable.");
          }
        }
      }
    };
    const timer = setTimeout(
      () => fail("Google Maps loading timed out."),
      timeoutMs,
    );

    mapsWindow.initMap = onReady;
    script.addEventListener("error", onError);

    if (ownsScript) {
      // Match the existing @react-google-maps/api loader so it can recognize
      // and reuse this script. Its async callback, not the load event, is ready.
      script.id = "script-loader";
      script.type = "text/javascript";
      script.async = true;
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey!)}&v=weekly&libraries=geometry,places&loading=async&callback=initMap`;
      try {
        document.head.appendChild(script);
      } catch {
        fail("Google Maps script could not be added.");
      }
    }
  });

  pendingLoad = request;
  const release = () => {
    if (pendingLoad === request) pendingLoad = null;
  };
  void request.then(release, release);
  return request;
}
