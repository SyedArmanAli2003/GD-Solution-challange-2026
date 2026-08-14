import { insforge, db, auth } from './insforge.js'
import { INSFORGE_URL } from './insforge.js'

function escapeHtml(str) { if (!str) return ''; return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;') }

// Express AI/triage backend — set CONFIG.BACKEND_URL in public/config.js for prod
const BACKEND_URL = (typeof CONFIG !== 'undefined' && CONFIG.BACKEND_URL) ? CONFIG.BACKEND_URL : 'http://localhost:3000'

// ── DOM refs ──
const authModal = document.getElementById('authModal')
const emailInput = document.getElementById('emailInput')
const passInput = document.getElementById('passInput')
const signInBtn = document.getElementById('signInBtn')
const authError = document.getElementById('authError')
const coordApp = document.getElementById('coordApp')
const signOutBtn = document.getElementById('signOutBtn')
const userEmailEl = document.getElementById('userEmail')
const incidentsList = document.getElementById('incidentsList')
const emptyState = document.getElementById('emptyState')

const hdrActiveNum = document.getElementById('hdrActiveNum')
const hdrDeployedNum = document.getElementById('hdrDeployedNum')
const hdrResolvedNum = document.getElementById('hdrResolvedNum')
const statActiveNum = document.getElementById('statActiveNum')
const statDeployedNum = document.getElementById('statDeployedNum')
const statResolvedNum = document.getElementById('statResolvedNum')
const statAvgResponse = document.getElementById('statAvgResponse')
const statPendingTriage = document.getElementById('statPendingTriage')

let latestIncidents = []
let volunteerPool = []
let pollInterval = null
let volPollInterval = null

// ── Auth ──
function showDashboard(user) {
  authModal.style.display = 'none'
  coordApp.style.display = 'grid'
  if (userEmailEl && user) userEmailEl.textContent = user.email || 'Coordinator'
  startPolling()
  pollVolunteers()
}

function showLoginForm() {
  coordApp.style.display = 'none'
  authModal.style.display = 'flex'
}

async function initApp() {
  const { data } = await auth.getCurrentUser()
  if (data?.user) {
    showDashboard(data.user)
  } else {
    showLoginForm()
  }
}
initApp()

signInBtn?.addEventListener('click', async () => {
  const email = emailInput.value.trim()
  const password = passInput.value
  if (!email || !password) { authError.textContent = 'Please enter email and password'; authError.style.display = 'block'; return }
  try {
    authError.style.display = 'none'
    signInBtn.textContent = 'Signing in...'
    const { error } = await auth.signInWithPassword({ email, password })
    if (error) throw error
  } catch (err) {
    signInBtn.textContent = 'Sign In'
    authError.textContent = err.message === 'Invalid login credentials' ? 'Invalid email or password' : err.message
    authError.style.display = 'block'
  }
})

passInput?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); signInBtn.click() }
})

signOutBtn?.addEventListener('click', async () => {
  await auth.signOut()
  sessionStorage.removeItem('coordinatorEmail')
  window.location.href = 'index.html'
})

// ── Helpers ──
function timeAgo(date) {
  if (!date) return 'just now'
  const seconds = Math.floor((new Date() - new Date(date)) / 1000)
  if (seconds < 60) return `${seconds}s ago`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}hr ago`
  return `${Math.floor(seconds / 86400)}d ago`
}

async function addTimelineEntry(incidentId, action, actor, details = '') {
  try {
    await db.from('incident_timeline').insert([{ incident_id: incidentId, action, actor, details, created_at: new Date().toISOString() }])
  } catch (err) {
    console.warn('[Timeline] Failed:', err.message)
  }
}

// ── Polling (replaces Firestore onSnapshot) ──
function startPolling() {
  if (pollInterval) return
  pollIncidents()
  pollInterval = setInterval(pollIncidents, 3000)
}

function pollIncidents() {
  db.from('incidents').select('*').order('created_at', { ascending: false }).then(({ data, error }) => {
    if (error) { console.error('[Poll] error:', error); return }
    const incidents = data || []
    latestIncidents = incidents
    let activeCount = 0, deployedCount = 0, resolvedTodayCount = 0, pendingTriageCount = 0
    const startOfToday = new Date()
    startOfToday.setHours(0, 0, 0, 0)
    const responseTimes = []

    incidents.forEach(inc => {
      if (inc.status === 'resolved') {
        const resolvedDate = inc.resolved_at ? new Date(inc.resolved_at) : null
        if (resolvedDate && resolvedDate >= startOfToday) resolvedTodayCount++
        if (inc.assigned_at && inc.resolved_at) {
          const diff = (new Date(inc.resolved_at) - new Date(inc.assigned_at)) / 60000
          if (diff > 0) responseTimes.push(diff)
        }
      } else {
        activeCount++
        if (inc.assigned_volunteer_id) deployedCount++
        if (!inc.triage_complete || inc.triage_level == null) pendingTriageCount++
      }
    })

    updateStats(activeCount, deployedCount, resolvedTodayCount, pendingTriageCount, responseTimes)
    renderList(incidents)
  })
}

function pollVolunteers() {
  if (volPollInterval) clearInterval(volPollInterval)
  fetchVolunteers()
  volPollInterval = setInterval(fetchVolunteers, 5000)
}

function fetchVolunteers() {
  db.from('volunteers').select('*').order('registered_at', { ascending: false }).then(({ data, error }) => {
    if (error) return
    volunteerPool = data || []
    renderVolunteers()
  })
}

// ── Triage visuals ──
function triageVisual(level) {
  switch (level) {
    case 1: return { color: '#A32D2D', label: 'Level 1 — Critical', rank: 1 }
    case 2: return { color: '#854F0B', label: 'Level 2 — Severe', rank: 2 }
    case 3: return { color: '#EF9F27', label: 'Level 3 — Moderate', rank: 3 }
    case 4: return { color: '#3B6D11', label: 'Level 4 — Minor', rank: 4 }
    case 5: return { color: '#555555', label: 'Level 5 — Monitoring', rank: 5 }
    default: return { color: '#2a2d3a', label: 'Pending', rank: 99, isPending: true }
  }
}

function getTriageDetails(inc) {
  if (inc.triage_complete && inc.triage_level != null) return triageVisual(inc.triage_level)
  return { color: '#2a2d3a', label: '<span class="coord-spinner"></span> Analyzing...', rank: 99, isPending: true }
}

function getExpectedSkills(type) {
  switch (type) {
    case 'Medical': return ['medical', 'first aid', 'rescue']
    case 'Disaster': return ['rescue', 'coordination', 'supply']
    case 'Conflict': return ['coordination', 'rescue']
    case 'Resource': return ['supply', 'logistics', 'coordination']
    case 'Hospitality': return ['hospitality', 'shelter', 'coordination']
    default: return ['coordination']
  }
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function matchScore(incident, volunteer) {
  const expected = getExpectedSkills(incident.type)
  const volSkill = (volunteer.skill || '').toLowerCase()
  let score = 0
  if (expected.some(k => volSkill.includes(k))) score += 70

  const incCoords = incident.coordinates
  const volCoords = volunteer.coordinates
  if (incCoords?.lat && volCoords?.lat) {
    const dist = haversineKm(incCoords.lat, incCoords.lng, volCoords.lat, volCoords.lng)
    if (dist <= 2) score += 50
    else if (dist <= 5) score += 35
    else if (dist <= 15) score += 20
    else if (dist <= 30) score += 10
  }
  if ((incident.triage_level || 5) <= 2) score += 10
  return score
}

function getVolunteerMatches(incident, limit = 3) {
  return volunteerPool
    .filter(v => v.available)
    .map(v => ({ ...v, matchScore: matchScore(incident, v) }))
    .filter(v => v.matchScore > 0)
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, limit)
}

async function dispatchVolunteer(incidentId, volunteerId) {
  const volunteer = volunteerPool.find(v => v.id === volunteerId)
  if (!volunteer) throw new Error('Volunteer not found')
  const { data: sessionData } = await auth.getCurrentUser()
  const email = sessionData?.user?.email || 'coordinator'

  await Promise.all([
    db.from('incidents').update({
      assigned_volunteer_id: volunteerId,
      assigned_volunteer_name: volunteer.name || 'Volunteer',
      assigned_volunteer_skill: volunteer.skill || '',
      assigned_at: new Date().toISOString(),
      dispatch_status: 'assigned'
    }).eq('id', incidentId),
    db.from('volunteers').update({ available: false, active_incident_id: incidentId, last_assigned_at: new Date().toISOString() }).eq('id', volunteerId),
    addTimelineEntry(incidentId, 'dispatched', email, `Dispatched ${volunteer.name || 'Volunteer'} (${volunteer.skill || 'General'})`)
  ])
}

// ── Render ──
function renderList(incidents) {
  incidentsList.innerHTML = ''
  const active = incidents.filter(i => i.status !== 'resolved')
  if (active.length === 0) {
    emptyState.style.display = 'block'
    incidentsList.appendChild(emptyState)
    return
  }
  emptyState.style.display = 'none'

  active.sort((a, b) => {
    const r = triageVisual(a.triage_level).rank - triageVisual(b.triage_level).rank
    if (r !== 0) return r
    return new Date(b.created_at || 0) - new Date(a.created_at || 0)
  })

  active.forEach(inc => {
    const triage = getTriageDetails(inc)
    const locationLabel = inc.location || (inc.coordinates ? `${inc.coordinates.lat?.toFixed(4)}, ${inc.coordinates.lng?.toFixed(4)}` : 'Location unavailable')
    const matches = getVolunteerMatches(inc, 3)

    const card = document.createElement('div')
    card.className = 'coord-incident-card'
    card.style.borderLeftColor = triage.color
    card.innerHTML = `
      <div class="coord-card-row-top">
        <span class="coord-level-badge" style="background:${triage.color}22; color:${triage.color}">${triage.label}</span>
        <span class="coord-time-ago">${inc.created_at ? timeAgo(new Date(inc.created_at)) : 'just now'}</span>
      </div>
      <div class="coord-card-body">
        <h3 class="coord-card-title">${escapeHtml(inc.type || 'Unknown Crisis')}</h3>
        <p class="coord-card-location">📍 ${escapeHtml(locationLabel)} &nbsp;&nbsp; 👤 ${escapeHtml(inc.reporter_name || 'Anonymous')}</p>
        ${inc.description ? `<p class="coord-card-desc">"${escapeHtml(inc.description)}"</p>` : ''}
      </div>
      <div class="coord-card-footer">
        <div class="coord-chip-row">
          ${(inc.volunteer_types || getExpectedSkills(inc.type)).map(t => `<span class="coord-chip">${escapeHtml(t)}</span>`).join('')}
          <span class="coord-chip">🔴 Active</span>
          ${inc.assigned_volunteer_name ? `<span class="coord-chip" style="border-color:#2f9444;color:#9FE1CB;">Assigned: ${escapeHtml(inc.assigned_volunteer_name)}</span>` : ''}
        </div>
        <div style="display:flex;gap:8px">
          ${!inc.assigned_volunteer_id
            ? matches.map(m => `<button class="coord-pill dispatch-btn" data-incident-id="${inc.id}" data-volunteer-id="${m.id}" style="cursor:pointer;padding:4px 8px;font-size:11px;">${escapeHtml(m.name || 'V')} · ${escapeHtml(m.skill || '')}</button>`).join('')
            : ''}
          <button class="coord-resolve-btn resolve-btn" data-id="${inc.id}">Mark Resolved</button>
        </div>
      </div>`
    incidentsList.appendChild(card)
  })

  document.querySelectorAll('.resolve-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id
      btn.disabled = true
      btn.textContent = 'Resolving…'
      try {
        const target = latestIncidents.find(i => i.id === id)
        const { data: sessionData2 } = await auth.getCurrentUser()
        const email = sessionData2?.user?.email || 'coordinator'

        await db.from('incidents').update({ status: 'resolved', resolved_at: new Date().toISOString() }).eq('id', id)
        await addTimelineEntry(id, 'resolved', email, 'Incident marked as resolved')

        if (target?.assigned_volunteer_id) {
          await db.from('volunteers').update({ available: true, active_incident_id: null }).eq('id', target.assigned_volunteer_id)
        }
        showToast('Incident marked as resolved.')
      } catch (err) {
        showToast('Failed to update status.')
        btn.disabled = false
        btn.textContent = 'Mark Resolved'
      }
    })
  })

  document.querySelectorAll('.dispatch-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const incidentId = btn.dataset.incidentId
      const volunteerId = btn.dataset.volunteerId
      btn.disabled = true
      btn.textContent = 'Dispatching...'
      try {
        await dispatchVolunteer(incidentId, volunteerId)
        showToast('Volunteer dispatched.')
      } catch (err) {
        btn.disabled = false
        btn.textContent = 'Dispatch'
        showToast('Dispatch failed.')
      }
    })
  })
}

function renderVolunteers() {
  const list = document.getElementById('coordVolList')
  if (!list) return
  list.innerHTML = ''
  let total = 0, avail = 0, busy = 0
  volunteerPool.forEach(v => {
    total++
    if (v.available) avail++; else busy++
    const card = document.createElement('div')
    card.style.cssText = 'background:var(--bg-surface);padding:1rem;border-radius:8px;border:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;'
    card.innerHTML = `
      <div style="display:flex;align-items:center;gap:1rem;">
        <div style="width:40px;height:40px;border-radius:50%;background:var(--bg-deep);display:flex;align-items:center;justify-content:center;font-weight:bold;">${escapeHtml((v.name || 'V')[0].toUpperCase())}</div>
        <div><div style="font-weight:600;">${escapeHtml(v.name)} <span style="margin-left:0.5rem;font-size:11px;">${escapeHtml(v.skill)}</span></div><div style="font-size:0.85rem;color:var(--text-dim);">📍 ${escapeHtml(v.location || 'Unknown')}</div></div>
      </div>
      <span style="color:${v.available ? 'var(--accent-green)' : 'var(--accent-red)'}">${v.available ? 'Available' : 'Busy'}</span>`
    list.appendChild(card)
  })
  document.getElementById('volTotal').textContent = total
  document.getElementById('volAvail').textContent = avail
  document.getElementById('volBusy').textContent = busy
}

// ── Stats ──
function updateStats(activeCount, deployedCount, resolvedCount, pendingTriageCount = 0, responseTimes = []) {
  hdrActiveNum && (hdrActiveNum.textContent = activeCount)
  hdrDeployedNum && (hdrDeployedNum.textContent = deployedCount)
  hdrResolvedNum && (hdrResolvedNum.textContent = resolvedCount)
  statActiveNum && (statActiveNum.textContent = activeCount)
  statDeployedNum && (statDeployedNum.textContent = deployedCount)
  statResolvedNum && (statResolvedNum.textContent = resolvedCount)
  if (statPendingTriage) statPendingTriage.textContent = pendingTriageCount
  if (statAvgResponse) {
    if (responseTimes.length > 0) {
      statAvgResponse.textContent = Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length) + 'm'
    } else {
      statAvgResponse.textContent = activeCount > 0 ? 'N/A' : '--'
    }
  }
}

function showToast(msg, duration = 3000) {
  const toast = document.getElementById('toast')
  if (!toast) return
  toast.textContent = msg
  toast.classList.add('show')
  setTimeout(() => toast.classList.remove('show'), duration)
}

// ── Panel switching ──
window.showPanel = function (name) {
  document.querySelectorAll('.panel').forEach(p => p.style.display = 'none')
  const target = document.getElementById('panel-' + name)
  if (target) target.style.display = 'block'
  document.querySelectorAll('.coord-nav-link').forEach(n => n.classList.remove('active'))
  const link = document.querySelector(`[data-panel="${name}"]`)
  if (link) link.classList.add('active')
}

document.querySelectorAll('.coord-nav-link').forEach(link => {
  link.addEventListener('click', (e) => {
    e.preventDefault()
    const panel = link.dataset.panel
    if (panel) showPanel(panel)
  })
})

// ── Report panel ──
let panelSelectedCategory = null

document.querySelectorAll('#panel-report .cat-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#panel-report .cat-btn').forEach(b => b.classList.remove('selected'))
    btn.classList.add('selected')
    panelSelectedCategory = btn.dataset.type
  })
})

document.getElementById('panelSubmitBtn')?.addEventListener('click', async () => {
  if (!panelSelectedCategory) { alert('Please select a category.'); return }
  const desc = document.getElementById('panelIncidentDesc').value.trim()
  const loc = document.getElementById('panelIncidentLoc').value.trim() || 'Unknown Location'
  const btn = document.getElementById('panelSubmitBtn')
  btn.disabled = true; btn.textContent = 'Submitting...'

  try {
    const { data, error } = await db.from('incidents').insert([{
      type: panelSelectedCategory,
      description: desc,
      location: loc,
      status: 'pending',
      triage_complete: false,
      reporter_name: 'Coordinator'
    }]).select()
    if (error) throw error
    if (data?.[0]?.id) {
      await addTimelineEntry(data[0].id, 'created', 'Coordinator', `Incident reported via dashboard.`)
    }
    document.getElementById('panelSuccessMsg').style.display = 'block'
    setTimeout(() => {
      document.getElementById('panelSuccessMsg').style.display = 'none'
      document.getElementById('panelIncidentDesc').value = ''
      document.getElementById('panelIncidentLoc').value = ''
      document.querySelectorAll('#panel-report .cat-btn').forEach(b => b.classList.remove('selected'))
      panelSelectedCategory = null
      showPanel('incidents')
    }, 2000)
  } catch (e) {
    console.error(e)
    alert('Failed to submit report.')
  } finally {
    btn.disabled = false; btn.textContent = 'Submit Incident'
  }
})

// ── History panel ──
function loadHistory() {
  db.from('incidents').select('*').order('created_at', { ascending: false }).then(({ data, error }) => {
    if (error) return
    const list = document.getElementById('coordHistList')
    if (!list) return
    list.innerHTML = ''
    let total = 0, pending = 0, resolved = 0
    ;(data || []).forEach(inc => {
      total++
      if (inc.status === 'resolved') resolved++; else pending++
      const triage = getTriageDetails(inc)
      const card = document.createElement('div')
      card.style.cssText = `background:var(--bg-surface);padding:1rem;border-radius:8px;border:1px solid var(--border);border-left:4px solid ${triage.color};display:flex;justify-content:space-between;align-items:center;`
      card.innerHTML = `
        <div>
          <div style="font-weight:600;margin-bottom:0.4rem;">${escapeHtml(inc.type || 'Emergency')} <span style="margin-left:0.5rem;font-size:11px;">${triage.label}</span></div>
          <div style="font-size:0.85rem;color:var(--text-dim);">📍 ${escapeHtml(inc.location || 'Unknown')} • 👤 ${escapeHtml(inc.reporter_name || 'Anonymous')}</div>
        </div>
        <span style="color:${inc.status === 'resolved' ? 'var(--accent-green)' : 'var(--accent-red)'}">${inc.status === 'resolved' ? 'Resolved' : 'Pending'}</span>`
      list.appendChild(card)
    })
    document.getElementById('histTotal').textContent = total
    document.getElementById('histPending').textContent = pending
    document.getElementById('histResolved').textContent = resolved
  })
}

// ── Wire up ──
document.querySelectorAll('.vol-filter').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.vol-filter').forEach(b => b.classList.remove('active'))
    btn.classList.add('active')
  })
})

document.querySelectorAll('.hist-filter').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.hist-filter').forEach(b => b.classList.remove('active'))
    btn.classList.add('active')
    loadHistory()
  })
})

document.getElementById('opsOpenReportBtn')?.addEventListener('click', () => showPanel('report'))
document.getElementById('btnExportCSV')?.addEventListener('click', () => {
  alert('CSV export coming soon for InsForge migration.')
})

// Load history when switching to that panel
const origShowPanel = window.showPanel
window.showPanel = function (name) {
  origShowPanel(name)
  if (name === 'history') loadHistory()
  if (name === 'settings') initModelSelector()
}

// ── AI Model Selector ──────────────────────────────────────────────────────────
const MODEL_STORAGE_KEY = 'resqnet_preferred_model'
let availableModels = []

export function getPreferredModel() {
  return localStorage.getItem(MODEL_STORAGE_KEY) || 'nim-deepseek'
}

async function initModelSelector() {
  const list = document.getElementById('modelSelectorList')
  const badge = document.getElementById('activeModelBadge')
  if (!list || availableModels.length > 0) return // Already loaded

  try {
    const res = await fetch(`${BACKEND_URL}/api/triage/models`)
    availableModels = await res.json()
  } catch {
    availableModels = [
      { id: 'nim-deepseek', label: 'DeepSeek V4 Flash (NIM)', badge: 'DS·NIM', badgeColor: '#00d4ff' },
      { id: 'llama-3.3-70b', label: 'Llama 3.3 70b Instruct (OpenRouter)', badge: 'L3.3', badgeColor: '#a855f7' },
      { id: 'gpt-oss-120b', label: 'GPT-OSS 120b (OpenRouter)', badge: 'GPT', badgeColor: '#10b981' },
    ]
  }

  renderModelSelector(list, badge)
}

function renderModelSelector(list, badge) {
  const current = getPreferredModel()
  list.innerHTML = ''

  availableModels.forEach(model => {
    const isSelected = model.id === current
    const card = document.createElement('div')
    card.dataset.modelId = model.id
    card.style.cssText = `
      display:flex; align-items:center; gap:0.75rem; padding:0.75rem 1rem;
      border-radius:8px; cursor:pointer; transition:all 0.15s;
      border:1px solid ${isSelected ? model.badgeColor : 'var(--border)'};
      background:${isSelected ? model.badgeColor + '14' : 'var(--bg-surface)'};
    `
    card.innerHTML = `
      <span style="
        font-size:10px; font-weight:700; padding:3px 8px; border-radius:20px;
        background:${model.badgeColor}22; color:${model.badgeColor};
        border:1px solid ${model.badgeColor}44; white-space:nowrap;
      ">${model.badge}</span>
      <span style="flex:1; font-size:0.9rem; color:${isSelected ? 'var(--text-main)' : 'var(--text-dim)'};">${model.label}</span>
      ${isSelected ? `<span style="font-size:10px;color:${model.badgeColor};font-weight:700;">● Active</span>` : ''}
    `
    card.addEventListener('click', () => {
      localStorage.setItem(MODEL_STORAGE_KEY, model.id)
      renderModelSelector(list, badge) // re-render
      showToast(`AI model switched to ${model.label}`)
    })
    // Hover effect
    card.addEventListener('mouseenter', () => { if (!isSelected) card.style.borderColor = model.badgeColor + '66' })
    card.addEventListener('mouseleave', () => { if (!isSelected) card.style.borderColor = 'var(--border)' })
    list.appendChild(card)
  })

  // Update top badge
  const active = availableModels.find(m => m.id === current) || availableModels[0]
  if (badge && active) {
    badge.textContent = active.badge
    badge.style.color = active.badgeColor
    badge.style.background = active.badgeColor + '22'
    badge.style.borderColor = active.badgeColor + '44'
  }
}

