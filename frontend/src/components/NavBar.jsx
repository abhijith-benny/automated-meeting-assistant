import React from 'react'
import { Link } from 'react-router-dom'

export default function NavBar() {
  return (
    <nav style={{ display: 'flex', gap: 12 }}>
      <Link to="/">Schedule Meeting</Link>
      <Link to="/meetings">Scheduled Meetings</Link>
    </nav>
  )
}
