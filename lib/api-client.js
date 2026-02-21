const API = '/api/room';

async function post(body) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return { error: data.error || `Request failed (${res.status})` };
    }
    return res.json();
  } catch (err) {
    if (err.name === 'AbortError') return { error: 'Request timed out' };
    return { error: 'Network error' };
  } finally {
    clearTimeout(timeout);
  }
}

async function poll(code, playerId) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);
  try {
    const res = await fetch(`${API}?code=${code}&playerId=${playerId}`, {
      signal: controller.signal,
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return { error: data.error || `Poll failed (${res.status})` };
    }
    return res.json();
  } catch (err) {
    if (err.name === 'AbortError') return { error: 'Poll timed out' };
    return { error: 'Network error' };
  } finally {
    clearTimeout(timeout);
  }
}

export const roomApi = {
  create: (playerId, playerName, difficulty, gameMode) =>
    post({ action: 'create', playerId, playerName, difficulty, gameMode }),

  join: (code, playerId, playerName) =>
    post({ action: 'join', code: code.toUpperCase(), playerId, playerName }),

  bid: (code, playerId, bid) =>
    post({ action: 'bid', code, playerId, bid }),

  play: (code, playerId, card) =>
    post({ action: 'play', code, playerId, card }),

  rematch: (code, playerId) =>
    post({ action: 'rematch', code, playerId }),

  poll,
};
