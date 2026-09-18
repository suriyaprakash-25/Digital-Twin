function withTimeout(promise, timeoutMs, label = 'Operation') {
  const ms = Number(timeoutMs);
  if (!Number.isFinite(ms) || ms <= 0) return Promise.resolve(promise);

  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });

  return Promise.race([Promise.resolve(promise), timeout])
    .finally(() => clearTimeout(timer));
}

module.exports = { withTimeout };
