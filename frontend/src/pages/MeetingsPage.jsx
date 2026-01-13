import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

function loadMeetings() {
  const raw = localStorage.getItem('scheduled_meetings') || '[]'
  try { return JSON.parse(raw) } catch { return [] }
}

export default function MeetingsPage() {
  const [meetings, setMeetings] = useState([])

  useEffect(() => {
    setMeetings(loadMeetings())
  }, [])

  function remove(id) {
    const next = meetings.filter((m) => m.id !== id)
    setMeetings(next)
    localStorage.setItem('scheduled_meetings', JSON.stringify(next))
  }

  return (
    <div className="panel">
      <h2>Scheduled Meetings</h2>
      {meetings.length === 0 ? (
        <div className="empty">No meetings scheduled.</div>
      ) : (
        <ul>
          {meetings.map((m) => (
            <li key={m.id} style={{ marginBottom: 10 }}>
              <div><strong>{m.email}</strong> — {m.time ? new Date(m.time).toLocaleString() : m.time}</div>
              <div style={{ marginTop: 6 }}>
                <Link to={`/meeting/${m.id}`} style={{ marginRight: 8 }}>View</Link>
                <a href={m.link} target="_blank" rel="noreferrer" style={{ marginRight: 8 }}>Open Meet</a>
                <button onClick={() => remove(m.id)}>Delete</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
