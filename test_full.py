import urllib.request, urllib.error, json, time

BASE = 'https://attendx-22sk.onrender.com/api'
results = []

def log(status, test, detail=''):
    icon = '✅' if status == 'PASS' else '❌'
    print(f"{icon} [{status}] {test}" + (f"\n       {detail}" if detail else ''))
    results.append((status, test, detail))

def req(method, path, body=None, token=None):
    url = BASE + path
    data = json.dumps(body).encode() if body else None
    headers = {'Content-Type': 'application/json'}
    if token: headers['Authorization'] = 'Bearer ' + token
    r = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        res = urllib.request.urlopen(r, timeout=30)
        return json.loads(res.read()), None
    except urllib.error.HTTPError as e:
        try: err = json.loads(e.read())
        except: err = {'message': str(e.code)}
        return None, (e.code, err)

print("=" * 60)
print("  ATTENDX 2.0 — FULL SYSTEM TEST")
print("=" * 60)

# ── 1. HEALTH ─────────────────────────────────────────────────
print("\n[ 1 ] HEALTH & CONNECTIVITY")
try:
    r = urllib.request.urlopen('https://attendx-22sk.onrender.com/health', timeout=15)
    d = json.loads(r.read())
    log('PASS', 'Backend health', d.get('service'))
except Exception as e:
    log('FAIL', 'Backend health', str(e))

try:
    urllib.request.urlopen('https://attendxxxx.vercel.app', timeout=15)
    log('PASS', 'Frontend reachable')
except Exception as e:
    log('FAIL', 'Frontend reachable', str(e))

# ── 2. AUTH ───────────────────────────────────────────────────
print("\n[ 2 ] AUTHENTICATION")
time.sleep(1)
res, err = req('POST', '/auth/login', {'email':'admin@attendx.com','password':'Admin@123'})
if res and res.get('success'):
    admin_token = res['data']['accessToken']
    log('PASS', 'Admin login', res['data']['user']['name'])
else:
    log('FAIL', 'Admin login', str(err)); admin_token = None

time.sleep(1)
res, err = req('POST', '/auth/login', {'email':'nagesh.hr@attendx.com','password':'Teacher@123'})
if res and res.get('success'):
    teacher_token = res['data']['accessToken']
    log('PASS', 'Teacher login', res['data']['user']['name'])
else:
    log('FAIL', 'Teacher login', str(err)); teacher_token = None

time.sleep(1)
res, err = req('POST', '/auth/login', {'email':'lenstar.monteiro@attendx.com','password':'Student@123'})
if res and res.get('success'):
    student_token = res['data']['accessToken']
    student_id = res['data']['user']['id']
    log('PASS', 'Student login', res['data']['user']['name'])
else:
    log('FAIL', 'Student login', str(err)); student_token = None; student_id = None

# ── 3. ADMIN DASHBOARD ────────────────────────────────────────
print("\n[ 3 ] ADMIN DASHBOARD")
if admin_token:
    res, err = req('GET', '/admin/dashboard', token=admin_token)
    if res and res.get('success'):
        d = res['data']
        log('PASS', 'Admin dashboard', f"Students={d.get('totalStudents')} Teachers={d.get('totalTeachers')} Subjects={d.get('totalSubjects')}")
    else:
        log('FAIL', 'Admin dashboard', str(err))

    res, err = req('GET', '/admin/students', token=admin_token)
    if res and res.get('success'):
        count = res['data'].get('total', 0)
        log('PASS', 'Admin students list', f"{count} students")
    else:
        log('FAIL', 'Admin students list', str(err))

# ── 4. ACADEMIC — ASSESSMENTS ─────────────────────────────────
print("\n[ 4 ] ACADEMIC — ASSESSMENTS")
assessment_id = None
subject_id = None

if teacher_token:
    # Get subjects first
    res, err = req('GET', '/teacher/subjects', token=teacher_token)
    if res and res.get('success'):
        subs = res['data'].get('subjects', [])
        if subs:
            subject_id = subs[0].get('_id') or subs[0].get('id')
            log('PASS', 'Teacher subjects', f"{len(subs)} subjects, using {subs[0].get('subjectCode')}")
        else:
            log('FAIL', 'Teacher subjects', 'No subjects found')
    else:
        log('FAIL', 'Teacher subjects', str(err))

    # Create assessment
    if subject_id:
        res, err = req('POST', '/academic/assessments', {
            'title': 'Test — Internal Exam 1',
            'type': 'internal_exam',
            'subjectId': subject_id,
            'maxMarks': 50,
            'assessmentDate': '2026-11-15'
        }, token=teacher_token)
        if res and res.get('success'):
            assessment_id = res['data']['assessment'].get('_id')
            log('PASS', 'Create assessment', f"ID: {assessment_id}")
        else:
            log('FAIL', 'Create assessment', str(err))

    # Get assessments
    res, err = req('GET', '/academic/assessments', token=teacher_token)
    if res and res.get('success'):
        count = len(res['data'].get('assessments', []))
        log('PASS', 'Get assessments', f"{count} assessments")
    else:
        log('FAIL', 'Get assessments', str(err))

# ── 5. MARKS ENTRY ────────────────────────────────────────────
print("\n[ 5 ] MARKS ENTRY")
if teacher_token and assessment_id and student_id:
    res, err = req('POST', '/academic/marks', {
        'assessmentId': assessment_id,
        'results': [
            {'studentId': student_id, 'marksObtained': 28, 'isAbsent': False},
        ]
    }, token=teacher_token)
    if res and res.get('success'):
        log('PASS', 'Enter marks', f"{res['data'].get('saved')} saved")
    else:
        log('FAIL', 'Enter marks', str(err))

    # Publish assessment
    if assessment_id:
        res, err = req('PATCH', f'/academic/assessments/{assessment_id}/publish', token=teacher_token)
        if res and res.get('success'):
            log('PASS', 'Publish assessment')
        else:
            log('FAIL', 'Publish assessment', str(err))

    # Get results
    if assessment_id:
        res, err = req('GET', f'/academic/marks/{assessment_id}', token=teacher_token)
        if res and res.get('success'):
            stats = res['data'].get('stats', {})
            log('PASS', 'Get assessment results', f"Total={stats.get('total')} Avg={stats.get('average')}")
        else:
            log('FAIL', 'Get assessment results', str(err))

# ── 6. RISK ASSESSMENT ────────────────────────────────────────
print("\n[ 6 ] RISK ASSESSMENT ENGINE")
if admin_token and student_id:
    # Trigger risk for student
    res, err = req('POST', f'/academic/risk/{student_id}/trigger', token=admin_token)
    if res and res.get('success'):
        risk = res['data'].get('assessment', {})
        log('PASS', 'Trigger risk assessment', f"Level={risk.get('riskLevel')} Score={risk.get('riskScore')} Method={risk.get('assessmentMethod')}")
    else:
        log('FAIL', 'Trigger risk assessment', str(err))

if teacher_token:
    # Risk dashboard
    res, err = req('GET', '/academic/risk/dashboard', token=teacher_token)
    if res and res.get('success'):
        summary = res['data'].get('summary', {})
        log('PASS', 'Risk dashboard', f"Total={summary.get('total')} High={summary.get('high')} Moderate={summary.get('moderate')} Low={summary.get('low')}")
    else:
        log('FAIL', 'Risk dashboard', str(err))

if student_token:
    # Student view own risk
    res, err = req('GET', '/academic/risk/me', token=student_token)
    if res and res.get('success'):
        latest = res['data'].get('latest')
        if latest:
            log('PASS', 'Student view own risk', f"Level={latest.get('riskLevel')} Factors={len(latest.get('contributingFactors',[]))}")
        else:
            log('PASS', 'Student view own risk', 'No assessment yet (expected if no data)')
    else:
        log('FAIL', 'Student view own risk', str(err))

# ── 7. ACADEMIC PROFILE ───────────────────────────────────────
print("\n[ 7 ] ACADEMIC PROFILE")
if student_token:
    res, err = req('GET', '/academic/profile/me', token=student_token)
    if res and res.get('success'):
        d = res['data']
        log('PASS', 'Student academic profile', f"Subjects={d.get('subjects')} Attendance={d.get('overallAttendance')}%")
    else:
        log('FAIL', 'Student academic profile', str(err))

if teacher_token and student_id:
    res, err = req('GET', f'/academic/profile/{student_id}', token=teacher_token)
    if res and res.get('success'):
        d = res['data']
        log('PASS', 'Teacher view student profile', f"Student={d.get('student',{}).get('name')}")
    else:
        log('FAIL', 'Teacher view student profile', str(err))

# ── 8. INTERVENTIONS ──────────────────────────────────────────
print("\n[ 8 ] INTERVENTIONS")
intervention_id = None
if teacher_token and student_id:
    res, err = req('POST', '/academic/interventions', {
        'studentId': student_id,
        'type': 'mentoring',
        'description': 'Weekly mentoring session for academic improvement',
        'scheduledDate': '2026-11-20'
    }, token=teacher_token)
    if res and res.get('success'):
        intervention_id = res['data']['intervention'].get('_id')
        log('PASS', 'Create intervention', f"ID: {intervention_id}")
    else:
        log('FAIL', 'Create intervention', str(err))

    res, err = req('GET', '/academic/interventions', token=teacher_token)
    if res and res.get('success'):
        count = len(res['data'].get('interventions', []))
        log('PASS', 'Get interventions', f"{count} interventions")
    else:
        log('FAIL', 'Get interventions', str(err))

    if intervention_id:
        res, err = req('PUT', f'/academic/interventions/{intervention_id}', {
            'status': 'scheduled',
            'notes': 'Student confirmed attendance'
        }, token=teacher_token)
        if res and res.get('success'):
            log('PASS', 'Update intervention status', res['data']['intervention'].get('status'))
        else:
            log('FAIL', 'Update intervention', str(err))

# ── 9. SECURITY — ROLE ISOLATION ─────────────────────────────
print("\n[ 9 ] SECURITY — ROLE ISOLATION")
if student_token and student_id:
    # Student cannot access another student's profile
    other_student = '000000000000000000000001'
    res, err = req('GET', f'/academic/profile/{other_student}', token=student_token)
    if err and err[0] == 403:
        log('PASS', 'Student blocked from other student profile', '403 Forbidden')
    else:
        log('FAIL', 'Student role isolation', f"Expected 403, got: {err}")

    # Student cannot access risk dashboard
    res, err = req('GET', '/academic/risk/dashboard', token=student_token)
    if err and err[0] == 403:
        log('PASS', 'Student blocked from risk dashboard', '403 Forbidden')
    else:
        log('FAIL', 'Student risk dashboard isolation', f"Expected 403, got: {err}")

    # Student cannot create assessment
    res, err = req('POST', '/academic/assessments', {'title':'hack','type':'quiz','subjectId':'x','maxMarks':10,'assessmentDate':'2026-01-01'}, token=student_token)
    if err and err[0] == 403:
        log('PASS', 'Student blocked from creating assessments', '403 Forbidden')
    else:
        log('FAIL', 'Student assessment isolation', f"Expected 403, got: {err}")

# ── 10. EXISTING FEATURES STILL WORK ─────────────────────────
print("\n[ 10 ] EXISTING FEATURES INTACT")
if teacher_token:
    res, err = req('GET', '/teacher/subjects', token=teacher_token)
    log('PASS' if res and res.get('success') else 'FAIL', 'QR attendance subjects', str(len(res['data'].get('subjects',[]))) + ' subjects' if res else str(err))

if student_token:
    res, err = req('GET', '/student/subjects', token=student_token)
    log('PASS' if res and res.get('success') else 'FAIL', 'Student subjects (auto-match)', str(len(res['data'].get('subjects',[]))) + '/12 subjects' if res else str(err))

if admin_token:
    res, err = req('GET', '/admin/subjects', token=admin_token)
    log('PASS' if res and res.get('success') else 'FAIL', 'Admin subjects list', str(len(res['data'].get('subjects',[]))) + ' subjects' if res else str(err))

# ── SUMMARY ───────────────────────────────────────────────────
print("\n" + "=" * 60)
print("  TEST SUMMARY")
print("=" * 60)
passed = sum(1 for r in results if r[0] == 'PASS')
failed = [r for r in results if r[0] == 'FAIL']
print(f"  Total:  {len(results)}")
print(f"  Passed: {passed}")
print(f"  Failed: {len(failed)}")
if failed:
    print("\n  FAILURES:")
    for r in failed:
        print(f"  ❌ {r[1]}: {r[2]}")
else:
    print("\n  🎉 ALL TESTS PASSED!")
print("=" * 60)
