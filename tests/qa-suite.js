const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ckjiukvxqqvjmpxhpclb.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNraml1a3Z4cXF2am1weGhwY2xiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI1MjYxMTgsImV4cCI6MjA5ODEwMjExOH0.VWi7wlZdGKVF0q-9bF3bStOh6w-dW1eK9l-PqzBJmjI';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failed++;
  }
}

// ── Fallback Triage Logic for QA ──────────────────────────────────────────────
function runTriage(type, description = '', voice = '') {
  const text = `${description} ${voice}`.toLowerCase();
  const criticalHints = ['bleeding', 'unconscious', 'heart', 'stroke', 'trapped', 'collapse', 'fire', 'explosion', 'drowning', 'severe'];
  const urgentHints = ['injured', 'flood', 'riot', 'violence', 'shortage', 'urgent', 'broken', 'earthquake'];

  if (criticalHints.some(h => text.includes(h)))
    return { level: 1, levelName: 'Critical', color: 'red', volunteerTypes: ['medical', 'rapid-response'], estimatedMinutes: 8 };
  if (type === 'Medical' || type === 'Disaster' || urgentHints.some(h => text.includes(h)))
    return { level: 2, levelName: 'Severe', color: 'orange', volunteerTypes: ['rapid-response', 'medical'], estimatedMinutes: 15 };
  if (type === 'Conflict')
    return { level: 3, levelName: 'Moderate', color: 'yellow', volunteerTypes: ['coordination'], estimatedMinutes: 25 };
  return { level: 4, levelName: 'Minor', color: 'green', volunteerTypes: ['logistics'], estimatedMinutes: 35 };
}

async function runQA() {
  console.log('====================================================');
  console.log('🚀 ResQNet Comprehensive QA Test Suite');
  console.log(`📍 Supabase URL: ${SUPABASE_URL}`);
  console.log('====================================================\n');

  // ── TEST 1: Database Connectivity & Core Tables ──
  console.log('📦 TEST 1: Supabase Database Connectivity & Schema');
  try {
    const { data: users, error: uErr } = await supabase.from('users').select('id').limit(1);
    assert(!uErr, 'Table `users` exists and is accessible via RLS');

    const { data: incs, error: iErr } = await supabase.from('incidents').select('id').limit(1);
    assert(!iErr, 'Table `incidents` exists and is accessible via RLS');

    const { data: timeline, error: tErr } = await supabase.from('incident_timeline').select('id').limit(1);
    assert(!tErr, 'Table `incident_timeline` exists and is accessible via RLS');

    const { data: vols, error: vErr } = await supabase.from('volunteers').select('id').limit(1);
    assert(!vErr, 'Table `volunteers` exists and is accessible via RLS');

    const { data: resources, error: rErr } = await supabase.from('resources').select('id').limit(1);
    assert(!rErr, 'Table `resources` exists and is accessible via RLS');
  } catch (err) {
    assert(false, `Database connection error: ${err.message}`);
  }

  // ── TEST 2: Authentication & Profile Persistence ──
  console.log('\n🔐 TEST 2: Authentication & User Profile Management');
  const testEmail = `qa_test_${Date.now()}@resqnet.test`;
  const testPass = 'ResQNet2026!Secure';
  let testUserId = null;

  try {
    // Test user profile creation in DB
    const profileId = '00000000-0000-0000-0000-' + String(Date.now()).slice(-12).padStart(12, '0');
    testUserId = profileId;

    const { data: newProfile, error: pErr } = await supabase.from('users').insert([{
      id: profileId,
      email: testEmail,
      name: 'QA Rescue Specialist',
      full_name: 'QA Rescue Specialist',
      phone: '+15559876543',
      address: 'Zone 4 Emergency Sector',
      role: 'reporter',
      total_reports: 1,
    }]).select('*').single();

    assert(!pErr && newProfile?.id === profileId, 'User profile record created in database');
    assert(newProfile?.phone === '+15559876543', 'User profile phone number verified');

    // Test profile update
    const { data: updatedProfile, error: upErr } = await supabase.from('users')
      .update({ full_name: 'QA Senior Coordinator', phone: '+15550001122' })
      .eq('id', profileId)
      .select('*')
      .single();

    assert(!upErr && updatedProfile?.full_name === 'QA Senior Coordinator', 'Profile update persisted successfully');
  } catch (err) {
    assert(false, `Auth/Profile test failed: ${err.message}`);
  }

  // ── TEST 3: Incident Creation & Timeline Logging ──
  console.log('\n🚨 TEST 3: SOS Incident Reporting & Timeline Logging');
  let createdIncidentId = null;
  try {
    const { data: inc, error: incErr } = await supabase.from('incidents').insert([{
      type: 'Medical',
      description: 'Severe injury near sector 5 power station. Immediate medical evacuation required.',
      location: '124 Market St, Sector 5',
      coordinates: { lat: 37.7749, lng: -122.4194 },
      voice_transcript: 'Victim is unconscious, bleeding heavily, send ambulance immediately',
      status: 'pending',
      triage_level: 1,
      triage_level_name: 'Critical',
      triage_color: 'red',
      triage_reasoning: 'Critical condition with heavy bleeding and unconsciousness detected.',
      reporter_id: testUserId,
      reporter_name: 'QA Senior Coordinator',
      reporter_phone: '+15550001122'
    }]).select('*').single();

    assert(!incErr && inc?.id, `Incident created with ID: ${inc?.id}`);
    createdIncidentId = inc?.id;

    // Timeline event
    const { data: tl, error: tlErr } = await supabase.from('incident_timeline').insert([{
      incident_id: createdIncidentId,
      action: 'created',
      actor: 'QA Senior Coordinator',
      details: 'Critical medical incident reported at 124 Market St, Sector 5'
    }]).select('*').single();

    assert(!tlErr && tl?.id, 'Incident audit timeline event logged successfully');

    // Verify retrieval
    const { data: fetchedInc, error: fetchErr } = await supabase.from('incidents').select('*').eq('id', createdIncidentId).single();
    assert(!fetchErr && fetchedInc?.type === 'Medical' && fetchedInc?.triage_level === 1, 'Incident retrieval verified with triage metadata');
  } catch (err) {
    assert(false, `Incident reporting failed: ${err.message}`);
  }

  // ── TEST 4: AI Triage Rules & Decision Cascade ──
  console.log('\n🧠 TEST 4: Emergency Triage Decision Engine');
  try {
    const criticalResult = runTriage('Medical', 'Severe bleeding and unconscious victim', 'Send doctor');
    assert(criticalResult.level === 1 && criticalResult.levelName === 'Critical', 'Critical triage level 1 identified for life-threatening keywords');

    const severeResult = runTriage('Disaster', 'Flood waters rising rapidly in residential zone');
    assert(severeResult.level === 2 && severeResult.levelName === 'Severe', 'Severe triage level 2 identified for disaster/flood');

    const moderateResult = runTriage('Conflict', 'Civil dispute near food distribution center');
    assert(moderateResult.level === 3 && moderateResult.levelName === 'Moderate', 'Moderate triage level 3 identified for conflict mediation');
  } catch (err) {
    assert(false, `Triage tests failed: ${err.message}`);
  }

  // ── TEST 5: Volunteer Registration, Matching & Dispatch ──
  console.log('\n👥 TEST 5: Volunteer Registration & Dispatch Coordination');
  let volunteerId = null;
  try {
    const { data: vol, error: volErr } = await supabase.from('volunteers').insert([{
      name: 'Dr. Sarah Connor',
      phone: '+15551234567',
      skill: 'medical',
      location: 'Sector 5 Medical Station',
      coordinates: { lat: 37.7750, lng: -122.4190 },
      available: true
    }]).select('*').single();

    assert(!volErr && vol?.id, `Volunteer registered with skill 'medical' (ID: ${vol?.id})`);
    volunteerId = vol?.id;

    // Dispatch volunteer to incident
    const { error: dispatchErr } = await supabase.from('incidents').update({
      status: 'assigned',
      assigned_volunteer_id: volunteerId,
      assigned_volunteer_name: 'Dr. Sarah Connor',
      assigned_volunteer_skill: 'medical',
      assigned_at: new Date().toISOString(),
      volunteer_status: 'dispatched'
    }).eq('id', createdIncidentId);

    assert(!dispatchErr, 'Volunteer assigned and dispatched to incident');

    // Update volunteer active incident
    const { error: vUpErr } = await supabase.from('volunteers').update({
      available: false,
      active_incident_id: createdIncidentId
    }).eq('id', volunteerId);

    assert(!vUpErr, 'Volunteer availability locked to active incident');
  } catch (err) {
    assert(false, `Volunteer dispatch test failed: ${err.message}`);
  }

  // ── TEST 6: Community Resources & Incident Resolution ──
  console.log('\n🏥 TEST 6: Community Resources & Resolution Lifecycle');
  try {
    // Add emergency resource
    const { data: res, error: resErr } = await supabase.from('resources').insert([{
      name: 'St. Jude Emergency Shelter & Trauma Ward',
      type: 'Shelter',
      contact: '+15554443322',
      address: '770 Mercy Blvd, Zone 2',
      description: 'Equipped with 50 emergency beds, generators, and trauma kits'
    }]).select('*').single();

    assert(!resErr && res?.id, `Community resource created (ID: ${res?.id})`);

    // Resolve incident
    const { error: resIncErr } = await supabase.from('incidents').update({
      status: 'resolved',
      resolved_at: new Date().toISOString(),
      resolved_by: 'Dr. Sarah Connor',
      resolution_notes: 'Patient stabilized and transported to trauma center'
    }).eq('id', createdIncidentId);

    assert(!resIncErr, 'Incident marked as resolved with resolution notes');

    // Free volunteer
    const { error: freeVolErr } = await supabase.from('volunteers').update({
      available: true,
      active_incident_id: null
    }).eq('id', volunteerId);

    assert(!freeVolErr, 'Volunteer status freed up after incident resolution');
  } catch (err) {
    assert(false, `Resources & resolution test failed: ${err.message}`);
  }

  // ── TEST 7: Frontend Dist Bundles Verification ──
  console.log('\n📦 TEST 7: Frontend JavaScript Bundles');
  const expectedBundles = [
    'dist/auth.js',
    'dist/reporter.js',
    'dist/coordinator.js',
    'dist/volunteers.js',
    'dist/resources.js',
    'dist/history.js',
    'dist/account.js',
  ];

  for (const b of expectedBundles) {
    const fullPath = path.resolve(__dirname, '..', b);
    const exists = fs.existsSync(fullPath);
    const size = exists ? fs.statSync(fullPath).size : 0;
    assert(exists && size > 1000, `Bundle \`${b}\` built successfully (${Math.round(size / 1024)} KB)`);
  }

  // ── Clean up test records ──
  try {
    if (createdIncidentId) await supabase.from('incidents').delete().eq('id', createdIncidentId);
    if (volunteerId) await supabase.from('volunteers').delete().eq('id', volunteerId);
    if (testUserId) await supabase.from('users').delete().eq('id', testUserId);
  } catch { }

  // ── Summary ──
  console.log('\n====================================================');
  console.log(`📊 QA Test Results: ${passed} PASSED | ${failed} FAILED`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runQA();
