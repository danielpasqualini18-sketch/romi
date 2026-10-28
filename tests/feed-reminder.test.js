import test from 'node:test';
import assert from 'node:assert/strict';
import {feedWhen} from '../public/feed-reminder.js';
test('feed reminder uses today/yesterday in the configured timezone',()=>{
 const now=Date.parse('2026-10-28T16:30:00Z');
 assert.equal(feedWhen('2026-10-28T16:00:00Z','Australia/Perth',now),'Today at 00:00');
 assert.equal(feedWhen('2026-10-28T15:59:00Z','Australia/Perth',now),'Yesterday at 23:59');
 assert.equal(feedWhen('2026-10-27T15:00:00Z','Australia/Perth',now),'27 Oct at 23:00');
});
test('relative day survives DST and older years retain the year',()=>{
 const now=Date.parse('2026-11-02T05:30:00Z');
 assert.equal(feedWhen('2026-11-01T04:30:00Z','America/New_York',now),'Yesterday at 00:30');
 assert.equal(feedWhen('2025-10-27T10:00:00Z','UTC',now),'27 Oct 2025 at 10:00');
});
