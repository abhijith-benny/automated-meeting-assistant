import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import * as meetingAPI from '../api/meeting'

function loadMeeting(id) {
  const raw = localStorage.getItem('scheduled_meetings') || '[]'
  try { return JSON.parse(raw).find((m) => m.id === id) } catch { return null }
}

export default function MeetingDetails() {
  const { id } = useParams()
  const [meeting, setMeeting] = useState(null)
  const [transcript, setTranscript] = useState([])
  const [summary, setSummary] = useState('')
  const [actionItems, setActionItems] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setMeeting(loadMeeting(id))
  }, [id])

  async function refresh() {
    setLoading(true)
    try {
      const t = await meetingAPI.getTranscript()
      setTranscript(t?.lines || [])
      const s = await meetingAPI.getSummary()
      setSummary(s?.summary || '')
      setActionItems(s?.action_items || [])
    } catch (e) {
      console.error(e)
      alert('Failed to fetch meeting data from backend')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="panel">
      {!meeting ? (
        <div className="empty">Meeting not found.</div>
      ) : (
        <div>
          <h2>Meeting for {meeting.email}</h2>
          <div style={{ marginBottom: 8 }}>Time: {meeting.time ? new Date(meeting.time).toLocaleString() : meeting.time}</div>
          <div style={{ marginBottom: 8 }}>
            Link: <a href={meeting.link} target="_blank" rel="noreferrer">Open Meet</a>
          </div>

          <div className="buttons" style={{ marginBottom: 12 }}>
            <button onClick={refresh} disabled={loading}>{loading ? 'Loading...' : 'Fetch Summary & Transcript'}</button>
          </div>

          <div className="viewer">
            <h3>AI Summary</h3>
            <div className="summary">{summary || 'No summary available.'}</div>
          </div>

          <div className="viewer">
            <h3>Action Items</h3>
            {actionItems.length === 0 ? <div className="empty">No action items.</div> : (
              <ul>{actionItems.map((a, i) => <li key={i}>{a}</li>)}</ul>
            )}
          </div>

          <div className="viewer">
            <h3>Transcript</h3>
            {transcript.length === 0 ? <div className="empty">No transcript available.</div> : (
              <div className="transcript">
                {transcript.map((t, idx) => (
                  <div key={idx} className="line">
                    <div className="speaker">{t.speaker || 'Speaker'}</div>
                    <div className="text">{t.text}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
