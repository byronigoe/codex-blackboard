export const registrationPromise =
  navigator.serviceWorker?.register("/sw.js") ??
  Promise.reject("navigator.serviceWorker is absent");
