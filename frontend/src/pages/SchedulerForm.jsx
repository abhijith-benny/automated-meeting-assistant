import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'

function saveMeeting(meeting) {
  const raw = localStorage.getItem('scheduled_meetings') || '[]'
  const arr = JSON.parse(raw)
  arr.push(meeting)
  localStorage.setItem('scheduled_meetings', JSON.stringify(arr))
}

export default function SchedulerForm() {
  const [email, setEmail] = useState('')
  const [time, setTime] = useState('')
  const [link, setLink] = useState('')
  const navigate = useNavigate()

  function handleDone(e) {
    e.preventDefault()
    if (!email || !time || !link) {
      alert('Please fill all fields')
      return
    }
    const meeting = {
      id: Date.now().toString(),
      email,
      time,
      link,
      created_at: new Date().toISOString()
    }
    saveMeeting(meeting)
    navigate('/meetings')
  }

  return (
    <div className="panel">
      <form onSubmit={handleDone}>
        <div className="field">
          <label>Your Email</label>
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
        </div>

        <div className="field">
          <label>Meeting Time</label>
          <input type="datetime-local" value={time} onChange={(e) => setTime(e.target.value)} />
        </div>

        <div className="field">
          <label>Google Meet Link</label>
          <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://meet.google.com/..." />
        </div>

        <div className="buttons">
          <button type="submit">Done</button>
        </div>
      </form>
    </div>
  )
}
