const cfg = window.SHANHAI_PUBLIC || {};
const rules = window.SHANHAI_RULES;

let client = null;
let recoveryMode = false;
async function db() {
  if (!cfg.supabaseUrl || !cfg.supabaseAnonKey) return null;
  if (!client) {
    const mod = await import("https://esm.sh/@supabase/supabase-js@2.45.4");
    client = mod.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: window.localStorage
      }
    });
    client.auth.onAuthStateChange(function (event) {
      if (event === "PASSWORD_RECOVERY") recoveryMode = true;
    });
  }
  return client;
}

function text(el, value) {
  if (el) el.textContent = value;
}

function el(tag, className, value) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (value != null) node.textContent = value;
  return node;
}

function configured() {
  return Boolean(cfg.supabaseUrl && cfg.supabaseAnonKey);
}

function authMessage(error) {
  const msg = (error && error.message) || "";
  if (/already registered|already been registered/i.test(msg)) return "这个邮箱已经注册。请登录，或使用忘记密码。This email is already registered. Sign in or reset the password.";
  if (/email not confirmed/i.test(msg)) return "请先打开验证邮件里的链接。Confirm your email before signing in.";
  if (/invalid login|invalid credentials/i.test(msg)) return "邮箱或密码不正确。Email or password is incorrect.";
  if (/password/i.test(msg) && /at least|weak|short/i.test(msg)) return "密码至少 8 位。Use at least 8 characters.";
  if (/rate limit/i.test(msg)) return "尝试太频繁，请稍后再试。Too many attempts. Please wait and try again.";
  return msg || "没有完成。请再试一次。Something went wrong. Please try again.";
}

async function sessionUser() {
  const supabase = await db();
  if (!supabase) return null;
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) return null;
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    await supabase.auth.signOut({ scope: "local" });
    return null;
  }
  return data.user;
}

async function joinedActivities(user) {
  const { data: regs, error } = await (await db()).from("registrations").select("activity_id").eq("user_id", user.id).eq("status", "confirmed");
  if (error) return { error: error, rows: [] };
  const ids = (regs || []).map(function (row) { return row.activity_id; });
  if (!ids.length) return { error: null, rows: [] };
  const { data, error: activityError } = await (await db()).from("activities").select("id,title,place_label,starts_at,status").in("id", ids);
  return { error: activityError, rows: data || [] };
}

function accountLinks() {
  const bar = el("p", "meta");
  const account = el("a");
  account.href = "/account/";
  account.textContent = "注册或登录 Register or sign in";
  const activities = el("a");
  activities.href = "/activities/";
  activities.textContent = "结伴 Activities";
  bar.append(account, document.createTextNode(" · "), activities);
  return bar;
}

function showSetup(root) {
  root.append(el("div", "note", "结伴报名还没有接上账户服务。浏览地点不需要注册。活动、验证邮件和群聊要等网站运营者接入 Supabase 之后才能用。Account features are not connected yet. Browsing does not require an account."));
  root.append(accountLinks());
}

async function renderAccount(root) {
  root.replaceChildren();
  if (!configured()) {
    showSetup(root);
    return;
  }
  const params = new URLSearchParams(location.search);
  const urlError = params.get("error_description");
  if (urlError) root.append(el("p", "note", urlError));
  const user = await sessionUser();
  if (user && (recoveryMode || location.hash.indexOf("type=recovery") !== -1)) {
    renderNewPassword(root);
    return;
  }
  if (user) {
    await renderSignedIn(root, user);
    return;
  }
  const form = el("form", "stack");
  form.innerHTML = [
    '<label>显示名 Display name<input name="name" required maxlength="40" autocomplete="nickname"></label>',
    '<label>邮箱 Email<input name="email" type="email" required autocomplete="email"></label>',
    '<label>密码 Password<input name="password" type="password" required minlength="8" autocomplete="new-password"></label>',
    '<label><input name="adult" type="checkbox" required> 我已满 18 岁，或由监护人陪同参加。I am 18 or older, or a guardian is responsible for this account.</label>',
    '<label><input name="terms" type="checkbox" required> 我已阅读<a href="/terms/">使用条款</a>、<a href="/privacy/">隐私说明</a>和<a href="/guidelines/">社区准则</a>。</label>',
    '<label><input name="marketing" type="checkbox"> 我愿意接收偶尔的活动通知邮件。可不选。Optional outing emails. Leave this off if you do not want them.</label>',
    '<button class="btn sea" type="submit">注册并发送验证邮件 Create account</button>',
    '<button class="btn ghost" type="button" id="sign-in">登录 Sign in</button>',
    '<p id="account-msg"></p>'
  ].join("");
  const msg = form.querySelector("#account-msg");
  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    const data = new FormData(form);
    const { error } = await (await db()).auth.signUp({
      email: data.get("email"),
      password: data.get("password"),
      options: {
        emailRedirectTo: location.origin + "/account/",
        data: {
          display_name: data.get("name"),
          marketing: data.get("marketing") === "on"
        }
      }
    });
    text(msg, error ? authMessage(error) : "如果邮箱需要验证，请打开邮件里的链接后再登录。Check your email if confirmation is required.");
  });
  form.querySelector("#sign-in").addEventListener("click", async function () {
    const data = new FormData(form);
    const { error } = await (await db()).auth.signInWithPassword({
      email: data.get("email"),
      password: data.get("password")
    });
    text(msg, error ? authMessage(error) : "已登录。Signed in.");
    if (!error) renderAccount(root);
  });
  const forgot = el("button", "btn ghost", "忘记密码 Reset password");
  forgot.type = "button";
  forgot.addEventListener("click", async function () {
    const email = new FormData(form).get("email");
    if (!email) {
      text(msg, "请先填写邮箱。Enter your email first.");
      return;
    }
    const { error } = await (await db()).auth.resetPasswordForEmail(email, { redirectTo: location.origin + "/account/" });
    text(msg, error ? authMessage(error) : "如果这个邮箱已注册，你会收到重置链接。If this email is registered, a reset link is on its way.");
  });
  form.append(forgot);
  root.append(form);
}

function renderNewPassword(root) {
  const form = el("form", "stack");
  form.innerHTML = '<h2>设置新密码</h2><label>新密码 New password<input name="password" type="password" required minlength="8" autocomplete="new-password"></label><button class="btn sea" type="submit">保存 Save</button><p id="account-msg"></p>';
  const msg = form.querySelector("#account-msg");
  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    const { error } = await (await db()).auth.updateUser({ password: new FormData(form).get("password") });
    text(msg, error ? authMessage(error) : "密码已更新。Password updated.");
    if (!error) {
      recoveryMode = false;
      history.replaceState(null, "", "/account/");
      renderAccount(root);
    }
  });
  root.append(form);
}

async function renderSignedIn(root, user) {
  const { data: profile } = await (await db()).from("profiles").select("display_name").eq("id", user.id).maybeSingle();
  root.append(el("p", "", "已登录 Signed in: " + ((profile && profile.display_name) || "家人")));
  root.append(el("p", "meta", "邮箱只保存在账户服务里，其他参加者看不到。Your email stays in the account service and is not shown to other participants."));
  const nameForm = el("form", "stack");
  nameForm.innerHTML = '<label>显示名 Display name<input name="name" required maxlength="40" autocomplete="nickname"></label><button class="btn sea" type="submit">保存显示名 Save name</button><p id="name-msg"></p>';
  nameForm.querySelector("input").value = (profile && profile.display_name) || "";
  nameForm.addEventListener("submit", async function (event) {
    event.preventDefault();
    const name = new FormData(nameForm).get("name");
    const { error } = await (await db()).from("profiles").update({ display_name: name }).eq("id", user.id);
    text(nameForm.querySelector("#name-msg"), error ? authMessage(error) : "已保存。Saved.");
  });
  root.append(nameForm);
  const mine = el("div", "panel");
  mine.append(el("h2", "", "我参加的 Joined"));
  const joined = await joinedActivities(user);
  if (joined.error) mine.append(el("p", "note", authMessage(joined.error)));
  else if (!joined.rows.length) mine.append(el("p", "", "你还没有参加活动。You have not joined an activity."));
  else joined.rows.forEach(function (activity) {
    const link = el("a");
    link.href = "/activities/view/?id=" + encodeURIComponent(activity.id);
    link.textContent = activity.title + (activity.status === "cancelled" ? " · 已取消 Cancelled" : "");
    const row = el("p", "");
    row.append(link);
    mine.append(row);
  });
  root.append(mine);
  const password = el("form", "stack");
  password.innerHTML = '<label>修改密码 New password<input name="password" type="password" required minlength="8" autocomplete="new-password"></label><button class="btn ghost" type="submit">更新密码 Update password</button><p id="password-msg"></p>';
  password.addEventListener("submit", async function (event) {
    event.preventDefault();
    const { error } = await (await db()).auth.updateUser({ password: new FormData(password).get("password") });
    text(password.querySelector("#password-msg"), error ? authMessage(error) : "密码已更新。Password updated.");
    if (!error) password.reset();
  });
  root.append(password);
  const remove = el("button", "btn ghost", "申请删除账户 Request deletion");
  remove.type = "button";
  const removeMsg = el("p", "");
  remove.addEventListener("click", async function () {
    const { error } = await (await db()).from("deletion_requests").insert({ user_id: user.id });
    text(removeMsg, error && !/duplicate|unique/i.test(error.message) ? authMessage(error) : "已记录删除申请。运营者会删除账户，相关报名和消息会一并删除。Deletion requested. The operator will delete the account and its registrations and messages.");
  });
  root.append(remove, removeMsg);
  const out = el("button", "btn ghost", "退出 Sign out");
  out.type = "button";
  out.addEventListener("click", async function () {
    await (await db()).auth.signOut({ scope: "local" });
    location.href = "/account/";
  });
  root.append(out);
}

async function renderActivities(root) {
  root.replaceChildren();
  root.append(el("p", "lede", "不注册也可以看地点和已公开的活动。注册后才能发起或参加。"));
  root.append(el("p", "alt-lang", "You can browse without an account. Creating or joining an activity requires sign-in."));
  if (!configured()) {
    showSetup(root);
    return;
  }
  const user = await sessionUser();
  root.append(accountLinks());
  if (user) {
    const mine = el("div", "panel");
    mine.append(el("h2", "", "我参加的 Joined"));
    const joined = await joinedActivities(user);
    if (joined.error) mine.append(el("p", "note", authMessage(joined.error)));
    else if (!joined.rows.length) mine.append(el("p", "", "你还没有参加活动。You have not joined an activity."));
    else joined.rows.forEach(function (activity) {
      const link = el("a");
      link.href = "/activities/view/?id=" + encodeURIComponent(activity.id);
      link.textContent = activity.title;
      const row = el("p", "");
      row.append(link);
      mine.append(row);
    });
    root.append(mine, createForm(user));
  }
  const list = el("div", "grid");
  root.append(list);
  const { data, error } = await (await db()).from("activities").select("id,title,place_label,starts_at,meeting_point,capacity,status").order("starts_at");
  if (error) {
    list.append(el("p", "note", error.message));
    return;
  }
  const { data: people } = await (await db()).from("activity_people").select("activity_id,display_name");
  (data || []).forEach(function (activity) {
    const names = (people || []).filter(function (row) { return row.activity_id === activity.id; });
    const card = el("article", "card");
    const link = el("a", "card-link");
    link.href = "/activities/view/?id=" + encodeURIComponent(activity.id);
    link.append(el("h3", "", activity.title));
    link.append(el("p", "", activity.place_label));
    link.append(el("p", "alt-lang", new Date(activity.starts_at).toLocaleString()));
    link.append(el("p", "meta", names.length + " / " + activity.capacity + (activity.status === "cancelled" ? " · 已取消 Cancelled" : "")));
    card.append(link);
    list.append(card);
  });
  if (!(data || []).length) list.append(el("p", "", "还没有活动。No activities yet."));
}

function createForm(user) {
  const form = el("form", "stack");
  form.innerHTML = [
    '<h2>发起一次结伴</h2>',
    '<label>标题 Title<input name="title" required maxlength="80"></label>',
    '<label>地点 Place<select name="place" required></select></label>',
    '<label>时间 When<input name="when" type="datetime-local" required></label>',
    '<label>集合点 Meeting point<input name="meet" required maxlength="160" placeholder="公共场所，例如停车场入口"></label>',
    '<p class="meta">请写公共场所。不要写家庭住址或电话。Use a public place. Do not enter a home address or phone number.</p>',
    '<label>人数上限 Capacity<input name="capacity" type="number" min="2" max="12" value="6" required></label>',
    '<button class="btn sea" type="submit">发布 Publish</button>',
    '<p id="create-msg"></p>'
  ].join("");
  const select = form.querySelector("select");
  fetch("/places.json").then(function (res) { return res.json(); }).then(function (places) {
    const preset = new URLSearchParams(location.search).get("place");
    places.forEach(function (place) {
      const option = el("option", "", place.zh + " " + place.en);
      option.value = place.id + "\t" + place.zh + " " + place.en;
      if (place.id === preset) option.selected = true;
      select.append(option);
    });
  });
  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    const data = new FormData(form);
    const parts = String(data.get("place")).split("\t");
    const { data: created, error } = await (await db()).from("activities").insert({
      creator_id: user.id,
      title: data.get("title"),
      place_id: parts[0],
      place_label: parts[1],
      starts_at: new Date(data.get("when")).toISOString(),
      meeting_point: data.get("meet"),
      capacity: Number(data.get("capacity"))
    }).select("id").single();
    if (error) {
      text(form.querySelector("#create-msg"), error.message);
      return;
    }
    await (await db()).from("registrations").insert({ activity_id: created.id, user_id: user.id, status: "confirmed" });
    location.href = "/activities/view/?id=" + created.id;
  });
  return form;
}

let liveChannel = null;

async function closeChannel() {
  if (!liveChannel) return;
  const current = liveChannel;
  liveChannel = null;
  try { await (await db()).removeChannel(current); } catch (err) { /* already closed */ }
}

async function renderActivity(root) {
  await closeChannel();
  root.replaceChildren();
  const id = new URLSearchParams(location.search).get("id") || "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    root.append(el("p", "", "缺少活动编号。Missing activity."));
    return;
  }
  if (!configured()) {
    showSetup(root);
    return;
  }
  const { data: activity, error } = await (await db()).from("activities").select("*").eq("id", id).maybeSingle();
  if (error || !activity) {
    root.append(el("p", "note", error ? error.message : "找不到这次活动。Activity not found."));
    return;
  }
  root.append(el("h1", "", activity.title));
  root.append(el("p", "", activity.place_label));
  root.append(el("p", "alt-lang", new Date(activity.starts_at).toLocaleString() + " · " + activity.meeting_point));
  const user = await sessionUser();
  const { data: regs } = user
    ? await (await db()).from("registrations").select("user_id,status").eq("activity_id", id)
    : { data: [] };
  const registrations = (regs || []).map(function (row) { return { userId: row.user_id, status: row.status }; });
  const { data: people } = await (await db()).from("activity_people").select("display_name").eq("activity_id", id);
  const peopleBox = el("div", "panel");
  peopleBox.append(el("h2", "", "参加者 Participants"));
  (people || []).forEach(function (person) { peopleBox.append(el("p", "", person.display_name)); });
  peopleBox.append(el("p", "meta", (people || []).length + " / " + activity.capacity));
  root.append(peopleBox);
  if (activity.status === "cancelled") root.append(el("div", "note", "这次活动已取消。This activity was cancelled."));
  const visible = registrations.slice();
  const seen = visible.filter(function (row) { return row.status === "confirmed"; }).length;
  for (let i = seen; i < (people || []).length; i += 1) visible.push({ userId: "hidden-" + i, status: "confirmed" });
  const decision = rules.canRegister(activity, visible, user && user.id);
  if (!user) root.append(accountLinks());
  else if (decision.ok) {
    const join = el("button", "btn sea", "我参加 Join");
    join.type = "button";
    join.addEventListener("click", async function () {
      const { error: joinError } = await (await db()).from("registrations").upsert({ activity_id: id, user_id: user.id, status: "confirmed" });
      text(root.querySelector("#join-msg"), joinError ? joinError.message : "已报名。Joined.");
      if (!joinError) renderActivity(root);
    });
    root.append(join, el("p", "", ""));
    root.lastChild.id = "join-msg";
  } else if (decision.reason === "duplicate") {
    root.append(el("p", "", "你已经报名，不能重复参加。You are already registered."));
    const cancel = el("button", "btn ghost", "取消报名 Cancel my place");
    cancel.type = "button";
    cancel.addEventListener("click", async function () {
      await (await db()).from("registrations").update({ status: "cancelled" }).eq("activity_id", id).eq("user_id", user.id);
      renderActivity(root);
    });
    root.append(cancel);
  }
  if (user && user.id === activity.creator_id && activity.status === "open") {
    const stop = el("button", "btn ghost", "取消这次活动 Cancel activity");
    stop.type = "button";
    stop.addEventListener("click", async function () {
      await (await db()).from("activities").update({ status: "cancelled" }).eq("id", id);
      renderActivity(root);
    });
    root.append(stop);
  }
  const chat = el("section", "panel");
  chat.append(el("h2", "", "群聊 Chat"));
  chat.append(el("p", "meta", "在公共场所见面。不要在这里留下电话、家庭住址，也不要单独约未成年人。Meet in public. Do not leave a phone number or home address, and do not arrange to meet a minor alone."));
  const joined = registrations.some(function (row) { return user && row.userId === user.id && row.status === "confirmed"; });
  if (activity.status !== "open" || (people || []).length < 2) {
    chat.append(el("p", "", "还在等另一位参加者。Waiting for another participant."));
  } else if (!joined) {
    chat.append(el("p", "", "只有已报名的参加者可以进入群聊。Only registered participants can read the chat."));
  } else {
    const { data: blockRows } = await (await db()).from("blocks").select("blocker_id,blocked_id").eq("blocker_id", user.id);
    const blocks = (blockRows || []).map(function (row) { return { blockerId: row.blocker_id, blockedId: row.blocked_id }; });
    const log = el("div", "stack");
    log.id = "chat-log";
    const form = el("form", "stack");
    form.innerHTML = '<label>消息 Message<textarea name="body" required maxlength="1000"></textarea></label><button class="btn sea" type="submit">发送 Send</button>';
    form.addEventListener("submit", async function (event) {
      event.preventDefault();
      const body = String(new FormData(form).get("body") || "").trim();
      if (!body) return;
      const { error: postError } = await (await db()).from("messages").insert({ activity_id: id, user_id: user.id, body: body });
      if (postError) log.append(el("p", "note", postError.message));
      else form.reset();
      if (window.Notification && Notification.permission === "default") Notification.requestPermission();
    });
    const report = el("button", "btn ghost", "举报 Report");
    report.type = "button";
    report.addEventListener("click", async function () {
      const reason = window.prompt("请写下举报原因 Reason");
      if (!reason) return;
      await (await db()).from("reports").insert({ reporter_id: user.id, activity_id: id, reason: reason.slice(0, 500) });
      chat.append(el("p", "", "已提交给运营者，其他参加者看不到这条举报。Report sent privately."));
    });
    chat.append(log, form, report);
    const { data: messages } = await (await db()).from("messages").select("id,user_id,body,created_at").eq("activity_id", id).order("created_at");
    (messages || []).forEach(function (message) {
      if (!rules.hiddenByBlock(message.user_id, user.id, blocks)) appendMessage(log, message, user.id, blocks);
    });
    liveChannel = (await db()).channel("activity-" + id);
    liveChannel.on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: "activity_id=eq." + id }, function (payload) {
      if (!payload.new || payload.new.activity_id !== id) return;
      if (rules.hiddenByBlock(payload.new.user_id, user.id, blocks)) return;
      appendMessage(log, payload.new, user.id, blocks);
      if (payload.new.user_id !== user.id && document.hidden && window.Notification && Notification.permission === "granted") {
        new Notification("山海周末", { body: "结伴群里有一条新消息。A new activity message." });
      }
    }).subscribe();
  }
  root.append(chat);
}

function appendMessage(log, message, myId, blocks) {
  const row = el("p", "");
  row.dataset.author = message.user_id;
  row.append(el("strong", "", message.user_id === myId ? "我 Me" : "参加者"));
  row.append(document.createTextNode(" " + message.body));
  const block = el("button", "btn small ghost", "屏蔽 Block");
  block.type = "button";
  if (message.user_id !== myId) {
    block.addEventListener("click", async function () {
      await (await db()).from("blocks").insert({ blocker_id: myId, blocked_id: message.user_id });
      blocks.push({ blockerId: myId, blockedId: message.user_id });
      log.querySelectorAll("[data-author]").forEach(function (item) {
        if (item.dataset.author === message.user_id) item.remove();
      });
    });
    row.append(document.createTextNode(" "), block);
  }
  log.append(row);
}

const accountRoot = document.getElementById("account-root");
const activityList = document.getElementById("activity-list");
const activityRoot = document.getElementById("activity-root");
if (accountRoot) renderAccount(accountRoot);
if (activityList) renderActivities(activityList);
if (activityRoot) renderActivity(activityRoot);
