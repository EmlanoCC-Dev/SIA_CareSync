// Run only with all API processes/other clinic writers stopped:
// node backend/scripts/recover-assignments.js --offline
const mongoose = require('mongoose');
const env = require('../src/config/env');
const AssignmentRecovery = require('../src/models/AssignmentRecovery');
const SlotPlan = require('../src/models/SlotPlan');
const { recover } = require('../src/services/assignmentRecovery.service');
const { materializePlan } = require('../src/services/slot.service');

async function main() {
  if (!process.argv.includes('--offline')) throw new Error('Stop all clinic writers, then supply --offline to reconcile interrupted assignments');
  await mongoose.connect(env.MONGO_URI);
  await Promise.all([require('../src/models/WalkIn').init(), require('../src/models/Slot').init(), AssignmentRecovery.init(), SlotPlan.init()]);
  let recovered = 0;
  for (const operation of await AssignmentRecovery.find({ state: 'pending' })) {
    await recover(operation);
    recovered++;
  }
  let restored = 0;
  for (const plan of await SlotPlan.find()) {
    await materializePlan(plan);
    restored++;
  }
  console.log(`Reconciled ${recovered} interrupted assignments; restored missing rows from ${restored} slot plans.`);
}
main().catch(err => { console.error(err.message); process.exitCode = 1; }).finally(() => mongoose.disconnect());
