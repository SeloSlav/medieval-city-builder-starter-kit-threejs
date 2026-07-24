import {
  CHAPEL_BELL_EVENING_HOUR,
  CHAPEL_BELL_MORNING_HOUR,
  isChapelBellHour,
} from '../src/audio/chapelBellSchedule.ts';
import {
  CHAPEL_BELL_CUTOFF_DISTANCE,
  CHAPEL_BELL_CUTOFF_ORBIT_DISTANCE,
  chapelBellGain,
  chapelBellRingShouldContinue,
} from '../src/audio/ChapelBellPlayer.ts';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

assert(isChapelBellHour(CHAPEL_BELL_MORNING_HOUR), 'morning bell hour');
assert(isChapelBellHour(CHAPEL_BELL_EVENING_HOUR), 'evening bell hour');
assert(!isChapelBellHour(12), 'noon is not a bell hour');
assert(!isChapelBellHour(0), 'midnight is not a bell hour');
assert(CHAPEL_BELL_MORNING_HOUR === 6, 'morning bell at 6 AM');
assert(CHAPEL_BELL_EVENING_HOUR === 18, 'evening bell at 6 PM');
assert(
  chapelBellGain([{ x: 0, z: 0 }], { x: 0, z: 0 }, 24) > 0.99,
  'a close chapel should ring at full spatial gain',
);
assert(
  chapelBellGain(
    [{ x: 0, z: 0 }],
    { x: CHAPEL_BELL_CUTOFF_DISTANCE, z: 0 },
    24,
  ) === 0,
  'bells should be inaudible past their world-space cutoff',
);
assert(
  chapelBellGain(
    [{ x: 0, z: 0 }],
    { x: 0, z: 0 },
    CHAPEL_BELL_CUTOFF_ORBIT_DISTANCE,
  ) === 0,
  'bells should fade out at far overview zoom',
);
assert(chapelBellRingShouldContinue(360, 380), 'a bell ring may last twenty game minutes');
assert(!chapelBellRingShouldContinue(360, 381), 'a bell ring should not survive hours of fast time');

console.log('chapel bell schedule tests passed');
