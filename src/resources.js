import { db, auth } from './supabase.js'

function escapeHtml(str) { if (!str) return ''; return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;') }

const resList = document.getElementById('resList')
const addResBtn = document.getElementById('addResBtn')
const resModal = document.getElementById('resModal')
const cancelRes = document.getElementById('cancelRes')
const resForm = document.getElementById('resForm')
const submitRes = document.getElementById('submitRes')

async function ensureSession() {
  const { data } = await auth.getCurrentUser()
  if (!data?.user) {
    window.location.href = 'auth.html'
    throw new Error('Not authenticated')
  }
}

function listenToResources() {
  db.from('resources').select('*').order('created_at', { ascending: false }).then(({ data, error }) => {
    if (error) { resList.innerHTML = '<p style="color:#ff6b6b;padding:2rem 0;">Error loading resources.</p>'; return }
    resList.innerHTML = ''
    let count = 0
    ;(data || []).forEach(r => {
      count++
      const card = document.createElement('div')
      card.className = 'res-card'
      const rawNum = (r.contact || '').replace(/[^\d+]/g, '')
      card.innerHTML = `
        <div>
          <div class="res-title-row"><span class="res-name">${escapeHtml(r.name)}</span><span class="res-type">${escapeHtml(r.type)}</span></div>
          <div class="res-meta">📍 ${escapeHtml(r.address || '')}</div>
        </div>
        <a href="tel:${rawNum}" class="res-contact">📞 ${escapeHtml(r.contact)}</a>`
      resList.appendChild(card)
    })
    if (count === 0) resList.innerHTML = '<p style="color:var(--text-dim);padding:2rem 0;">No community resources added yet.</p>'
  })
}

async function init() {
  try { await ensureSession(); listenToResources(); setInterval(listenToResources, 10000) }
  catch { resList.innerHTML = '<p style="color:#ff6b6b;padding:2rem 0;">Unable to connect.</p>' }
}
init()

addResBtn?.addEventListener('click', () => { resModal.style.display = 'flex' })
cancelRes?.addEventListener('click', () => { resModal.style.display = 'none'; resForm.reset() })

resForm?.addEventListener('submit', async (e) => {
  e.preventDefault()
  submitRes.disabled = true; submitRes.textContent = 'Adding...'
  try {
    await ensureSession()
    const { error } = await db.from('resources').insert([{
      name: (document.getElementById('rName').value || '').trim().slice(0, 200),
      type: document.getElementById('rType').value,
      contact: (document.getElementById('rContact').value || '').trim().replace(/[^\d+]/g, '').slice(0, 20),
      address: (document.getElementById('rAddress').value || '').trim().slice(0, 300)
    }])
    if (error) throw error
    showToast('Resource added!')
    resModal.style.display = 'none'; resForm.reset()
  } catch { showToast('Failed to add resource.') }
  finally { submitRes.disabled = false; submitRes.textContent = 'Add Resource' }
})

function showToast(msg) {
  const t = document.getElementById('toast')
  if (!t) return
  t.textContent = msg; t.classList.add('show')
  setTimeout(() => t.classList.remove('show'), 3000)
}
