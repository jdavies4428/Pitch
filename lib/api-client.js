const API = '/api/room';

async function readJson(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

async function post(body) {
  try {
    const res = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
      body: JSON.stringify(body),
    });
    const data = await readJson(res);
    if (!res.ok) {
      return { error: data?.error || `Request failed (${res.status})` };
    }
    return data || { error: 'Empty server response' };
  } catch {
    return { error: 'Network error' };
  }
}

export const roomApi = {
  create: (playerId, playerName, difficulty, gameMode, humanCount, requestedSeat) =>
    post({ action: 'create', playerId, playerName, difficulty, gameMode, humanCount, requestedSeat }),

  preview: (code) =>
    post({ action: 'preview', code: code.toUpperCase() }),

  join: (code, playerId, playerName, requestedSeat) =>
    post({ action: 'join', code: code.toUpperCase(), playerId, playerName, requestedSeat }),

  bid: (code, playerId, bid) =>
    post({ action: 'bid', code, playerId, bid }),

  play: (code, playerId, card) =>
    post({ action: 'play', code, playerId, card }),

  rematch: (code, playerId) =>
    post({ action: 'rematch', code, playerId }),

  poll: async (code, playerId) => {
    try {
      const res = await fetch(`${API}?code=${code}&playerId=${playerId}`, { cache: 'no-store' });
      const data = await readJson(res);
      if (!res.ok) {
        return { error: data?.error || `Poll failed (${res.status})` };
      }
      return data || { error: 'Empty server response' };
    } catch {
      return { error: 'Network error' };
    }
  },
};
