// Step 1 of the evidence run: documented bootstrap (self-register, promote to Admin in the DB),
// then Admin-created Doctor/Staff accounts and a second Patient. Prints no secrets.
const { call, injectOtp, login, db, mongoose } = require('./lib');

const people = {
  admin: { firstName: 'Ada', lastName: 'Evidence-Admin', email: 'evidence.admin@example.test' },
  doctor: { firstName: 'Ben', lastName: 'Santos', email: 'evidence.doctor@example.test', role: 'Doctor', consultationDuration: 30 },
  doctor2: { firstName: 'Carla', lastName: 'Lim', email: 'evidence.doctor2@example.test', role: 'Doctor', consultationDuration: 30 },
  staff: { firstName: 'Sam', lastName: 'Reception', email: 'evidence.staff@example.test', role: 'Staff' },
  patient2: { firstName: 'Quinn', lastName: 'Other-Patient', email: 'evidence.patient2@example.test' },
};
const SYSTEM_TIME = process.env.EVIDENCE_TIME || '2026-10-13T08:45:00+08:00';

async function selfRegister(person) {
  const otp = await injectOtp('register', person.email);
  const result = await call('POST', '/users/register', { body: { ...person, password: process.env.EVIDENCE_PASSWORD, otp } });
  if (result.status !== 201) throw new Error(`Register ${person.email}: ${result.status} ${JSON.stringify(result.body)}`);
}

(async () => {
  await selfRegister(people.admin);
  // README bootstrap: the database owner promotes their own new account once.
  await (await db()).collection('users').updateOne({ email: people.admin.email }, { $set: { role: 'Admin' } });
  const admin = await login(people.admin.email);
  const time = await call('POST', '/system/time', { token: admin, body: { time: SYSTEM_TIME } });
  console.log('system time', time.status, time.body.data?.currentTime);
  for (const key of ['doctor', 'doctor2', 'staff']) {
    const created = await call('POST', '/users', { token: admin, body: { ...people[key], password: process.env.EVIDENCE_PASSWORD } });
    console.log('created', key, created.status, created.body.data?.role);
  }
  await selfRegister(people.patient2);
  console.log('registered patient2');
  await mongoose.disconnect();
})().catch(async error => { console.error(error.message); await mongoose.disconnect(); process.exit(1); });
