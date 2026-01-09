'use client'

import { useState, useEffect } from 'react'

interface AdminAuthProps {
  onAuthenticated: () => void
  isAuthenticated: boolean
}

export default function AdminAuth({ onAuthenticated, isAuthenticated }: AdminAuthProps) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [attempts, setAttempts] = useState(0)
  const [isLocked, setIsLocked] = useState(false)

  useEffect(() => {
    // Check if already authenticated
    const authToken = localStorage.getItem('admin_auth_token')
    const authExpiry = localStorage.getItem('admin_auth_expiry')

    if (authToken && authExpiry) {
      const expiryTime = parseInt(authExpiry)
      if (Date.now() < expiryTime) {
        onAuthenticated()
      } else {
        // Clear expired auth
        localStorage.removeItem('admin_auth_token')
        localStorage.removeItem('admin_auth_expiry')
      }
    }

    // Check if locked out
    const lockoutUntil = localStorage.getItem('admin_lockout')
    if (lockoutUntil) {
      const lockoutTime = parseInt(lockoutUntil)
      if (Date.now() < lockoutTime) {
        setIsLocked(true)
        setTimeout(() => {
          setIsLocked(false)
          localStorage.removeItem('admin_lockout')
        }, lockoutTime - Date.now())
      } else {
        localStorage.removeItem('admin_lockout')
      }
    }
  }, [onAuthenticated])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (isLocked) {
      setError('Too many failed attempts. Please try again in 15 minutes.')
      return
    }

    try {
      // Send password to backend for verification
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/admin/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      })

      if (response.ok) {
        // Success - store auth token with 24 hour expiry
        const authToken = btoa(`admin:${Date.now()}`)
        const expiryTime = Date.now() + (24 * 60 * 60 * 1000) // 24 hours

        localStorage.setItem('admin_auth_token', authToken)
        localStorage.setItem('admin_auth_expiry', expiryTime.toString())
        localStorage.removeItem('admin_attempts')

        setError('')
        setPassword('')
        onAuthenticated()
      } else {
        // Failed attempt
        const newAttempts = attempts + 1
        setAttempts(newAttempts)
        localStorage.setItem('admin_attempts', newAttempts.toString())

        if (newAttempts >= 3) {
          // Lock out for 15 minutes after 3 failed attempts
          const lockoutUntil = Date.now() + (15 * 60 * 1000)
          localStorage.setItem('admin_lockout', lockoutUntil.toString())
          setIsLocked(true)
          setError('Too many failed attempts. Locked out for 15 minutes.')

          setTimeout(() => {
            setIsLocked(false)
            setAttempts(0)
            localStorage.removeItem('admin_lockout')
            localStorage.removeItem('admin_attempts')
          }, 15 * 60 * 1000)
        } else {
          setError(`Invalid password. ${3 - newAttempts} attempts remaining.`)
        }
        setPassword('')
      }
    } catch (err) {
      setError('Failed to verify password. Please try again.')
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('admin_auth_token')
    localStorage.removeItem('admin_auth_expiry')
    setPassword('')
    setError('')
  }

  if (isAuthenticated) {
    return (
      <div className="flex items-center gap-2 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
          Authenticated
        </span>
        <button
          onClick={handleLogout}
          className="text-gray-400 hover:text-gray-600 underline"
        >
          Logout
        </button>
      </div>
    )
  }

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
      <div className="flex items-start gap-2 mb-3">
        <span className="text-amber-600 text-lg">🔒</span>
        <div className="flex-1">
          <h4 className="font-semibold text-amber-900 mb-1">Admin Access Required</h4>
          <p className="text-sm text-amber-700">
            Enter the admin password to upload activities.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Admin password"
            disabled={isLocked}
            className={`
              w-full px-3 py-2 border rounded-md text-sm
              ${isLocked
                ? 'bg-gray-100 border-gray-300 cursor-not-allowed'
                : 'border-amber-300 focus:border-amber-500 focus:ring-1 focus:ring-amber-500'
              }
            `}
            autoComplete="current-password"
          />
        </div>

        {error && (
          <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded border border-red-200">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={!password || isLocked}
          className={`
            w-full px-4 py-2 rounded-md text-sm font-medium transition-colors
            ${!password || isLocked
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-amber-600 text-white hover:bg-amber-700'
            }
          `}
        >
          {isLocked ? 'Locked Out' : 'Authenticate'}
        </button>
      </form>

      <p className="text-xs text-gray-500 mt-3">
        Authentication expires after 24 hours. Contact the administrator for the password.
      </p>
    </div>
  )
}
