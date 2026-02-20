const API = '/api/room';

async function post(body) {
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
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

  poll: async (code, playerId) => {
    const res = await fetch(`${API}?code=${code}&playerId=${playerId}`);
    return res.json();
  },
};
