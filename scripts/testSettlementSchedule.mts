import assert from 'node:assert/strict';
import { CALENDAR_WORK_START_HOUR, SIM_TICK_SECONDS } from '../src/generated/gameBalance.ts';
import { gameClock, isLaborPaused, laborPauseLabel } from '../src/world/gameCalendar.ts';
import { deriveSettlementSchedule } from '../src/world/settlementSchedule.ts';
import { DEFAULT_PARISH_POLICY } from '../src/economy/chapelParish.ts';

const workHourTick = Math.ceil(
  (CALENDAR_WORK_START_HOUR * 3600 + 60) / SIM_TICK_SECONDS,
);
const nightTick = 0;

const nightClock = gameClock(nightTick);
assert.equal(isLaborPaused(nightClock, false, false), true);
assert.equal(laborPauseLabel(nightClock, false, false), 'Night hours');

const workClock = gameClock(workHourTick);
assert.equal(isLaborPaused(workClock, false, false), false);
assert.equal(laborPauseLabel(workClock, false, false), null);

const sundayWorkTick = workHourTick;
const sundayClock = gameClock(sundayWorkTick);
assert.equal(sundayClock.isSunday, true, 'work-hour tick should land on Sunday (day 0)');
assert.equal(sundayClock.isWorkHours, true);
assert.equal(isLaborPaused(sundayClock, true, true), true);
assert.equal(laborPauseLabel(sundayClock, true, true), 'Sunday sabbath');

const schedule = deriveSettlementSchedule(
  { simTick: nightTick, parishPolicy: DEFAULT_PARISH_POLICY },
  null,
);
assert.equal(schedule.laborPaused, true);
assert.equal(schedule.dayNight.smokeAllowed, false);

const daySchedule = deriveSettlementSchedule(
  { simTick: workHourTick, parishPolicy: DEFAULT_PARISH_POLICY },
  null,
);
assert.equal(daySchedule.laborPaused, false);
assert.equal(daySchedule.dayNight.smokeAllowed, true);

console.log('settlement schedule tests passed');
