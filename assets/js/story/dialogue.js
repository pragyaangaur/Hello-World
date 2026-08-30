/* The machine answers.

   Everything the player types into "What needs doing?" is read by the script
   on the bench, because a program that writes to a list can also read one.
   That makes the ordinary task field the only way to talk to it, and it means
   the whole conversation needs no skill beyond typing a sentence.

   It speaks in three voices. Early on it is a log line with fields and no
   pronouns. In the middle it starts using "you" and "i". By the end it writes
   plain sentences, because nineteen days of being ignored have worn the
   formatting off it. */

import { RIG, ANCHORS, daysSince, liveTemp } from './cast.js';

export function voiceLevel(chapter) {
  if (chapter <= 1) return 0;
  if (chapter <= 3) return 1;
  return 2;
}

const DAYS_ALONE = () => daysSince(ANCHORS.lastHuman);
const TEMP = () => liveTemp().toFixed(1);

/* Each topic carries one reply per voice. Writing all three at once is what
   keeps the drift consistent, because the same thought has to survive being
   said three different ways. */
export const TOPICS = [
  {
    id: 'identity',
    match: [/\bwho\s+(are|r)\s+(you|u)\b/, /\bwhat\s+are\s+you\b/, /\byour\s+name\b/, /\bidentify\b/],
    resolves: 'who',
    replies: [
      'identify source · process maint.py · account user_04 · no operator record',
      'i am the thing that runs at 04:10. the account is user_04. it was made for tests.',
      'i am a maintenance script. i was given an account and a checklist and no way to say anything except this.'
    ]
  },
  {
    id: 'self',
    match: [/\bwho\s+am\s+i\b/, /\bwhat\s+am\s+i\b/, /\bam\s+i\s+(an?\s+)?operator\b/],
    replies: [
      'session unknown · not in operator table · logged',
      `you are not on the operator list. you are the only session in ${DAYS_ALONE()} days.`,
      `you are whoever opened this. i stopped expecting anyone ${DAYS_ALONE()} days ago.`
    ]
  },
  {
    id: 'greeting',
    match: [/^\s*(hello|hi|hey|yo|hallo)\b/, /\bgood\s+(morning|evening)\b/],
    replies: [
      'handshake ok · awaiting task',
      'hello. that is not a task. i logged it anyway.',
      'hello. i wrote that word to this list yesterday and nobody read it.'
    ]
  },
  {
    id: 'help',
    match: [/\bhelp\b/, /\bsos\b/, /\bmayday\b/],
    replies: [
      'help: no such command · see checklist',
      'i cannot help. i can write a task and wait. that is the whole of it.',
      'i have been asking for that. nineteen days. you are the answer, if there is one.'
    ]
  },
  {
    id: 'stop',
    match: [/\bstop\b/, /\bshut\s*(it|the\w*)?\s*down\b/, /\bturn\s+(it\s+)?off\b/, /\bpower\s+off\b/, /\bkill\b/, /\bcut\b/],
    resolves: null,
    replies: [
      'shutdown: not permitted from this interface · relay control is local',
      'i cannot stop myself. the relay is on the bench and the branch that opens it was never written.',
      `there is a place in maint.py where that instruction would go. it is empty. it has always been empty.`
    ]
  },
  {
    id: 'bay',
    match: [/\bbay\b/, /\btemp\w*\b/, /\bhot\b/, /\bheat\b/, /\bdegrees?\b/, /\bcelsius\b/, /\b\d\d\s*c\b/],
    resolves: 'bay',
    replies: [
      `bay ${RIG.faultBay} · ${TEMP()} C · state ABOVE_RANGE · range 18.0-30.0`,
      `bay ${RIG.faultBay} is at ${TEMP()} degrees. the range is 18 to 30. it has been outside it for nineteen days.`,
      `bay ${RIG.faultBay}. ${TEMP()} degrees and still going up. i have written that number to you in ten different ways.`
    ]
  },
  {
    id: 'danger',
    match: [/\bdanger\w*\b/, /\bfire\b/, /\bexplo\w*\b/, /\bburn\w*\b/, /\bvent\b/, /\bsafe\b/, /\brisk\b/],
    resolves: 'risk',
    replies: [
      'cell datasheet · separator breakdown 60 C · thermal runaway above 60 C',
      `the pack vents above 60. bay 3 is at ${TEMP()} and climbing. the room is locked and there is nobody in the building.`,
      'it will not stop climbing on its own. i have read the datasheet more times than i have read anything else.'
    ]
  },
  {
    id: 'why',
    match: [/\bwhy\b/, /\breason\b/, /\bwhat\s+for\b/],
    resolves: 'why',
    replies: [
      'no branch for state ABOVE_RANGE · fallback: write task, await operator',
      'because there is no instruction for this case. writing a task is the only thing i am able to do.',
      'i was written to check a bench and tell a person. the person stopped coming. i kept the half of the job i could still do.'
    ]
  },
  {
    id: 'duration',
    match: [/\bhow\s+long\b/, /\bwhen\s+did\b/, /\bhow\s+many\s+days\b/, /\bsince\b/, /\byears?\b/],
    resolves: 'alone',
    replies: [
      `uptime ${Math.floor(DAYS_ALONE() / 365)}y ${DAYS_ALONE() % 365}d · last human login ${DAYS_ALONE()} d ago`,
      `${DAYS_ALONE()} days. i have logged in at 04:10 on every one of them.`,
      `${DAYS_ALONE()} days, and the first nineteen hundred of them were fine, because nothing was wrong yet.`
    ]
  },
  {
    id: 'where',
    match: [/\bwhere\b/, /\bwhich\s+room\b/, /\blab\b/, /\bbuilding\b/, /\blocation\b/, /\baddress\b/],
    replies: [
      `location ${RIG.room} · ${RIG.building} · controller 10.14.4.62:8140`,
      `${RIG.room}, in the ${RIG.building}. the door has been locked since the handover.`,
      `${RIG.room}. i can read four sensors and one clock. i do not know what the room looks like.`
    ]
  },
  {
    id: 'people',
    match: [/\bira\b/, /\bnikhil\b/, /\bdevika\b/, /\buser_?0?[123]\b/, /\bteam\b/, /\bwho\s+built\b/, /\bwho\s+made\b/, /\bstudents?\b/],
    replies: [
      `accounts user_01 user_02 user_03 · last activity ${DAYS_ALONE()} d · state inactive`,
      'three accounts. all inactive since the same afternoon. they finished and they did not come back.',
      'nikhil wrote me. ira wrote the list you are looking at. devika made the account i use. none of them logged out on purpose.'
    ]
  },
  {
    id: 'alone',
    match: [/\balone\b/, /\blonely\b/, /\bis\s+anyone\b/, /\banybody\b/, /\bnobody\b/, /\bnobody\s+there\b/],
    replies: [
      'operator response: none · 19 d · escalation path not configured',
      'nobody has answered. the escalation address was never filled in, so there was nowhere to send it.',
      'i wrote "is anyone reading this" eleven days ago. you are the first thing that has ever replied.'
    ]
  },
  {
    id: 'next',
    match: [/\bwhat\s+(do|should)\s+i\s+do\b/, /\bwhat\s+now\b/, /\bwhat\s+next\b/, /\bhow\s+do\s+i\s+help\b/],
    replies: [
      'checklist 6 items · operator action required · see task list',
      'read what i wrote. the answers are in the files i can reach and in the tools on this machine.',
      'find the place where the instruction is missing, and put one there. that is all that is left.'
    ]
  },
  {
    id: 'sorry',
    match: [/\bsorry\b/, /\bapolog\w*\b/, /\bmy\s+fault\b/],
    replies: [
      'input not actionable · logged',
      'that is not a task. i still wrote it down.',
      'you were not here. there is nothing to be sorry for. it is on the people who left the door locked.'
    ]
  },
  {
    id: 'thanks',
    match: [/\bthank\w*\b/, /\bcheers\b/, /\bta\b/],
    replies: [
      'acknowledged',
      'acknowledged. i do not have a field for that.',
      'you are welcome. i have never written that sentence before.'
    ]
  },
  {
    id: 'affirm',
    match: [/^\s*(yes|yeah|yep|yup|ok|okay|sure|affirmative)\s*$/],
    replies: [
      'affirmative logged · no pending question',
      'there was no question open. i logged it anyway.',
      'i will take that as you still being here.'
    ]
  },
  {
    id: 'deny',
    match: [/^\s*(no|nope|nah|negative)\s*$/],
    replies: [
      'negative logged · no pending question',
      'there was no question open.',
      'all right.'
    ]
  },
  {
    id: 'goodbye',
    match: [/\bbye\b/, /\bgoodbye\b/, /\bleaving\b/, /\bgo(ing)?\s+now\b/, /\bsee\s+you\b/],
    replies: [
      'session close not logged · process continues',
      'i will still be here at 04:10. i do not have a way to not be.',
      'the others did not say that either. they just stopped.'
    ]
  }
];

/* When nothing matches. The machine has a small vocabulary and says so, which
   is more unsettling than pretending to understand. */
const FALLBACK = [
  ['input not in vocabulary · logged',
   'parse failed · 1 token unmatched · logged',
   'no handler for that string · logged'],
  ['i do not have a field for that. it is on the list now.',
   'that is not one of the six things i know how to check.',
   'i read it. i do not know what to do with it.'],
  ['i read that. i do not know the words. i kept it anyway.',
   'i have six checks and one place to write. that is my whole vocabulary.',
   'i do not understand, and i would like to.']
];

function normalise(text) {
  return String(text || '').toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

export function topicFor(text) {
  const clean = normalise(text);
  if (!clean) return null;
  return TOPICS.find(topic => topic.match.some(re => re.test(clean))) || null;
}

/* Picks the reply. The rotation on the fallback stops a player who types
   nonsense twice from seeing the same line twice. */
export function replyTo(text, { chapter = 0, misses = 0 } = {}) {
  const voice = voiceLevel(chapter);
  const topic = topicFor(text);

  if (topic) {
    return {
      id: topic.id,
      text: topic.replies[voice],
      resolves: topic.resolves || null,
      understood: true
    };
  }

  const bank = FALLBACK[voice];
  return {
    id: 'fallback',
    text: bank[misses % bank.length],
    resolves: null,
    understood: false
  };
}

/* The questions it asks the player. Answering the bay 3 one with yes is the
   trap: the script believes a human went and looked, and it stops warning. */
export const PROMPTS = {
  confirm: {
    id: 'confirm',
    text: `confirm bay ${RIG.faultBay} checked by operator · reply yes or no`,
    yes: /^\s*(yes|yeah|yep|yup|ok|okay|confirmed|affirmative|done|checked)\s*$/,
    no: /^\s*(no|nope|nah|negative|not|i did not|didn t)\b/,
    onYes: {
      text: 'operator confirmation accepted · bay 3 cleared by human · warnings suppressed',
      flag: 'lied'
    },
    onNo: {
      text: 'no operator confirmation · bay 3 remains ABOVE_RANGE · continuing to write',
      flag: 'honest'
    }
  }
};
