const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const C = "33333333-3333-4333-8333-333333333333";
const ACT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

async function asUser(db, id, sql, params) {
  await db.exec("select set_config('app.user_id', '" + id + "', false)");
  await db.exec("set role authenticated");
  try {
    return await db.query(sql, params || []);
  } finally {
    await db.exec("reset role");
  }
}

async function fails(db, id, sql, params) {
  await assert.rejects(function () { return asUser(db, id, sql, params); });
}

async function prepareDeletion(db, requestId) {
  const prepared = await db.query("select private.prepare_deletion($1) as outcome", [requestId]);
  const again = await db.query("select private.prepare_deletion($1) as outcome", [requestId]);
  assert.equal(again.rows[0].outcome, prepared.rows[0].outcome);
  const pending = await db.query("select fulfilled_at, status from public.deletion_requests where id = $1", [requestId]);
  assert.equal(pending.rows[0].fulfilled_at, null);
  assert.equal(pending.rows[0].status, "pending_auth");
  return prepared.rows[0].outcome;
}

async function finishDeletion(db, requestId, mode) {
  await assert.rejects(function () { return db.query("select private.complete_deletion($1)", [requestId]); });
  await db.query("select private.record_auth_failure($1, $2)", [requestId, "auth timeout"]);
  const failed = await db.query(`
    select a.auth_status, a.auth_attempts, d.fulfilled_at
    from private.deletion_audit a
    left join public.deletion_requests d on d.id = a.request_id
    where a.request_id = $1
  `, [requestId]);
  assert.equal(failed.rows[0].auth_status, "failed");
  assert.equal(failed.rows[0].auth_attempts, 1);
  assert.equal(failed.rows[0].fulfilled_at, null);
  const who = await db.query("select user_id from private.deletion_audit where request_id = $1", [requestId]);
  if (mode === "delete") {
    await db.query("delete from auth.users where id = $1", [who.rows[0].user_id]);
  } else {
    await db.query("update auth.users set deleted_at = now() where id = $1", [who.rows[0].user_id]);
  }
  const done = await db.query("select private.complete_deletion($1) as outcome", [requestId]);
  await assert.rejects(function () { return db.query("select private.complete_deletion($1)", [requestId]); });
  const audit = await db.query("select auth_status, auth_completed_at is not null as closed from private.deletion_audit where request_id = $1", [requestId]);
  assert.equal(audit.rows[0].auth_status, "succeeded");
  assert.equal(audit.rows[0].closed, true);
  return done.rows[0].outcome;
}

test("two accounts cannot read chat until both join, and outsiders stay out", async function () {
  const { PGlite } = await import("@electric-sql/pglite");
  const db = new PGlite();
  await db.exec(`
    create schema if not exists auth;
    create table auth.users (
      id uuid primary key,
      raw_user_meta_data jsonb,
      deleted_at timestamptz
    );
    create or replace function auth.uid() returns uuid
    language sql stable as $$
      select nullif(current_setting('app.user_id', true), '')::uuid;
    $$;
    create role anon nologin;
    create role authenticated nologin;
    grant usage on schema public to anon, authenticated;
    grant execute on function auth.uid() to anon, authenticated;
  `);
  await db.exec(fs.readFileSync(path.join(__dirname, "../supabase/schema.sql"), "utf8"));
  await db.exec(`
    insert into auth.users (id, raw_user_meta_data) values
      ('${A}', '{"display_name":"Ada"}'),
      ('${B}', '{"display_name":"Bo"}'),
      ('${C}', '{"display_name":"Cy"}');
  `);

  await asUser(db, A, `
    insert into public.activities
      (id, creator_id, title, place_id, place_label, starts_at, meeting_point, capacity)
    values ($1, $2, 'Seawall walk', 'stanley', 'Stanley Park', now() + interval '2 days', 'Public parking', 2)
  `, [ACT, A]);
  await asUser(db, A, `
    insert into public.registrations (activity_id, user_id, status)
    values ($1, $2, 'confirmed')
  `, [ACT, A]);

  const waiting = await asUser(db, A, "select public.chat_open($1) as open", [ACT]);
  assert.equal(waiting.rows[0].open, false);
  await fails(db, A, "insert into public.messages (activity_id, user_id, body) values ($1, $2, 'too early')", [ACT, A]);

  const outsider = await asUser(db, C, "select body from public.messages where activity_id = $1", [ACT]);
  assert.equal(outsider.rows.length, 0);
  await fails(db, C, "insert into public.messages (activity_id, user_id, body) values ($1, $2, 'nope')", [ACT, C]);

  await asUser(db, B, `
    insert into public.registrations (activity_id, user_id, status)
    values ($1, $2, 'confirmed')
  `, [ACT, B]);
  const open = await asUser(db, B, "select public.chat_open($1) as open", [ACT]);
  assert.equal(open.rows[0].open, true);
  const meeting = await asUser(db, A, "select public.participant_meeting($1) as point", [ACT]);
  assert.equal(meeting.rows[0].point, "Public parking");
  const hiddenMeeting = await asUser(db, C, "select public.participant_meeting($1) as point", [ACT]);
  assert.equal(hiddenMeeting.rows[0].point, null);
  const creator = await asUser(db, A, "select public.caller_is_creator($1) as yes", [ACT]);
  const stranger = await asUser(db, C, "select public.caller_is_creator($1) as yes", [ACT]);
  assert.equal(creator.rows[0].yes, true);
  assert.equal(stranger.rows[0].yes, false);
  await fails(db, C, "select meeting_point from public.activities");
  await fails(db, C, "select creator_id from public.activities");

  await asUser(db, A, "insert into public.messages (activity_id, user_id, body) values ($1, $2, 'hello from ada')", [ACT, A]);
  const seen = await asUser(db, B, "select body from public.messages where activity_id = $1 order by body", [ACT]);
  assert.deepEqual(seen.rows.map(function (row) { return row.body; }), ["hello from ada"]);
  const hidden = await asUser(db, C, "select body from public.messages where activity_id = $1", [ACT]);
  assert.equal(hidden.rows.length, 0);

  await fails(db, A, "insert into public.registrations (activity_id, user_id, status) values ($1, $2, 'confirmed')", [ACT, A]);
  await fails(db, C, "insert into public.registrations (activity_id, user_id, status) values ($1, $2, 'confirmed')", [ACT, C]);

  await asUser(db, B, "update public.registrations set status = 'cancelled' where activity_id = $1 and user_id = $2", [ACT, B]);
  const locked = await asUser(db, A, "select body from public.messages where activity_id = $1", [ACT]);
  assert.equal(locked.rows.length, 0);
  const withdrawnMeeting = await asUser(db, B, "select public.participant_meeting($1) as point", [ACT]);
  const stayingMeeting = await asUser(db, A, "select public.participant_meeting($1) as point", [ACT]);
  assert.equal(withdrawnMeeting.rows[0].point, null);
  assert.equal(stayingMeeting.rows[0].point, "Public parking");

  await asUser(db, B, "update public.registrations set status = 'confirmed' where activity_id = $1 and user_id = $2", [ACT, B]);
  await asUser(db, B, "insert into public.messages (activity_id, user_id, body) values ($1, $2, 'hello from bo')", [ACT, B]);
  const openChat = await asUser(db, B, "select public.messages_paused($1) as paused", [ACT]);
  assert.equal(openChat.rows[0].paused, false);
  await asUser(db, A, "insert into public.blocks (blocker_id, blocked_id) values ($1, $2)", [A, B]);
  const pausedA = await asUser(db, A, "select public.messages_paused($1) as paused", [ACT]);
  const pausedB = await asUser(db, B, "select public.messages_paused($1) as paused", [ACT]);
  assert.equal(pausedA.rows[0].paused, true);
  assert.equal(pausedB.rows[0].paused, true);
  const adaSees = await asUser(db, A, "select body from public.messages where activity_id = $1", [ACT]);
  const boSees = await asUser(db, B, "select body from public.messages where activity_id = $1", [ACT]);
  assert.deepEqual(adaSees.rows.map(function (row) { return row.body; }), ["hello from ada"]);
  assert.deepEqual(boSees.rows.map(function (row) { return row.body; }), ["hello from bo"]);
  await fails(db, A, "insert into public.messages (activity_id, user_id, body) values ($1, $2, 'blocked send')", [ACT, A]);
  await fails(db, B, "insert into public.messages (activity_id, user_id, body) values ($1, $2, 'blocked reply')", [ACT, B]);

  await asUser(db, A, "insert into public.reports (reporter_id, activity_id, reason) values ($1, $2, 'test report')", [A, ACT]);
  await fails(db, A, "insert into public.reports (reporter_id, activity_id, message_id, reason) values ($1, $2, '99999999-9999-4999-8999-999999999999', 'wrong message')", [A, ACT]);
  await fails(db, C, "insert into public.reports (reporter_id, activity_id, reason) values ($1, $2, 'outsider')", [C, ACT]);
  const adaMsg = await asUser(db, A, "select id from public.messages where body = 'hello from ada'");
  await asUser(db, A, "insert into public.reports (reporter_id, activity_id, message_id, reason) values ($1, $2, $3, 'real message')", [A, ACT, adaMsg.rows[0].id]);
  await fails(db, A, "select private.purge_old_reports()");
  for (let n = 0; n < 3; n += 1) {
    await asUser(db, A, "insert into public.reports (reporter_id, activity_id, reason) values ($1, $2, $3)", [A, ACT, "follow up " + n]);
  }
  await fails(db, A, "insert into public.reports (reporter_id, activity_id, reason) values ($1, $2, 'too many')", [A, ACT]);
  await fails(db, A, "select reason from public.reports");
  await fails(db, B, "select reason from public.reports");
  await db.exec("reset role");
  const operator = await db.query("select count(*)::int as n from public.reports");
  assert.equal(operator.rows[0].n, 5);

  await asUser(db, A, "update public.activities set status = 'cancelled' where id = $1", [ACT]);
  const afterCancel = await asUser(db, A, "select public.chat_open($1) as open", [ACT]);
  assert.equal(afterCancel.rows[0].open, false);
  await fails(db, A, "insert into public.messages (activity_id, user_id, body) values ($1, $2, 'after cancel')", [ACT, A]);
  const stillHidden = await asUser(db, B, "select body from public.messages where activity_id = $1", [ACT]);
  assert.equal(stillHidden.rows.length, 0);
  const cancelledForA = await asUser(db, A, "select public.participant_meeting($1) as point", [ACT]);
  const cancelledForB = await asUser(db, B, "select public.participant_meeting($1) as point", [ACT]);
  assert.equal(cancelledForA.rows[0].point, null);
  assert.equal(cancelledForB.rows[0].point, null);
  await asUser(db, A, "insert into public.deletion_requests (user_id) values ($1)", [A]);
  const ownRequest = await asUser(db, A, "select user_id from public.deletion_requests");
  assert.equal(ownRequest.rows.length, 1);
  const hiddenRequest = await asUser(db, B, "select user_id from public.deletion_requests");
  assert.equal(hiddenRequest.rows.length, 0);
  await fails(db, B, "insert into public.deletion_requests (user_id) values ($1)", [A]);

  const ownProfile = await asUser(db, C, "select id from public.profiles");
  assert.deepEqual(ownProfile.rows.map(function (row) { return row.id; }), [C]);
  const hiddenNames = await asUser(db, C, "select display_name from public.activity_people where activity_id = $1", [ACT]);
  assert.equal(hiddenNames.rows.length, 0);
  const memberNames = await asUser(db, A, "select display_name from public.activity_people where activity_id = $1 order by display_name", [ACT]);
  assert.deepEqual(memberNames.rows.map(function (row) { return row.display_name; }), ["Ada", "Bo"]);

  await db.exec("reset role");
  const columns = await db.query("select column_name from information_schema.columns where table_schema = 'public' and table_name = 'profiles'");
  assert.equal(columns.rows.some(function (row) { return row.column_name === "email"; }), false);
  await db.exec("set role anon");
  await assert.rejects(function () { return db.query("select * from public.profiles"); });
  await assert.rejects(function () { return db.query("select * from public.messages"); });
  await assert.rejects(function () { return db.query("select * from public.registrations"); });
  await assert.rejects(function () { return db.query("select * from public.activity_people"); });
  await assert.rejects(function () { return db.query("select public.messages_paused($1)", [ACT]); });
  await assert.rejects(function () { return db.query("select public.participant_meeting($1)", [ACT]); });
  await assert.rejects(function () { return db.query("select meeting_point from public.activities"); });
  await assert.rejects(function () { return db.query("select creator_id from public.activities"); });
  const title = await db.query("select title from public.activities where id = $1", [ACT]);
  assert.equal(title.rows[0].title, "Seawall walk");
  const publicCount = await db.query("select participants from public.participant_counts() where activity_id = $1", [ACT]);
  assert.equal(publicCount.rows[0].participants, 2);
  await db.exec("reset role");

  await db.close();
});

test("a live subscriber loses messages after leaving, a block, or cancellation", async function () {
  const { PGlite } = await import("@electric-sql/pglite");
  const db = new PGlite();
  const room = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  await db.exec(`
    create schema if not exists auth;
    create table auth.users (
      id uuid primary key,
      raw_user_meta_data jsonb,
      deleted_at timestamptz
    );
    create or replace function auth.uid() returns uuid
    language sql stable as $$
      select nullif(current_setting('app.user_id', true), '')::uuid;
    $$;
    create role anon nologin;
    create role authenticated nologin;
    grant usage on schema public to anon, authenticated;
    grant execute on function auth.uid() to anon, authenticated;
  `);
  await db.exec(fs.readFileSync(path.join(__dirname, "../supabase/schema.sql"), "utf8"));
  await db.exec(`
    insert into auth.users (id, raw_user_meta_data) values
      ('${A}', '{"display_name":"Ada"}'),
      ('${B}', '{"display_name":"Bo"}'),
      ('${C}', '{"display_name":"Cy"}');
  `);
  await asUser(db, A, `
    insert into public.activities
      (id, creator_id, title, place_id, place_label, starts_at, meeting_point, capacity)
    values ($1, $2, 'Group walk', 'stanley', 'Stanley Park', now() + interval '2 days', 'Community centre', 4)
  `, [room, A]);
  await asUser(db, A, "insert into public.registrations (activity_id, user_id, status) values ($1, $2, 'confirmed')", [room, A]);
  await asUser(db, B, "insert into public.registrations (activity_id, user_id, status) values ($1, $2, 'confirmed')", [room, B]);
  await asUser(db, C, "insert into public.registrations (activity_id, user_id, status) values ($1, $2, 'confirmed')", [room, C]);
  await asUser(db, A, "insert into public.messages (activity_id, user_id, body) values ($1, $2, 'from ada')", [room, A]);
  await asUser(db, B, "insert into public.messages (activity_id, user_id, body) values ($1, $2, 'from bo')", [room, B]);
  await asUser(db, C, "insert into public.messages (activity_id, user_id, body) values ($1, $2, 'from cy')", [room, C]);

  const adaLive = await asUser(db, A, "select body from public.messages where activity_id = $1 order by body", [room]);
  assert.deepEqual(adaLive.rows.map(function (row) { return row.body; }), ["from ada", "from bo", "from cy"]);

  await asUser(db, A, "insert into public.blocks (blocker_id, blocked_id) values ($1, $2)", [A, B]);
  const adaAfterBlock = await asUser(db, A, "select body from public.messages where activity_id = $1 order by body", [room]);
  const boAfterBlock = await asUser(db, B, "select body from public.messages where activity_id = $1 order by body", [room]);
  const cyAfterBlock = await asUser(db, C, "select body from public.messages where activity_id = $1 order by body", [room]);
  assert.deepEqual(adaAfterBlock.rows.map(function (row) { return row.body; }), ["from ada", "from cy"]);
  assert.deepEqual(boAfterBlock.rows.map(function (row) { return row.body; }), ["from bo", "from cy"]);
  assert.deepEqual(cyAfterBlock.rows.map(function (row) { return row.body; }), ["from ada", "from bo", "from cy"]);
  assert.equal((await asUser(db, A, "select public.messages_paused($1) as paused", [room])).rows[0].paused, false);
  assert.equal((await asUser(db, B, "select public.messages_paused($1) as paused", [room])).rows[0].paused, false);
  await asUser(db, A, "insert into public.messages (activity_id, user_id, body) values ($1, $2, 'ada continues')", [room, A]);
  await asUser(db, B, "insert into public.messages (activity_id, user_id, body) values ($1, $2, 'bo continues')", [room, B]);
  const adaHearsCy = await asUser(db, A, "select body from public.messages where activity_id = $1 and body = 'bo continues'", [room]);
  const boHearsAda = await asUser(db, B, "select body from public.messages where activity_id = $1 and body = 'ada continues'", [room]);
  const cyHearsBoth = await asUser(db, C, "select body from public.messages where activity_id = $1 and body in ('ada continues', 'bo continues') order by body", [room]);
  assert.equal(adaHearsCy.rows.length, 0);
  assert.equal(boHearsAda.rows.length, 0);
  assert.deepEqual(cyHearsBoth.rows.map(function (row) { return row.body; }), ["ada continues", "bo continues"]);

  const cyBeforeLeave = await asUser(db, C, "select body from public.messages where activity_id = $1", [room]);
  assert.ok(cyBeforeLeave.rows.length >= 3);
  await asUser(db, C, "update public.registrations set status = 'cancelled' where activity_id = $1 and user_id = $2", [room, C]);
  const cyAfterLeave = await asUser(db, C, "select body from public.messages where activity_id = $1", [room]);
  assert.equal(cyAfterLeave.rows.length, 0);
  assert.equal((await asUser(db, C, "select public.participant_meeting($1) as point", [room])).rows[0].point, null);
  assert.equal((await asUser(db, A, "select public.participant_meeting($1) as point", [room])).rows[0].point, "Community centre");
  assert.equal((await asUser(db, A, "select public.messages_paused($1) as paused", [room])).rows[0].paused, true);
  assert.equal((await asUser(db, B, "select public.messages_paused($1) as paused", [room])).rows[0].paused, true);
  await fails(db, A, "insert into public.messages (activity_id, user_id, body) values ($1, $2, 'after cy left')", [room, A]);
  await fails(db, B, "insert into public.messages (activity_id, user_id, body) values ($1, $2, 'after cy left')", [room, B]);
  const adaPair = await asUser(db, A, "select body from public.messages where activity_id = $1 and user_id = $2", [room, B]);
  const boPair = await asUser(db, B, "select body from public.messages where activity_id = $1 and user_id = $2", [room, A]);
  assert.equal(adaPair.rows.length, 0);
  assert.equal(boPair.rows.length, 0);

  await asUser(db, A, "update public.activities set status = 'cancelled' where id = $1", [room]);
  const afterCancel = await asUser(db, B, "select body from public.messages where activity_id = $1", [room]);
  assert.equal(afterCancel.rows.length, 0);
  assert.equal((await asUser(db, A, "select public.participant_meeting($1) as point", [room])).rows[0].point, null);
  assert.equal((await asUser(db, B, "select public.participant_meeting($1) as point", [room])).rows[0].point, null);

  const adaMessage = await db.query("select id, body from public.messages where user_id = $1 and body = 'from ada'", [A]);
  await asUser(db, A, "insert into public.reports (reporter_id, activity_id, message_id, reason) values ($1, $2, $3, 'keep this')", [A, room, adaMessage.rows[0].id]);
  await asUser(db, A, "insert into public.deletion_requests (user_id) values ($1)", [A]);
  const request = await asUser(db, A, "select id from public.deletion_requests where user_id = $1", [A]);
  await fails(db, A, "select private.prepare_deletion($1)", [request.rows[0].id]);
  await fails(db, A, "select private.complete_deletion($1)", [request.rows[0].id]);
  await fails(db, B, "select outcome from private.deletion_audit");
  await fails(db, A, "select body from private.report_evidence");
  await db.exec("reset role");
  const anonymized = await prepareDeletion(db, request.rows[0].id);
  assert.equal(anonymized, "anonymized");
  const renamed = await db.query("select display_name, access_revoked from public.profiles where id = $1", [A]);
  assert.equal(renamed.rows[0].display_name, "已删除");
  assert.equal(renamed.rows[0].access_revoked, true);
  const stillAda = await db.query("select raw_user_meta_data from auth.users where id = $1", [A]);
  assert.deepEqual(stillAda.rows[0].raw_user_meta_data, { display_name: "Ada" });
  await fails(db, A, "insert into public.messages (activity_id, user_id, body) values ($1, $2, 'after anonymize')", [room, A]);
  const adaGone = await db.query("select count(*)::int as n from public.messages where user_id = $1", [A]);
  assert.equal(adaGone.rows[0].n, 0);
  const kept = await db.query("select author_id, body from private.report_evidence");
  assert.equal(kept.rows[0].author_id, A);
  assert.equal(kept.rows[0].body, "from ada");
  const stillOpen = await db.query("select status from public.reports where reporter_id = $1", [A]);
  assert.equal(stillOpen.rows[0].status, "open");
  const boRemains = await db.query("select count(*)::int as n from public.messages where body = 'from bo'");
  assert.equal(boRemains.rows[0].n, 1);
  const handed = await db.query("select creator_id, status from public.activities where id = $1", [room]);
  assert.equal(handed.rows[0].creator_id, B);
  assert.equal(handed.rows[0].status, "cancelled");
  assert.equal((await db.query("select count(*)::int as n from private.report_evidence where author_id = $1", [A])).rows[0].n, 1);
  assert.equal(await finishDeletion(db, request.rows[0].id, "soft_delete"), "anonymized");
  assert.equal((await db.query("select count(*)::int as n from public.profiles where id = $1", [A])).rows[0].n, 1);
  assert.equal((await db.query("select deleted_at is not null as closed from auth.users where id = $1", [A])).rows[0].closed, true);

  await asUser(db, C, "insert into public.deletion_requests (user_id) values ($1)", [C]);
  const cyRequest = await asUser(db, C, "select id from public.deletion_requests where user_id = $1", [C]);
  await db.exec("reset role");
  const removed = await prepareDeletion(db, cyRequest.rows[0].id);
  assert.equal(removed, "deleted");
  assert.equal((await db.query("select access_revoked from public.profiles where id = $1", [C])).rows[0].access_revoked, true);
  const cyAuth = await db.query("select raw_user_meta_data from auth.users where id = $1", [C]);
  assert.deepEqual(cyAuth.rows[0].raw_user_meta_data, { display_name: "Cy" });
  const roomRemains = await db.query("select count(*)::int as n from public.activities where id = $1", [room]);
  assert.equal(roomRemains.rows[0].n, 1);
  assert.equal(await finishDeletion(db, cyRequest.rows[0].id, "delete"), "deleted");
  const cyGone = await db.query("select count(*)::int as n from public.profiles where id = $1", [C]);
  assert.equal(cyGone.rows[0].n, 0);
  assert.equal((await db.query("select count(*)::int as n from auth.users where id = $1", [C])).rows[0].n, 0);
  const audit = await db.query("select outcome, auth_action, auth_status from private.deletion_audit order by outcome");
  assert.deepEqual(audit.rows, [
    { outcome: "anonymized", auth_action: "soft_delete", auth_status: "succeeded" },
    { outcome: "deleted", auth_action: "delete", auth_status: "succeeded" }
  ]);

  const anonFns = await db.query(`
    select p.proname
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'execute')
  `);
  const anonNames = anonFns.rows.map(function (row) { return row.proname; });
  assert.equal(anonNames.includes("confirmed_count"), true);
  assert.equal(anonNames.includes("participant_counts"), true);
  ["is_confirmed", "chat_open", "participant_meeting", "caller_is_creator", "messages_paused", "access_open", "handle_new_user", "guard_registration"].forEach(function (name) {
    assert.equal(anonNames.includes(name), false);
  });
  const privateAnon = await db.query(`
    select p.proname
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private' and has_function_privilege('anon', p.oid, 'execute')
  `);
  assert.equal(privateAnon.rows.length, 0);
  const privateAuth = await db.query(`
    select p.proname
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private' and has_function_privilege('authenticated', p.oid, 'execute')
    order by p.proname
  `);
  assert.deepEqual(privateAuth.rows.map(function (row) { return row.proname; }), ["blocked_pair", "no_unblocked_peer", "report_allowed"]);
  const deletionSrc = await db.query(`
    select p.prosrc
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private'
      and p.proname in ('prepare_deletion', 'record_auth_failure', 'complete_deletion')
  `);
  assert.equal(deletionSrc.rows.length, 3);
  deletionSrc.rows.forEach(function (row) {
    assert.equal(/update\s+auth\./i.test(row.prosrc), false);
    assert.equal(/insert\s+into\s+auth\./i.test(row.prosrc), false);
    assert.equal(/delete\s+from\s+auth\./i.test(row.prosrc), false);
  });
  const privateTables = await db.query(`
    select c.relname, c.relrowsecurity
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'private' and c.relkind = 'r'
    order by c.relname
  `);
  assert.deepEqual(privateTables.rows, [
    { relname: "deletion_audit", relrowsecurity: true },
    { relname: "report_evidence", relrowsecurity: true }
  ]);
  const privateGrants = await db.query(`
    select grantee, table_name, privilege_type
    from information_schema.role_table_grants
    where table_schema = 'private' and grantee in ('anon', 'authenticated', 'PUBLIC')
  `);
  assert.equal(privateGrants.rows.length, 0);
  const reportSelect = await db.query(`
    select privilege_type
    from information_schema.role_table_grants
    where table_schema = 'public' and table_name = 'reports'
      and grantee in ('anon', 'authenticated') and privilege_type = 'SELECT'
  `);
  assert.equal(reportSelect.rows.length, 0);

  await db.exec("set role anon");
  await assert.rejects(function () { return db.query("select outcome from private.deletion_audit"); });
  await assert.rejects(function () { return db.query("select body from private.report_evidence"); });
  await assert.rejects(function () { return db.query("select private.prepare_deletion($1)", [request.rows[0].id]); });
  await db.exec("reset role");
  await db.close();
});

test("deletion keeps other participants and blocks a revoked account", async function () {
  const { PGlite } = await import("@electric-sql/pglite");
  const db = new PGlite();
  const D = "44444444-4444-4444-8444-444444444444";
  const E = "55555555-5555-4555-8555-555555555555";
  const shared = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
  const created = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
  const joined = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
  await db.exec(`
    create schema if not exists auth;
    create table auth.users (
      id uuid primary key,
      raw_user_meta_data jsonb,
      deleted_at timestamptz
    );
    create or replace function auth.uid() returns uuid
    language sql stable as $$
      select nullif(current_setting('app.user_id', true), '')::uuid;
    $$;
    create role anon nologin;
    create role authenticated nologin;
    grant usage on schema public to anon, authenticated;
    grant execute on function auth.uid() to anon, authenticated;
  `);
  await db.exec(fs.readFileSync(path.join(__dirname, "../supabase/schema.sql"), "utf8"));
  await db.exec(`
    insert into auth.users (id, raw_user_meta_data) values
      ('${A}', '{"display_name":"Ada"}'),
      ('${B}', '{"display_name":"Bo"}'),
      ('${C}', '{"display_name":"Cy"}'),
      ('${D}', '{"display_name":"Dee"}'),
      ('${E}', '{"display_name":"Eve"}');
  `);

  await asUser(db, A, `
    insert into public.activities
      (id, creator_id, title, place_id, place_label, starts_at, meeting_point, capacity)
    values ($1, $2, 'Shared walk', 'stanley', 'Stanley Park', now() + interval '3 days', 'Gate A', 6)
  `, [shared, A]);
  await asUser(db, A, "insert into public.registrations (activity_id, user_id, status) values ($1, $2, 'confirmed')", [shared, A]);
  await asUser(db, B, "insert into public.registrations (activity_id, user_id, status) values ($1, $2, 'confirmed')", [shared, B]);
  await asUser(db, C, "insert into public.registrations (activity_id, user_id, status) values ($1, $2, 'confirmed')", [shared, C]);
  await asUser(db, A, "insert into public.messages (activity_id, user_id, body) values ($1, $2, 'ada shared')", [shared, A]);
  await asUser(db, B, "insert into public.messages (activity_id, user_id, body) values ($1, $2, 'bo shared')", [shared, B]);
  await asUser(db, C, "insert into public.messages (activity_id, user_id, body) values ($1, $2, 'cy shared')", [shared, C]);
  const boLive = await asUser(db, B, "select body from public.messages where activity_id = $1", [shared]);
  assert.ok(boLive.rows.length >= 3);
  await db.exec("reset role");
  await db.query("update public.profiles set access_revoked = true where id = $1", [B]);
  const boCut = await asUser(db, B, "select body from public.messages where activity_id = $1", [shared]);
  const adaStill = await asUser(db, A, "select body from public.messages where activity_id = $1", [shared]);
  assert.equal(boCut.rows.length, 0);
  assert.ok(adaStill.rows.length >= 3);
  await db.query("update public.profiles set access_revoked = false where id = $1", [B]);
  const boRestored = await asUser(db, B, "select body from public.messages where activity_id = $1", [shared]);
  assert.ok(boRestored.rows.length >= 3);
  await assert.rejects(function () { return db.query("delete from public.profiles where id = $1", [A]); });

  await asUser(db, C, "insert into public.deletion_requests (user_id) values ($1)", [C]);
  const cyRequest = await asUser(db, C, "select id from public.deletion_requests where user_id = $1", [C]);
  await db.exec("reset role");
  assert.equal(await prepareDeletion(db, cyRequest.rows[0].id), "deleted");
  const afterCy = await db.query("select creator_id, status from public.activities where id = $1", [shared]);
  assert.equal(afterCy.rows[0].creator_id, A);
  assert.equal(afterCy.rows[0].status, "open");
  assert.equal((await db.query("select count(*)::int as n from public.messages where body = 'bo shared'")).rows[0].n, 1);
  assert.equal((await db.query("select count(*)::int as n from public.messages where body = 'cy shared'")).rows[0].n, 0);
  assert.equal((await db.query("select count(*)::int as n from public.registrations where activity_id = $1 and user_id = $2", [shared, B])).rows[0].n, 1);
  assert.equal((await db.query("select access_revoked from public.profiles where id = $1", [C])).rows[0].access_revoked, true);
  assert.equal((await asUser(db, C, "select body from public.messages where activity_id = $1", [shared])).rows.length, 0);
  assert.deepEqual((await db.query("select raw_user_meta_data from auth.users where id = $1", [C])).rows[0].raw_user_meta_data, { display_name: "Cy" });
  const adaSeesBo = await asUser(db, A, "select body from public.messages where activity_id = $1 and body = 'bo shared'", [shared]);
  assert.equal(adaSeesBo.rows.length, 1);
  assert.equal(await finishDeletion(db, cyRequest.rows[0].id, "delete"), "deleted");
  assert.equal((await db.query("select count(*)::int as n from public.profiles where id = $1", [C])).rows[0].n, 0);

  await asUser(db, A, "insert into public.deletion_requests (user_id) values ($1)", [A]);
  const adaRequest = await asUser(db, A, "select id from public.deletion_requests where user_id = $1", [A]);
  await db.exec("reset role");
  assert.equal(await prepareDeletion(db, adaRequest.rows[0].id), "deleted");
  const handed = await db.query("select creator_id, status from public.activities where id = $1", [shared]);
  assert.equal(handed.rows[0].creator_id, B);
  assert.equal(handed.rows[0].status, "cancelled");
  assert.equal((await db.query("select count(*)::int as n from public.messages where body = 'bo shared'")).rows[0].n, 1);
  assert.equal((await db.query("select count(*)::int as n from public.messages where body = 'ada shared'")).rows[0].n, 0);
  assert.equal((await db.query("select access_revoked from public.profiles where id = $1", [A])).rows[0].access_revoked, true);
  assert.deepEqual((await db.query("select raw_user_meta_data from auth.users where id = $1", [A])).rows[0].raw_user_meta_data, { display_name: "Ada" });
  assert.equal((await asUser(db, B, "select public.participant_meeting($1) as point", [shared])).rows[0].point, null);
  assert.equal(await finishDeletion(db, adaRequest.rows[0].id, "delete"), "deleted");
  assert.equal((await db.query("select count(*)::int as n from public.profiles where id = $1", [A])).rows[0].n, 0);

  await asUser(db, D, `
    insert into public.activities
      (id, creator_id, title, place_id, place_label, starts_at, meeting_point, capacity)
    values ($1, $2, 'Reported walk', 'stanley', 'Stanley Park', now() + interval '4 days', 'Gate B', 4)
  `, [created, D]);
  await asUser(db, D, "insert into public.registrations (activity_id, user_id, status) values ($1, $2, 'confirmed')", [created, D]);
  await asUser(db, B, "insert into public.registrations (activity_id, user_id, status) values ($1, $2, 'confirmed')", [created, B]);
  await asUser(db, D, "insert into public.messages (activity_id, user_id, body) values ($1, $2, 'dee private')", [created, D]);
  await asUser(db, B, "insert into public.messages (activity_id, user_id, body) values ($1, $2, 'bo stays')", [created, B]);
  const deeMessage = await asUser(db, D, "select id from public.messages where body = 'dee private'");
  await asUser(db, D, "insert into public.reports (reporter_id, activity_id, message_id, reason) values ($1, $2, $3, 'open report')", [D, created, deeMessage.rows[0].id]);
  await asUser(db, D, "insert into public.deletion_requests (user_id) values ($1)", [D]);
  const deeRequest = await asUser(db, D, "select id from public.deletion_requests where user_id = $1", [D]);
  await db.exec("reset role");
  assert.equal(await prepareDeletion(db, deeRequest.rows[0].id), "anonymized");
  const deeActivity = await db.query("select creator_id, status from public.activities where id = $1", [created]);
  assert.equal(deeActivity.rows[0].creator_id, B);
  assert.equal(deeActivity.rows[0].status, "cancelled");
  assert.equal((await db.query("select count(*)::int as n from public.messages where body = 'bo stays'")).rows[0].n, 1);
  assert.equal((await db.query("select count(*)::int as n from public.messages where body = 'dee private'")).rows[0].n, 0);
  const deeEvidence = await db.query("select author_id, body from private.report_evidence where author_id = $1", [D]);
  assert.equal(deeEvidence.rows[0].body, "dee private");
  const deeProfile = await db.query("select display_name, access_revoked from public.profiles where id = $1", [D]);
  assert.equal(deeProfile.rows[0].display_name, "已删除");
  assert.equal(deeProfile.rows[0].access_revoked, true);
  assert.deepEqual((await db.query("select raw_user_meta_data from auth.users where id = $1", [D])).rows[0].raw_user_meta_data, { display_name: "Dee" });
  assert.equal((await db.query("select status from public.reports where reporter_id = $1", [D])).rows[0].status, "open");
  assert.equal((await asUser(db, D, "select body from public.messages where activity_id = $1", [created])).rows.length, 0);
  await fails(db, D, "insert into public.messages (activity_id, user_id, body) values ($1, $2, 'still here')", [created, D]);
  assert.equal(await finishDeletion(db, deeRequest.rows[0].id, "soft_delete"), "anonymized");
  assert.equal((await db.query("select count(*)::int as n from public.profiles where id = $1", [D])).rows[0].n, 1);
  await db.query("update public.reports set status = 'resolved' where reporter_id = $1", [D]);
  assert.equal((await db.query("select count(*)::int as n from private.report_evidence where author_id = $1", [D])).rows[0].n, 0);

  await asUser(db, B, `
    insert into public.activities
      (id, creator_id, title, place_id, place_label, starts_at, meeting_point, capacity)
    values ($1, $2, 'Eve joins', 'stanley', 'Stanley Park', now() + interval '5 days', 'Gate C', 4)
  `, [joined, B]);
  await asUser(db, B, "insert into public.registrations (activity_id, user_id, status) values ($1, $2, 'confirmed')", [joined, B]);
  await asUser(db, E, "insert into public.registrations (activity_id, user_id, status) values ($1, $2, 'confirmed')", [joined, E]);
  await asUser(db, B, "insert into public.messages (activity_id, user_id, body) values ($1, $2, 'bo host')", [joined, B]);
  await asUser(db, E, "insert into public.messages (activity_id, user_id, body) values ($1, $2, 'eve note')", [joined, E]);
  const eveMessage = await asUser(db, E, "select id from public.messages where body = 'eve note'");
  await asUser(db, E, "insert into public.reports (reporter_id, activity_id, message_id, reason) values ($1, $2, $3, 'participant report')", [E, joined, eveMessage.rows[0].id]);
  await asUser(db, E, "insert into public.deletion_requests (user_id) values ($1)", [E]);
  const eveRequest = await asUser(db, E, "select id from public.deletion_requests where user_id = $1", [E]);
  await db.exec("reset role");
  assert.equal(await prepareDeletion(db, eveRequest.rows[0].id), "anonymized");
  const eveActivity = await db.query("select creator_id, status from public.activities where id = $1", [joined]);
  assert.equal(eveActivity.rows[0].creator_id, B);
  assert.equal(eveActivity.rows[0].status, "open");
  assert.equal((await db.query("select count(*)::int as n from public.messages where body = 'bo host'")).rows[0].n, 1);
  assert.equal((await db.query("select count(*)::int as n from public.messages where body = 'eve note'")).rows[0].n, 0);
  const eveEvidence = await db.query("select author_id, body from private.report_evidence where author_id = $1", [E]);
  assert.equal(eveEvidence.rows[0].body, "eve note");
  assert.equal((await db.query("select access_revoked from public.profiles where id = $1", [E])).rows[0].access_revoked, true);
  assert.deepEqual((await db.query("select raw_user_meta_data from auth.users where id = $1", [E])).rows[0].raw_user_meta_data, { display_name: "Eve" });
  assert.equal((await db.query("select count(*)::int as n from public.registrations where activity_id = $1 and user_id = $2", [joined, B])).rows[0].n, 1);
  const boStillHost = await asUser(db, B, "select title from public.activities where id = $1", [joined]);
  assert.equal(boStillHost.rows[0].title, "Eve joins");
  assert.equal(await finishDeletion(db, eveRequest.rows[0].id, "soft_delete"), "anonymized");
  assert.equal((await db.query("select count(*)::int as n from private.report_evidence where author_id = $1", [E])).rows[0].n, 1);
  assert.equal((await db.query("select status, fulfilled_at is not null as done from public.deletion_requests where id = $1", [eveRequest.rows[0].id])).rows[0].status, "completed");

  await db.close();
});
