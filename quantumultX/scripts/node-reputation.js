/**
 * QxRuleSet Node Reputation Clues v1.0.0
 * Updated: 2026-10-09T10:57:33+08:00
 * This is NOT an IP purity score. Free public data only checks limited signals.
 */
(function () {
  var policy = String(($environment && $environment.params) || "").trim();
  var title = "🧪 节点纯净度查询";
  function esc(x) {
    return String(x == null ? "" : x).replace(/&/g,"&amp;").replace(/</g,"&lt;")
      .replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
  }
  function show(html) { $done({ title: title, htmlMessage: "<p>" + html + "</p>" }); }
  function query(url) {
    return new Promise(function (resolve, reject) {
      var settled = false;
      var timer = setTimeout(function () {
        if (settled) return;
        settled = true; reject(new Error("timeout"));
      }, 5000);
      try {
        $task.fetch({ url: url, opts: { policy: policy }, headers: { Accept: "application/json" } })
          .then(function (res) {
            if (settled) return;
            settled = true; clearTimeout(timer); resolve(res);
          }, function (err) {
            if (settled) return;
            settled = true; clearTimeout(timer); reject(err);
          });
      } catch (error) { if (!settled) { settled = true; clearTimeout(timer); reject(error); } }
    });
  }
  function validIP(value) {
    var s = String(value || "");
    if (/^(?:\d{1,3}\.){3}\d{1,3}$/.test(s))
      return s.split(".").every(function (octet) { return Number(octet) <= 255; });
    // IPv6 can contain colons and dots (IPv4-mapped), never arbitrary URLs.
    return s.length <= 45 && s.indexOf(":") !== -1 && /^[\da-fA-F:.]+$/.test(s);
  }

  (async function () {
    if (!policy) { show("请从节点或策略的交互菜单启动查询。"); return; }
    var info;
    try {
      var geo = await query("https://ipwho.is/");
      if (Number(geo.statusCode) !== 200) throw new Error("geo status");
      info = JSON.parse(geo.body || "{}");
      if (!info || info.success !== true || !validIP(info.ip)) throw new Error("geo data");
    } catch (_) {
      show("<b>策略：</b>" + esc(policy) +
        "<br>⚠️ 无法获取出口 IP（网络失败、接口限流或解析错误）。未生成任何纯净度结论。");
      return;
    }
    var conn = info.connection || {};
    var text = "<b>策略：</b>" + esc(policy) + "<br><b>出口 IP：</b>" + esc(info.ip) +
      "<br><b>地理位置：</b>" + esc([info.country, info.region, info.city].filter(Boolean).join(" · ") || "未知") +
      "<br><b>ASN：</b>" + esc(conn.asn == null ? "未知" : "AS" + conn.asn) +
      "<br><b>网络运营商：</b>" + esc(conn.isp || conn.org || "未知");
    try {
      // Explicit IP keeps the lookup tied to the initial observed exit.
      var response = await query("https://api.ip2location.io/?ip=" + encodeURIComponent(info.ip));
      if (Number(response.statusCode) !== 200) throw new Error("reputation status");
      var risk = JSON.parse(response.body || "{}");
      if (!risk || risk.error) throw new Error("reputation data");
      if (risk.is_proxy === true) {
        text += "<br><b>公开代理线索：</b>检测到开放代理标记 ⚠️";
      } else if (risk.is_proxy === false) {
        text += "<br><b>公开代理线索：</b>未检出开放代理标记（不代表纯净或住宅）";
      } else {
        text += "<br><b>公开代理线索：</b>免费接口未提供";
      }
    } catch (_) {
      text += "<br><b>公开代理线索：</b>暂不可用（API 限流/网络失败）";
    }
    text += "<br><small>ipwho.is + IP2Location.io 免费数据；不检测平台风控、完整 VPN/机房风险，也不生成“纯净度百分比”。</small>";
    show(text);
  })().catch(function (_) { show("⚠️ 查询异常，不生成纯净度判断。"); });
})();
