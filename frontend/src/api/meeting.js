// Stubbed meeting API: frontend now no-ops network calls to automation service.
export async function start(body) {
  console.log('start called (stub)', body)
  return { started: true }
}

export async function stop() {
  console.log('stop called (stub)')
  return { stopped: true }
}

export async function getStatus() {
  return { running: false }
}

export async function getTranscript() {
  return null
}

export async function getSummary() {
  return null
}
