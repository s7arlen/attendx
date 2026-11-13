import urllib.request, urllib.error, json, time

BASE = 'https://attendx-22sk.onrender.com/api'

def req(method, path, body=None, token=None):
    url = BASE + path
    data = json.dumps(body).encode() if body else None
    headers = {'Content-Type': 'application/json'}
    if token: headers['Authorization'] = 'Bearer ' + token
    r = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        res = urllib.request.urlopen(r, timeout=20)
        return json.loads(res.read()), None
    except urllib.error.HTTPError as e:
        try: err = json.loads(e.read())
        except: err = {'message': str(e.code)}
        return None, err

print('=== ADMIN + TEACHER TESTS ===')

# Admin login
res, err = req('POST', '/auth/login', {'email':'admin@attendx.com','password':'Admin@123'})
if not res: print('FAIL admin login: ' + str(err)); exit()
at = res['data']['accessToken']
print('✅ Admin login OK — ' + res['data']['user']['name'])

time.sleep(1)

# Dashboard
res, err = req('GET', '/admin/dashboard', token=at)
if res:
    d = res['data']
    print('✅ Dashboard — Students:' + str(d.get('totalStudents')) + ' Teachers:' + str(d.get('totalTeachers')) + ' Subjects:' + str(d.get('totalSubjects')))
else:
    print('❌ Dashboard failed: ' + str(err))

time.sleep(1)

# Teacher logins
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

nagesh_token = None
nagesh_subject_id = None

print('\n--- Teacher Logins ---')
for name, email in teachers:
    res, err = req('POST', '/auth/login', {'email': email, 'password': 'Teacher@123'})
    if res and res.get('success'):
        tok = res['data']['accessToken']
        # get subjects
        sres, serr = req('GET', '/teacher/subjects', token=tok)
        subs = sres['data'].get('subjects', []) if sres else []
        sub_names = [s.get('subjectCode') for s in subs]
        print('✅ ' + name + ' — ' + str(len(subs)) + ' subject(s): ' + ', '.join(sub_names))
        if email == 'nagesh.hr@attendx.com':
            nagesh_token = tok
            if subs: nagesh_subject_id = subs[0].get('id') or str(subs[0].get('_id',''))
    else:
        print('❌ ' + name + ' login FAILED: ' + str(err))
    time.sleep(1.5)

# Save tokens for next script
with open('C:/Users/LENSTAR/Downloads/MY-PROJECTS/ATTENDEX/test_state.json', 'w') as f:
    json.dump({'nagesh_token': nagesh_token, 'nagesh_subject_id': nagesh_subject_id}, f)

print('\nTeacher test done. State saved.')
