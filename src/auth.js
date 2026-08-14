import { insforge, db, auth } from './insforge.js'

function isValidPhone(p) { return /^[\d+\-(). ]{7,20}$/.test(p) }

// ── InsForge Auth — redirect signed-in users away from the auth page ──────────
async function checkAuth() {
  const { data } = await auth.getCurrentUser()
  if (data?.user) {
    console.log('[auth] Already signed in — redirecting')
    window.location.href = 'reporter.html'
  }
}
checkAuth()

function showErr(id, msg) {
  const el = document.getElementById(id)
  if (el) { el.textContent = msg; el.style.display = 'block' }
}

function hideErr(id) {
  const el = document.getElementById(id)
  if (el) el.style.display = 'none'
}

function showToast(msg) {
  const t = document.getElementById('toast')
  if (!t) return
  t.textContent = msg
  t.classList.add('show')
  setTimeout(() => t.classList.remove('show'), 3000)
}

function setLoading(btn, text, disabled) {
  btn.textContent = text
  btn.disabled = disabled
}

document.getElementById('tabSignIn')?.addEventListener('click', () => {
  document.getElementById('tabSignIn').classList.add('active')
  document.getElementById('tabCreate').classList.remove('active')
  document.getElementById('panelSignIn').classList.add('active')
  document.getElementById('panelCreate').classList.remove('active')
})

document.getElementById('tabCreate')?.addEventListener('click', () => {
  document.getElementById('tabCreate').classList.add('active')
  document.getElementById('tabSignIn').classList.remove('active')
  document.getElementById('panelCreate').classList.add('active')
  document.getElementById('panelSignIn').classList.remove('active')
})

document.getElementById('btnSignIn')?.addEventListener('click', async () => {
  hideErr('siError')
  const email = document.getElementById('siEmail')?.value?.trim()
  const password = document.getElementById('siPassword')?.value
  if (!email || !password) { showErr('siError', 'Please enter your email and password.'); return }

  const btn = document.getElementById('btnSignIn')
  setLoading(btn, 'Signing in…', true)

  try {
    const { data, error } = await auth.signInWithPassword({ email, password })
    if (error) throw error

    const { data: profile } = await db.from('users').select('*').eq('id', data.user.id).single()
    if (profile) {
      sessionStorage.setItem('userProfile', JSON.stringify({ ...profile, uid: data.user.id }))
    }
    window.location.href = 'reporter.html'
  } catch (err) {
    setLoading(btn, 'Sign In', false)
    const msgs = {
      'Invalid login credentials': 'Invalid email or password.',
      'Email not confirmed': 'Please verify your email before signing in.',
    }
    showErr('siError', msgs[err.message] || 'Sign in failed: ' + err.message)
  }
})

document.getElementById('btnForgot')?.addEventListener('click', async () => {
  const email = document.getElementById('siEmail')?.value?.trim()
  if (!email) { showErr('siError', 'Enter your email address first.'); return }
  try {
    const { error } = await auth.sendResetPasswordEmail({ email })
    if (error) throw error
    hideErr('siError')
    showToast('Password reset email sent!')
  } catch (err) {
    showErr('siError', 'Could not send reset email. Check the address and try again.')
  }
})

document.getElementById('btnCreate')?.addEventListener('click', async () => {
  hideErr('regError')
  const name = document.getElementById('regName')?.value?.trim()
  const email = document.getElementById('regEmail')?.value?.trim()
  const phone = document.getElementById('regPhone')?.value?.trim()
  const address = document.getElementById('regAddress')?.value?.trim()
  const pass = document.getElementById('regPass')?.value
  const confirm = document.getElementById('regConfirm')?.value

  if (!name || !email || !phone || !pass || !confirm) { showErr('regError', 'Please fill in all required fields.'); return }
  if (!isValidPhone(phone)) { showErr('regError', 'Please enter a valid phone number (7-20 digits).'); return }
  if (pass.length < 6) { showErr('regError', 'Password must be at least 6 characters.'); return }
  if (pass !== confirm) { showErr('regError', 'Passwords do not match.'); return }

  const btn = document.getElementById('btnCreate')
  setLoading(btn, 'Creating account…', true)

  try {
    const { data, error } = await auth.signUp({
      email,
      password: pass,
      name,
      redirectTo: window.location.origin + '/auth.html'
    })
    if (error) throw error

    const profile = {
      id: data.user.id,
      email,
      full_name: name.trim(),
      name: name.trim(),
      phone: phone.replace(/[^\d+]/g, ''),
      address: (address || '').trim(),
      role: 'reporter',
      created_at: new Date().toISOString(),
      total_reports: 0,
      avatar: ''
    }

    const { error: dbError } = await db.from('users').insert([profile])
    if (dbError) console.warn('[auth] Profile insert warning:', dbError.message)

    sessionStorage.setItem('userProfile', JSON.stringify({ ...profile, uid: data.user.id }))

    if (data.requireEmailVerification) {
      showToast('Account created! Check your email to verify and then sign in.')
      setTimeout(() => window.location.href = 'auth.html', 3000)
    } else {
      window.location.href = 'reporter.html'
    }
  } catch (err) {
    setLoading(btn, 'Create Account', false)
    const msgs = {
      'User already registered': 'This email is already registered. Try signing in.',
    }
    showErr('regError', msgs[err.message] || 'Registration failed: ' + err.message)
  }
})

const GOOGLE_SVG = `<svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>`

async function googleSignIn(btn, errId, label) {
  btn.innerHTML = 'Opening Google...'
  btn.disabled = true
  hideErr(errId)

  try {
    const { data, error } = await auth.signInWithOAuth({ provider: 'google' })
    if (error) throw error
    window.location.href = data.url
  } catch (err) {
    btn.innerHTML = GOOGLE_SVG + ' ' + label
    btn.disabled = false
    const msgs = {
      'popup_closed': 'Sign in cancelled.',
      'unauthorized_domain': 'Domain not authorised in InsForge Console.'
    }
    showErr(errId, msgs[err.message] || 'Google sign in failed: ' + err.message)
  }
}

document.getElementById('googleBtnSi')?.addEventListener('click', function () {
  googleSignIn(this, 'googleErrSi', 'Continue with Google')
})
document.getElementById('googleBtnReg')?.addEventListener('click', function () {
  googleSignIn(this, 'googleErrReg', 'Sign up with Google')
})
