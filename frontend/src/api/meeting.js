const BASE = '/api/meeting'

async function request(path, opts = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    ...opts
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json().catch(() => null)
}

export function start(body) {
  return request(`${BASE}/start`, { method: 'POST', body: JSON.stringify(body) })
}

export function stop() {
  return request(`${BASE}/stop`, { method: 'POST' })
}

export function getStatus() {
  return request(`${BASE}/status`, { method: 'GET' })
}

export function getTranscript() {
  return request(`${BASE}/transcript`, { method: 'GET' })
}

export function getSummary() {
  return request(`${BASE}/summary`, { method: 'GET' })
}
