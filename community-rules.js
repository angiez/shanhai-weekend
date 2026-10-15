(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.SHANHAI_RULES = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  function confirmed(registrations) {
    return (registrations || []).filter(function (row) {
      return row && row.status === "confirmed" && row.userId;
    });
  }

  function chatUnlocked(registrations) {
    const ids = {};
    confirmed(registrations).forEach(function (row) { ids[row.userId] = true; });
    return Object.keys(ids).length >= 2;
  }

  function canRegister(activity, registrations, userId) {
    if (!activity || activity.status !== "open") return { ok: false, reason: "closed" };
    if (!userId) return { ok: false, reason: "signed-out" };
    const rows = confirmed(registrations);
    if (rows.some(function (row) { return row.userId === userId; })) return { ok: false, reason: "duplicate" };
    if (rows.length >= Number(activity.capacity)) return { ok: false, reason: "full" };
    return { ok: true, reason: "ok" };
  }

  function canReadChat(activity, registrations, userId) {
    if (!activity || activity.status !== "open") return false;
    if (!chatUnlocked(registrations)) return false;
    return confirmed(registrations).some(function (row) { return row.userId === userId; });
  }

  function hiddenByBlock(authorId, userId, blocks) {
    return (blocks || []).some(function (block) {
      return (block.blockerId === userId && block.blockedId === authorId)
        || (block.blockerId === authorId && block.blockedId === userId);
    });
  }

  function canPost(activity, registrations, userId) {
    return canReadChat(activity, registrations, userId);
  }

  return { confirmed: confirmed, chatUnlocked: chatUnlocked, canRegister: canRegister, canReadChat: canReadChat, canPost: canPost, hiddenByBlock: hiddenByBlock };
});
