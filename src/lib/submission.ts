// Conserva la identidad del envío si se pierde la respuesta y se reintenta.
export function submissionIdentity(scope: string, payload: unknown): { requestId: string; trackingToken: string } {
  const fingerprint = JSON.stringify(payload);
  const storageKey = `la-tuba-submission-${scope}`;
  try {
    const stored = JSON.parse(sessionStorage.getItem(storageKey) || 'null');
    if (stored?.fingerprint === fingerprint) return stored;
  } catch { /* Un registro local inválido se reemplaza. */ }
  const next = { fingerprint, requestId: crypto.randomUUID(), trackingToken: crypto.randomUUID() };
  sessionStorage.setItem(storageKey, JSON.stringify(next));
  return next;
}
export function completeSubmission(scope: string) { sessionStorage.removeItem(`la-tuba-submission-${scope}`); }
