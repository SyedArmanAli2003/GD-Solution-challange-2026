import { db, auth } from './insforge.js'

const historyList = document.getElementById('historyList')
const filterTabs = document.querySelectorAll('.filter-tab')
const statTotal = document.getElementById('statTotal')
const statPending = document.getElementById('statPending')
const statResolved = document.getElementById('statResolved')
let activeFilter = 'all'

async function ensureSession() {
  const { data } = await auth.getCurrentUser()
  if (!data?.user) {
    window.location.href = 'auth.html'
    throw new Error('Not authenticated')
  }
}

function timeAgo(date) {
  if (!date) return 'just now'
  const sec = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
  if (sec < 60) return `${sec}s ago`
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`
  return `${Math.floor(sec / 86400)}d ago`
}

function getSeverity(type) {
  switch (type) {
    case 'Medical': return { color: '#E53935', icon: '🏥' }
    case 'Disaster': return { color: '#F57C00', icon: '🌊' }
    case 'Conflict': return { color: '#FBC02D', icon: '⚔️' }
    case 'Resource': return { color: '#4CAF50', icon: '📦' }
    case 'Hospitality': return { color: '#757575', icon: '🏠' }
    default: return { color: '#A32D2D', icon: '🆘' }
  }
}

function listenToHistory() {
  db.from('incidents').select('*').order('created_at', { ascending: false }).then(({ data, error }) => {
    if (error) { historyList.innerHTML = '<p style="color:#ff6b6b;padding:2rem 0;">Error loading history.</p>'; return }
    historyList.innerHTML = ''
    let totalCount = 0, pendingCount = 0, resolvedCount = 0, renderCount = 0

    ;(data || []).forEach(inc => {
      totalCount++
      const status = inc.status || 'pending'
      if (status === 'resolved') resolvedCount++; else pendingCount++
      if (activeFilter !== 'all' && status !== activeFilter) return
      renderCount++

      const sev = getSeverity(inc.type)
      const timeStr = timeAgo(inc.created_at)
      const statusBadge = status === 'resolved'
        ? '<span class="status-badge status-resolved">Resolved</span>'
        : '<span class="status-badge status-pending">Pending</span>'

      const card = document.createElement('div')
      card.className = 'history-card'
      card.style.borderLeftColor = sev.color
      card.innerHTML = `
        <div class="hc-top">
          <div class="hc-title">${sev.icon} ${inc.type || 'Emergency'}</div>
          <div class="hc-time">${timeStr}</div>
        </div>
        <div class="hc-loc">📍 ${inc.location || 'Unknown location'}</div>
        <div>${statusBadge}</div>
        ${inc.triage_level ? `<div class="hc-ai">AI Triage Level: ${inc.triage_level}</div>` : ''}`
      historyList.appendChild(card)
    })

    statTotal.textContent = totalCount
    statPending.textContent = pendingCount
    statResolved.textContent = resolvedCount
    if (renderCount === 0) historyList.innerHTML = '<p style="color:var(--text-dim);padding:2rem 0;text-align:center;">No incidents reported yet.</p>'
  })
}

async function init() {
  try { await ensureSession(); listenToHistory(); setInterval(listenToHistory, 10000) }
  catch { historyList.innerHTML = '<p style="color:#ff6b6b;padding:2rem 0;">Unable to connect.</p>' }
}
init()

filterTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    filterTabs.forEach(t => t.classList.remove('active'))
    tab.classList.add('active')
    activeFilter = tab.dataset.status
    listenToHistory()
  })
})
