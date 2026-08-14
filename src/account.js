import { db, auth, supabase } from './supabase.js';

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

const toast = document.getElementById('toast');
function showToast(msg, isError = false) {
  if (!toast) return;
  toast.textContent = msg;
  toast.style.background = isError ? '#A32D2D' : '#0F6E56';
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
}

async function initAccount() {
  const { data, error } = await auth.getCurrentUser();
  const user = data?.user;

  if (!user) {
    window.location.href = 'auth.html';
    return;
  }

  // Load user profile from Supabase
  let profile = null;
  try {
    const { data: dbProfile } = await db.from('users').select('*').eq('id', user.id).single();
    profile = dbProfile;
  } catch (err) {
    console.warn('[Account] DB fetch note:', err.message);
  }

  const name = profile?.full_name || profile?.name || user.fullName || user.user_metadata?.full_name || user.email?.split('@')[0] || 'User';
  const email = user.email || profile?.email || '';
  const initials = name.trim().split(' ').filter(Boolean).map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U';

  // Populate Profile UI
  const accNameEl = document.getElementById('accName');
  const accEmailEl = document.getElementById('accEmail');
  const accAvatarEl = document.getElementById('accAvatar');
  const accSinceEl = document.getElementById('accSince');
  const accReportsEl = document.getElementById('accReports');

  if (accNameEl) accNameEl.textContent = name;
  if (accEmailEl) accEmailEl.textContent = email;
  if (accAvatarEl) accAvatarEl.textContent = initials;

  if (accSinceEl) {
    const createdDate = profile?.created_at ? new Date(profile.created_at) : (user.created_at ? new Date(user.created_at) : new Date());
    accSinceEl.textContent = createdDate.toLocaleDateString();
  }

  // Count incidents for this user
  try {
    const { count, error: countErr } = await db.from('incidents').select('*', { count: 'exact', head: true }).eq('reporter_id', user.id);
    if (accReportsEl) accReportsEl.textContent = count != null ? count : (profile?.total_reports || 0);
  } catch {
    if (accReportsEl) accReportsEl.textContent = profile?.total_reports || '0';
  }

  // Pre-fill form fields
  const editName = document.getElementById('editName');
  const editPhone = document.getElementById('editPhone');
  const editAddress = document.getElementById('editAddress');

  if (editName) editName.value = profile?.full_name || profile?.name || user.fullName || '';
  if (editPhone) editPhone.value = profile?.phone || user.phone || '';
  if (editAddress) editAddress.value = profile?.address || user.address || '';

  // Handle Edit Profile Form
  document.getElementById('editProfileForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('saveChangesBtn');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }

    const newName = (editName?.value || '').trim();
    const newPhone = (editPhone?.value || '').trim().replace(/[^\d+]/g, '');
    const newAddress = (editAddress?.value || '').trim();

    try {
      const updatedProfile = {
        id: user.id,
        email: user.email,
        full_name: newName,
        name: newName,
        phone: newPhone,
        address: newAddress,
        role: profile?.role || 'reporter'
      };

      const { error: upsertErr } = await db.from('users').upsert([updatedProfile]);
      if (upsertErr) throw upsertErr;

      // Update LocalStorage cache
      localStorage.setItem('resqnet_user_profile', JSON.stringify({ ...user, ...updatedProfile }));
      sessionStorage.setItem('userProfile', JSON.stringify({ ...user, ...updatedProfile }));

      // Update UI
      if (accNameEl) accNameEl.textContent = newName;
      if (accAvatarEl) accAvatarEl.textContent = newName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U';

      showToast('Profile updated!');
    } catch (err) {
      console.error('[Account] Save error:', err);
      showToast('Failed to update profile.', true);
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Save changes'; }
    }
  });

  // Handle Change Password Form
  const pwdError = document.getElementById('pwdError');
  document.getElementById('changePwdForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (pwdError) pwdError.style.display = 'none';
    const btn = document.getElementById('updatePasswordBtn');

    const newPwd = document.getElementById('newPwd')?.value;
    const confirmPwd = document.getElementById('confirmNewPwd')?.value;

    if (newPwd !== confirmPwd) {
      if (pwdError) {
        pwdError.textContent = 'New passwords do not match.';
        pwdError.style.display = 'block';
      }
      return;
    }

    if (btn) { btn.disabled = true; btn.textContent = 'Updating...'; }

    try {
      const { error: pwdErr } = await auth.updatePassword(newPwd);
      if (pwdErr) throw pwdErr;

      showToast('Password updated successfully!');
      document.getElementById('changePwdForm')?.reset();
    } catch (err) {
      console.error('[Account] Password update error:', err);
      if (pwdError) {
        pwdError.textContent = err.message || 'Failed to update password.';
        pwdError.style.display = 'block';
      }
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Update password'; }
    }
  });

  // Handle Sign Out / Delete Account
  document.getElementById('deleteAccountBtn')?.addEventListener('click', async () => {
    const confirmDelete = confirm('Are you sure you want to sign out of your account on this device?');
    if (confirmDelete) {
      await auth.signOut();
      window.location.href = 'index.html';
    }
  });
}

document.addEventListener('DOMContentLoaded', initAccount);
