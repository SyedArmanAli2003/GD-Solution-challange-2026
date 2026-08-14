import { db, auth } from './supabase.js'

function escapeHtml(str) { if (!str) return ''; return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;') }

function isValidPhone(p) { return /^[\d+\-(). ]{7,20}$/.test(p) }

let pollInterval = null
let capturedCoords = null

async function ensureSession() {
  const session = await auth.getCurrentUser()
  if (!session?.data?.user) {
    window.location.href = 'auth.html'
    throw new Error('Not authenticated')
  }
}

function timeAgo(ts) {
  if (!ts) return 'just now'
  const d = new Date(ts)
  const sec = Math.floor((Date.now() - d.getTime()) / 1000)
  if (sec < 60) return `${sec}s ago`
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`
  if (sec < 86400) return `${Math.floor(sec / 3600)}hr ago`
  return `${Math.floor(sec / 86400)}d ago`
}

function loadVolunteers(filter = 'all') {
  const listEl = document.getElementById('volunteersList')
  if (!listEl) return
  listEl.innerHTML = '<p style="color:#555">Loading...</p>'

  db.from('volunteers').select('*').order('registered_at', { ascending: false }).then(({ data, error }) => {
    if (error) { listEl.innerHTML = '<p style="color:#F09595">Error loading volunteers.</p>'; return }
    let docs = data || []
    if (filter !== 'all') docs = docs.filter(d => (d.skill || '').toLowerCase().includes(filter.toLowerCase()))
    if (docs.length === 0) { listEl.innerHTML = '<p style="color:#555;padding:16px">No volunteers registered yet</p>'; return }

    listEl.innerHTML = docs.map(v => {
      const initials = (v.name || '').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?'
      return `<div style="background:#13161f;border:1px solid #2a2d3a;border-radius:8px;padding:12px 14px;display:flex;align-items:center;gap:12px;margin-bottom:8px">
        <div style="width:36px;height:36px;border-radius:50%;background:#A32D2D;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:500;color:#FCEBEB;flex-shrink:0">${escapeHtml(initials)}</div>
        <div style="flex:1">
          <div style="font-size:12px;font-weight:500;color:#d0d0d0">${escapeHtml(v.name || 'Unknown')}</div>
          <div style="font-size:10px;color:#555">${escapeHtml(v.skill || 'No skill')} · ${escapeHtml(v.location || 'No location')}</div>
        </div>
        <div style="display:flex;align-items:center;gap:4px">
          <div style="width:6px;height:6px;border-radius:50%;background:${v.available ? '#3B6D11' : '#854F0B'}"></div>
          <span style="font-size:10px;color:${v.available ? '#9FE1CB' : '#FAC775'}">${v.available ? 'Available' : 'Busy'}</span>
        </div>
      </div>`
    }).join('')
  })
}

function loadMyTasks(uid, volunteerDocId) {
  const container = document.getElementById('myTasks')
  if (!container) return

  setInterval(() => {
    db.from('incidents').select('*').then(({ data, error }) => {
      if (error) return
      const tasks = (data || []).filter(inc => {
        const byUid = inc.reporter_id === uid
        const byDoc = volunteerDocId && inc.assigned_volunteer_id === volunteerDocId
        return (byUid || byDoc) && inc.status !== 'resolved'
      }).sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))

      if (tasks.length === 0) {
        container.innerHTML = '<p style="color:#555;padding:1rem 0;">No active tasks assigned to you yet.</p>'
        return
      }

      container.innerHTML = tasks.map(inc => {
        const lv = inc.triage_level || 3
        const colors = { 1: '#A32D2D', 2: '#854F0B', 3: '#EF9F27', 4: '#3B6D11', 5: '#555555' }
        const borderColor = colors[lv] || '#2a2d3a'
        return `<div style="background:#13161f;border:1px solid #2a2d3a;border-radius:8px;padding:14px;margin-bottom:10px;border-left:3px solid ${borderColor}">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
            <span style="font-size:12px;font-weight:700;color:#f0f0f0;">${escapeHtml(inc.type || 'Unknown')}</span>
            <span style="font-size:10px;background:${borderColor}22;color:${borderColor};border:1px solid ${borderColor}44;border-radius:4px;padding:1px 6px;">Level ${lv}</span>
            <span style="font-size:10px;color:#555;margin-left:auto;">${timeAgo(inc.created_at)}</span>
          </div>
          <div style="font-size:11px;color:#666;margin-bottom:6px;">📍 ${escapeHtml(inc.location || 'Location unavailable')}</div>
          ${inc.triage_reasoning ? `<div style="font-size:10px;color:#888;font-style:italic;margin-bottom:10px;">${escapeHtml(inc.triage_reasoning)}</div>` : ''}
          <div style="font-size:10px;color:#888;">Status: <span style="color:#EF9F27;font-weight:600;">${escapeHtml((inc.volunteer_status || 'assigned').replace('_', ' ').toUpperCase())}</span></div>
        </div>`
      }).join('')
    })
  }, 5000)
}

async function getVolunteerDocIdForUid(uid) {
  const { data } = await db.from('volunteers').select('id').eq('uid', uid).single()
  return data?.id || null
}

document.addEventListener('DOMContentLoaded', async () => {
  try { await ensureSession() } catch (err) {
    const el = document.getElementById('volunteersList')
    if (el) el.innerHTML = '<p style="color:#F09595;padding:16px">Unable to connect.</p>'
    return
  }

  loadVolunteers('all')
  pollInterval = setInterval(() => loadVolunteers(document.querySelector('.filter-btn.active')?.dataset?.filter || 'all'), 5000)

  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        capturedCoords = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        const locField = document.getElementById('location')
        if (locField) {
          locField.value = `${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`
          fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${pos.coords.latitude}&lon=${pos.coords.longitude}`, { headers: { 'Accept-Language': 'en' } })
            .then(r => r.json()).then(d => { if (d.display_name && locField) locField.value = d.display_name }).catch(() => {})
        }
      },
      () => { const f = document.getElementById('location'); if (f) f.placeholder = 'Enter manually' }
    )
  }

  document.getElementById('registerBtn')?.addEventListener('click', async () => {
    const name = (document.getElementById('volName')?.value || '').trim()
    const phone = (document.getElementById('volPhone')?.value || '').trim()
    const skill = document.getElementById('volSkill')?.value
    const location = (document.getElementById('location')?.value || '').trim()
    const available = document.getElementById('volAvailable')?.checked ?? true
    if (!name || !phone || !skill) { alert('Please fill in name, phone and skill'); return }
    if (!isValidPhone(phone)) { alert('Please enter a valid phone number (7-20 digits).'); return }

    const btn = document.getElementById('registerBtn')
    btn.textContent = 'Registering...'; btn.disabled = true
    try {
      await ensureSession()
      const { data: sessionData } = await auth.getCurrentUser()
      const user = sessionData?.user || {}
      const { error } = await db.from('volunteers').insert([{
        name, phone, skill,
        location: location || 'Location not provided',
        coordinates: capturedCoords || null,
        available,
        uid: user.id || null
      }])
      if (error) throw error
      btn.textContent = 'Registered!'; btn.style.background = '#0F6E56'
      document.getElementById('volName').value = ''; document.getElementById('volPhone').value = ''
      setTimeout(() => { btn.textContent = 'Register'; btn.style.background = ''; btn.disabled = false }, 2000)
    } catch (err) { alert('Registration failed: ' + err.message); btn.textContent = 'Register'; btn.disabled = false }
  })

  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'))
      btn.classList.add('active')
      loadVolunteers(btn.dataset.filter || 'all')
    })
  })

  const { data: sessionData } = await auth.getCurrentUser()
  const user = sessionData?.user
  if (user) {
    const section = document.getElementById('myTasksSection')
    if (section) section.style.display = 'block'
    const volDocId = await getVolunteerDocIdForUid(user.id)
    loadMyTasks(user.id, volDocId)
  }
})
