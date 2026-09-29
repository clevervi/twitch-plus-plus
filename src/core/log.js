const NS = 'twpp';
const MAX_REPORTS = 50;

const reports = [];
let debugEnabled = false;

function paint(color) {
  return `color:${color};font-weight:bold`;
}

function fmt(args) {
  return [`%c[${NS}]`, paint('#9147ff'), ...args];
}

export function setDebug(value) {
  debugEnabled = !!value;
}

export function isDebug() {
  return debugEnabled;
}

export function log(...args) {
  if (debugEnabled) console.log(...fmt(args));
}

export function warn(...args) {
  console.warn(...fmt(args));
}

export function err(...args) {
  console.error(...fmt(args));
}

export function track(scope, error) {
  const entry = {
    scope,
    message: String((error && error.message) || error),
    stack: String((error && error.stack) || '').split('\n').slice(0, 4).join('\n'),
    at: new Date().toISOString(),
    url: typeof location !== 'undefined' ? location.pathname : '',
  };
  reports.push(entry);
  if (reports.length > MAX_REPORTS) reports.shift();
  err(scope, error);
  return entry;
}

export function trackedErrors() {
  return reports.slice();
}

export function clearTrackedErrors() {
  reports.length = 0;
}
