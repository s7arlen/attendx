import urllib.request, urllib.error, json, time

BASE = 'https://attendx-22sk.onrender.com/api'
FRONTEND = 'https://attendxxxx.vercel.app'

results = []

def log(status, test, detail=''):
    icon = '✅' if status == 'PASS' else '❌'
    msg = f"{icon} [{status}] {test}"
    if detail:
        msg += f"\n       {detail}"
    print(msg)
    results.append((status, test, detail))

def request(method, path, body=None, token=None, retries=2):
    url = BASE + path
    data = json.dumps(body).encode() if body else None
    headers = {'Content-Type': 'application/json'}
    if token:
        headers['Authorization'] = 'Bearer ' + token
    for attempt in range(retries + 1):
        req = urllib.request.Request(url, data=data, headers=headers, method=method)
        try:
            res = urllib.request.urlopen(req, timeout=30)
            return json.loads(res.read()), None
        except urllib.error.HTTPError as e:
            if e.code == 429 and attempt < retries:
                print(f"       ⏳ Rate limited, waiting 65s...")
                time.sleep(65)
                continue
            try:
                err = json.loads(e.read())
            except:
                err = {'message': str(e)}
            return None, (e.code, err)
        except Exception as e:
            return None, (0, {'message': str(e)})
    return None, (429, {'message': 'Rate limit exceeded after retries'})

def login(email, password):
    res, err = request('POST', '/auth/login', {'email': email, 'password': password})
    if res and res.get('success'):
        return res['data']['accessToken'], res['data']['user']
    return None, None

print("=" * 60)
print("  ATTENDX FULL SYSTEM TEST")
print("=" * 60)

# ─────────────────────────────────────────────
print("\n[ 1 ] FRONTEND REACHABILITY")
# ─────────────────────────────────────────────
try:
    req = urllib.request.Request(FRONTEND + '/login')
    urllib.request.urlopen(req, timeout=15)
    log('PASS', 'Frontend reachable', FRONTEND)
except Exception as e:
    log('FAIL', 'Frontend reachable', str(e))

# ─────────────────────────────────────────────
print("\n[ 2 ] BACKEND HEALTH")
# ─────────────────────────────────────────────
try:
    req = urllib.request.Request('https://attendx-22sk.onrender.com/health')
    r = json.loads(urllib.request.urlopen(req, timeout=15).read())
    if r.get('status') == 'OK':
        log('PASS', 'Backend health check', r.get('service'))
    else:
        log('FAIL', 'Backend health check', str(r))
except Exception as e:
    log('FAIL', 'Backend health check', str(e))

# ─────────────────────────────────────────────
print("\n[ 3 ] ADMIN LOGIN")
# ─────────────────────────────────────────────
admin_token, admin_user = login('admin@attendx.com', 'Admin@123')
if admin_token:
    log('PASS', 'Admin login', f"Name: {admin_user['name']} | Role: {admin_user['role']}")
else:
    log('FAIL', 'Admin login')

# ─────────────────────────────────────────────
print("\n[ 4 ] ADMIN — DASHBOARD & DATA")
# ─────────────────────────────────────────────
if admin_token:
    res, err = request('GET', '/admin/dashboard', token=admin_token)
    if res and res.get('success'):
        d = res['data']
        log('PASS', 'Admin dashboard', f"Students={d.get('totalStudents')} Teachers={d.get('totalTeachers')} Subjects={d.get('totalSubjects')}")
    else:
        log('FAIL', 'Admin dashboard', str(err))

    res, err = request('GET', '/admin/subjects', token=admin_token)
    if res and res.get('success'):
        subs = res['data'].get('subjects', res['data'])
        if isinstance(subs, dict): subs = subs.get('subjects', [])
        log('PASS', 'Admin fetch subjects', f"{len(subs)} subjects found")
    else:
        log('FAIL', 'Admin fetch subjects', str(err))

    res, err = request('GET', '/admin/teachers', token=admin_token)
    if res and res.get('success'):
        tlist = res['data'].get('teachers', res['data'])
        if isinstance(tlist, dict): tlist = tlist.get('teachers', [])
        log('PASS', 'Admin fetch teachers', f"{len(tlist)} teachers found")
    else:
        log('FAIL', 'Admin fetch teachers', str(err))

    res, err = request('GET', '/admin/students', token=admin_token)
    if res and res.get('success'):
        slist = res['data'].get('students', res['data'])
        if isinstance(slist, dict): slist = slist.get('students', [])
        log('PASS', 'Admin fetch students', f"{len(slist)} students found")
    else:
        log('FAIL', 'Admin fetch students', str(err))

time.sleep(2)

# ─────────────────────────────────────────────
print("\n[ 5 ] ALL TEACHER LOGINS + SUBJECT CHECK")
# ─────────────────────────────────────────────
teachers = [
    ('Ms. Raksha Salian',        'raksha.salian@attendx.com'),
    ('Dr. Nagesh H R',           'nagesh.hr@attendx.com'),
    ('Ms. Saritha M',            'saritha.m@attendx.com'),
    ('Dr. Babitha Ganesh Kulal', 'babitha.kulal@attendx.com'),
    ('Ms. Saritha Suvarna',      'saritha.suvarna@attendx.com'),
    ('Ms. Bhavana D',            'bhavana.d@attendx.com'),
    ('Ms. Aruna Kumari G K',     'aruna.kumari@attendx.com'),
    ('Mr. Ajay S Shet',          'ajay.shet@attendx.com'),
    ('Mr. Ravikumar D Kodasal',  'ravikumar.kodasal@attendx.com'),
    ('Mr. Adithya M',            'adithya.m@attendx.com'),
]

teacher_tokens = {}
for name, email in teachers:
    tok, user = login(email, 'Teacher@123')
    if tok:
        teacher_tokens[email] = tok
        res, err = request('GET', '/teacher/subjects', token=tok)
        if res and res.get('success'):
            subs = res['data'].get('subjects', [])
            log('PASS', f'Teacher login + subjects: {name}', f"{len(subs)} subject(s)")
        else:
            log('FAIL', f'Teacher subjects: {name}', str(err))
    else:
        log('FAIL', f'Teacher login: {name}', 'Login failed')
    time.sleep(1)

# ─────────────────────────────────────────────
print("\n[ 6 ] ATTENDANCE SESSION — CREATE, MARK, END")
# ─────────────────────────────────────────────
nagesh_token = teacher_tokens.get('nagesh.hr@attendx.com')
session_id = None
password_code = None
subject_id = None

if nagesh_token:
    # Get subject ID for OOPS
    res, err = request('GET', '/teacher/subjects', token=nagesh_token)
    if res and res.get('success'):
        subs = res['data'].get('subjects', [])
        oops = next((s for s in subs if s.get('subjectCode') == '1BCSIP302'), None)
        if oops:
            subject_id = oops.get('id') or str(oops.get('_id',''))
            log('PASS', 'Found OOPS subject for test', subject_id)

    if subject_id:
        # Start session — correct endpoint: POST /attendance/start-session
        res, err = request('POST', '/attendance/start-session', {
            'subjectId': subject_id,
            'duration': 10
        }, token=nagesh_token)
        if res and res.get('success'):
            sess = res['data'].get('session', {})
            session_id = sess.get('id') or str(sess.get('_id',''))
            password_code = sess.get('passwordCode','')
            session_code = sess.get('sessionCode','')
            log('PASS', 'Create attendance session', f"ID: {session_id} | Code: {password_code} | SessionCode: {session_code}")
        else:
            log('FAIL', 'Create attendance session', str(err))

time.sleep(2)

# ─────────────────────────────────────────────
print("\n[ 7 ] ALL STUDENT LOGINS + SUBJECT CHECK")
# ─────────────────────────────────────────────
students = [
    ('Lakshmana Marati',            'lakshmana.marati@attendx.com'),
    ('Lalita Bhadrayya Devadig',    'lalita.devadig@attendx.com'),
    ('Lenstar Monteiro',            'lenstar.monteiro@attendx.com'),
    ('Lohit Gopal Naik',            'lohit.naik@attendx.com'),
    ('M K Nishitha',                'mk.nishitha@attendx.com'),
    ('M Manjunath',                 'm.manjunath@attendx.com'),
    ('Mahadesh',                    'mahadesh@attendx.com'),
    ('Mahammad Hasim M',            'mahammad.hasim@attendx.com'),
    ('Malini',                      'malini@attendx.com'),
    ('Manasi Rajesh Naik',          'manasi.naik@attendx.com'),
    ('Mandla Narasimha Charan Tej', 'mandla.tej@attendx.com'),
]

student_tokens = {}
for name, email in students:
    tok, user = login(email, 'Student@123')
    if tok:
        student_tokens[email] = tok
        res, err = request('GET', '/student/subjects', token=tok)
        if res and res.get('success'):
            subs = res['data'].get('subjects', [])
            log('PASS', f'Student login + subjects: {name}', f"{len(subs)}/12 subjects visible")
        else:
            log('FAIL', f'Student subjects: {name}', str(err))
    else:
        log('FAIL', f'Student login: {name}', 'Login failed')
    time.sleep(1)

# ─────────────────────────────────────────────
print("\n[ 8 ] MARK ATTENDANCE FOR 5 STUDENTS")
# ─────────────────────────────────────────────
if session_id and password_code:
    marked = 0
    failed_mark = 0
    for name, email in students[:5]:
        tok = student_tokens.get(email)
        if tok:
            res, err = request('POST', '/attendance/verify', {
                'sessionId': session_id,
                'subjectId': subject_id,
                'secureToken': password_code,
                'passwordCode': password_code,
            }, token=tok)
            if res and res.get('success'):
                marked += 1
                log('PASS', f'Mark attendance: {name}')
            else:
                failed_mark += 1
                msg = err[1].get('message','') if err else ''
                log('FAIL', f'Mark attendance: {name}', msg)
        time.sleep(0.8)
    log('PASS' if marked > 0 else 'FAIL', f'Attendance marking summary', f"{marked}/5 marked successfully")
else:
    log('FAIL', 'Mark attendance', 'No active session or password code available')

# ─────────────────────────────────────────────
print("\n[ 9 ] END SESSION + CHECK REPORT")
# ─────────────────────────────────────────────
if session_id and nagesh_token:
    # End session: POST /attendance/end-session/:sessionId
    res, err = request('POST', '/attendance/end-session/' + session_id, token=nagesh_token)
    if res and res.get('success'):
        log('PASS', 'End attendance session')
    else:
        log('FAIL', 'End attendance session', str(err))

    time.sleep(1)
    # Check teacher session report
    res, err = request('GET', '/teacher/sessions/' + session_id + '/report', token=nagesh_token)
    if res and res.get('success'):
        records = res['data'].get('records', [])
        log('PASS', 'Session report', f"{len(records)} students present")
    else:
        log('FAIL', 'Session report', str(err))

# ─────────────────────────────────────────────
print("\n[ 10 ] STUDENT ATTENDANCE HISTORY")
# ─────────────────────────────────────────────
first_tok = student_tokens.get('lakshmana.marati@attendx.com')
if first_tok:
    res, err = request('GET', '/student/attendance', token=first_tok)
    if res and res.get('success'):
        total = res['data'].get('totalPresent', 0)
        log('PASS', 'Student attendance history', f"Total sessions present: {total}")
    else:
        log('FAIL', 'Student attendance history', str(err))

    res, err = request('GET', '/student/dashboard', token=first_tok)
    if res and res.get('success'):
        d = res['data']
        log('PASS', 'Student dashboard', f"Subjects={d.get('totalSubjects')} Present={d.get('totalPresent')} Percentage={d.get('attendancePercentage')}%")
    else:
        log('FAIL', 'Student dashboard', str(err))

# ─────────────────────────────────────────────
print("\n" + "=" * 60)
print("  TEST SUMMARY")
print("=" * 60)
passed = sum(1 for r in results if r[0] == 'PASS')
failed_list = [r for r in results if r[0] == 'FAIL']
print(f"  Total : {len(results)}")
print(f"  Passed: {passed}")
print(f"  Failed: {len(failed_list)}")
if failed_list:
    print("\n  FAILURES:")
    for r in failed_list:
        print(f"  ❌ {r[1]}: {r[2]}")
else:
    print("\n  🎉 ALL TESTS PASSED!")
print("=" * 60)
