import urllib.request, json

BASE = 'https://attendx-22sk.onrender.com/api'

# Login
req = urllib.request.Request(
    BASE+'/auth/login',
    data=json.dumps({'email':'admin@attendx.com','password':'Admin@123'}).encode(),
    headers={'Content-Type':'application/json'}
)
token = json.loads(urllib.request.urlopen(req).read())['data']['accessToken']
headers = {'Content-Type':'application/json','Authorization':'Bearer '+token}

def post(url, body):
    r = urllib.request.Request(url, data=json.dumps(body).encode(), headers=headers)
    try:
        res = urllib.request.urlopen(r)
        return json.loads(res.read())
    except urllib.error.HTTPError as e:
        return json.loads(e.read())

# Create teachers
teachers = [
    {'name':'Ms. Raksha Salian',        'email':'raksha.salian@attendx.com',     'password':'Teacher@123','role':'teacher','department':'Computer Science','section':'A'},
    {'name':'Dr. Nagesh H R',           'email':'nagesh.hr@attendx.com',          'password':'Teacher@123','role':'teacher','department':'Computer Science','section':'A'},
    {'name':'Ms. Saritha M',            'email':'saritha.m@attendx.com',          'password':'Teacher@123','role':'teacher','department':'Computer Science','section':'A'},
    {'name':'Dr. Babitha Ganesh Kulal', 'email':'babitha.kulal@attendx.com',      'password':'Teacher@123','role':'teacher','department':'Computer Science','section':'A'},
    {'name':'Ms. Saritha Suvarna',      'email':'saritha.suvarna@attendx.com',    'password':'Teacher@123','role':'teacher','department':'Computer Science','section':'A'},
    {'name':'Ms. Bhavana D',            'email':'bhavana.d@attendx.com',          'password':'Teacher@123','role':'teacher','department':'Computer Science','section':'A'},
    {'name':'Ms. Aruna Kumari G K',     'email':'aruna.kumari@attendx.com',       'password':'Teacher@123','role':'teacher','department':'Computer Science','section':'A'},
    {'name':'Mr. Ajay S Shet',          'email':'ajay.shet@attendx.com',          'password':'Teacher@123','role':'teacher','department':'Computer Science','section':'A'},
    {'name':'Mr. Ravikumar D Kodasal',  'email':'ravikumar.kodasal@attendx.com',  'password':'Teacher@123','role':'teacher','department':'Computer Science','section':'A'},
    {'name':'Mr. Adithya M',            'email':'adithya.m@attendx.com',          'password':'Teacher@123','role':'teacher','department':'Computer Science','section':'A'},
]

teacher_ids = {}
for t in teachers:
    res = post(BASE+'/admin/teachers', t)
    if res.get('success'):
        data = res.get('data', {})
        tid = data.get('id') or data.get('_id','')
        teacher_ids[t['name']] = tid
        print('CREATED teacher: ' + t['name'] + ' -> ' + str(tid))
    else:
        # Teacher might already exist, try to fetch
        print('FAILED/EXISTS teacher: ' + t['name'] + ' -> ' + res.get('message',''))

# Fetch all teachers to get their IDs
print('\n--- Fetching all teachers to get IDs ---')
req2 = urllib.request.Request(BASE+'/admin/teachers', headers=headers)
all_teachers = json.loads(urllib.request.urlopen(req2).read())
teachers_list = all_teachers.get('data', {}).get('teachers', all_teachers.get('data', []))
if isinstance(teachers_list, dict):
    teachers_list = teachers_list.get('teachers', [])

name_to_id = {}
for t in teachers_list:
    name_to_id[t['name']] = t.get('id') or str(t.get('_id',''))
    print('  ' + t['name'] + ' -> ' + str(t.get('id') or t.get('_id','')))

print('\n--- Creating Subjects ---')

subjects = [
    {
        'subjectCode': '1BMCAS301',
        'subjectName': 'Probability, Distributions and Statistics',
        'credits': 4,
        'assignedTeacherName': 'Ms. Raksha Salian',
        'department': 'Computer Science',
        'section': 'A',
        'year': 3
    },
    {
        'subjectCode': '1BCSIP302',
        'subjectName': 'Object Oriented Programming with Java (OOPS)',
        'credits': 4,
        'assignedTeacherName': 'Dr. Nagesh H R',
        'department': 'Computer Science',
        'section': 'A',
        'year': 3
    },
    {
        'subjectCode': '1BCSPC303',
        'subjectName': 'Digital Design and Computer Organization (DDCO)',
        'credits': 4,
        'assignedTeacherName': 'Ms. Saritha M',
        'department': 'Computer Science',
        'section': 'A',
        'year': 3
    },
    {
        'subjectCode': '1BCSPC304',
        'subjectName': 'Operating Systems (OS)',
        'credits': 3,
        'assignedTeacherName': 'Dr. Babitha Ganesh Kulal',
        'department': 'Computer Science',
        'section': 'A',
        'year': 3
    },
    {
        'subjectCode': '1BCSPC305',
        'subjectName': 'Data Structures and Applications (DS)',
        'credits': 3,
        'assignedTeacherName': 'Ms. Saritha Suvarna',
        'department': 'Computer Science',
        'section': 'A',
        'year': 3
    },
    {
        'subjectCode': '1BCSPL306',
        'subjectName': 'Data Structures and Applications Laboratory (DS LAB)',
        'credits': 1,
        'assignedTeacherName': 'Ms. Saritha Suvarna',
        'department': 'Computer Science',
        'section': 'A',
        'year': 3
    },
    {
        'subjectCode': '1BCSAL307',
        'subjectName': 'Project Management (with Git)',
        'credits': 1,
        'assignedTeacherName': 'Ms. Bhavana D',
        'department': 'Computer Science',
        'section': 'A',
        'year': 3
    },
    {
        'subjectCode': '1BCSPJ308',
        'subjectName': 'Community Project (Project-Based Learning)',
        'credits': 1,
        'assignedTeacherName': 'Ms. Aruna Kumari G K',
        'department': 'Computer Science',
        'section': 'A',
        'year': 3
    },
    {
        'subjectCode': '1BSHMC391',
        'subjectName': 'National Service Scheme (NSS)',
        'credits': 0,
        'assignedTeacherName': 'Mr. Ajay S Shet',
        'department': 'Computer Science',
        'section': 'A',
        'year': 3
    },
    {
        'subjectCode': '1BSHMC392',
        'subjectName': 'Physical Education (PE) (Sports and Athletics)',
        'credits': 0,
        'assignedTeacherName': 'Mr. Ravikumar D Kodasal',
        'department': 'Computer Science',
        'section': 'A',
        'year': 3
    },
    {
        'subjectCode': '1BSHMC393',
        'subjectName': 'Yoga',
        'credits': 0,
        'assignedTeacherName': 'Ms. Aruna Kumari G K',
        'department': 'Computer Science',
        'section': 'A',
        'year': 3
    },
    {
        'subjectCode': '1BSHMC394',
        'subjectName': 'Music',
        'credits': 0,
        'assignedTeacherName': 'Mr. Adithya M',
        'department': 'Computer Science',
        'section': 'A',
        'year': 3
    },
]

for s in subjects:
    teacher_name = s.pop('assignedTeacherName')
    teacher_id = name_to_id.get(teacher_name, '')
    if not teacher_id:
        print('SKIPPED (no teacher ID): ' + s['subjectName'] + ' (' + teacher_name + ')')
        continue
    s['assignedTeacher'] = teacher_id
    res = post(BASE+'/admin/subjects', s)
    if res.get('success'):
        print('CREATED subject: ' + s['subjectCode'] + ' - ' + s['subjectName'])
    else:
        print('FAILED subject: ' + s['subjectCode'] + ' -> ' + res.get('message',''))

print('\nDone!')
