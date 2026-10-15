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

test("two accounts cannot read chat until both join, and outsiders stay out", async function () {
  const { PGlite } = await import("@electric-sql/pglite");
  const db = new PGlite();
  await db.exec(`
    create schema if not exists auth;
    create table auth.users (
      id uuid primary key,
      raw_user_meta_data jsonb
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

  await asUser(db, B, "update public.registrations set status = 'confirmed' where activity_id = $1 and user_id = $2", [ACT, B]);
  await asUser(db, B, "insert into public.messages (activity_id, user_id, body) values ($1, $2, 'hello from bo')", [ACT, B]);
  await asUser(db, A, "insert into public.blocks (blocker_id, blocked_id) values ($1, $2)", [A, B]);
  const adaSees = await asUser(db, A, "select body from public.messages where activity_id = $1", [ACT]);
  const boSees = await asUser(db, B, "select body from public.messages where activity_id = $1", [ACT]);
  assert.deepEqual(adaSees.rows.map(function (row) { return row.body; }), ["hello from ada"]);
  assert.deepEqual(boSees.rows.map(function (row) { return row.body; }), ["hello from bo"]);

  await asUser(db, A, "insert into public.reports (reporter_id, activity_id, reason) values ($1, $2, 'test report')", [A, ACT]);
  await fails(db, A, "select reason from public.reports");
  await fails(db, B, "select reason from public.reports");
  await db.exec("reset role");
  const operator = await db.query("select reason from public.reports");
  assert.deepEqual(operator.rows.map(function (row) { return row.reason; }), ["test report"]);

  await asUser(db, A, "update public.activities set status = 'cancelled' where id = $1", [ACT]);
  const afterCancel = await asUser(db, A, "select public.chat_open($1) as open", [ACT]);
  assert.equal(afterCancel.rows[0].open, false);
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
  await db.exec("set role anon");
  await assert.rejects(function () { return db.query("select * from public.profiles"); });
  await assert.rejects(function () { return db.query("select * from public.messages"); });
  await assert.rejects(function () { return db.query("select * from public.registrations"); });
  await assert.rejects(function () { return db.query("select * from public.activity_people"); });
  const publicCount = await db.query("select participants from public.activity_counts where activity_id = $1", [ACT]);
  assert.equal(publicCount.rows[0].participants, 2);
  await db.exec("reset role");

  await db.close();
});
