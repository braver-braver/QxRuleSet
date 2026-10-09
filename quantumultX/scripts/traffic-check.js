/**
 * QxRuleSet Traffic Check v1.0.0
 * Updated: 2026-10-09T10:57:33+08:00
 * Read-only QX configuration API. No network calls or persistent data.
 */
(function () {
  var policy = String(($environment && $environment.params) || "").trim();
  function esc(x) {
    return String(x == null ? "" : x).replace(/&/g,"&amp;").replace(/</g,"&lt;")
      .replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
  }
  function unit(bytes) {
    var n = Number(bytes);
    if (!Number.isFinite(n) || n < 0) n = 0;
    if (n >= 1024 * 1024 * 1024) return (n / 1073741824).toFixed(2) + " GiB";
    if (n >= 1024 * 1024) return (n / 1048576).toFixed(1) + " MiB";
    if (n >= 1024) return (n / 1024).toFixed(1) + " KiB";
    return n.toFixed(0) + " B";
  }
  function show(html) {
    $done({ title: "📊 策略流量查询", htmlMessage: "<p>" + html + "</p>" });
  }
  function message(action, content) {
    var payload = { action: action };
    if (content !== undefined) payload.content = content;
    return $configuration.sendMessage(payload).then(function (response) {
      if (!response || response.error || !response.ret) throw new Error("API failure");
      return response.ret;
    });
  }

  (async function () {
    if (!policy) { show("请选择需要查询的 QX 策略或节点。"); return; }
    var candidates = [policy];
    try {
      var cfg = await message("get_customized_policy", policy);
      var detail = cfg[policy];
      if (detail && Array.isArray(detail.candidates) && detail.candidates.length) {
        candidates = detail.candidates.filter(function (x) { return typeof x === "string"; });
      }
    } catch (_) {
      // A plain node does not have to be a customized group.
    }
    var stats;
    try {
      stats = await message("get_traffic_statistics");
    } catch (_) {
      show("⚠️ QX 未提供流量统计 API 或无数据。请确认应用版本及当前隧道状态。");
      return;
    }
    var accepted = new Set(candidates);
    var aggregate = {};
    var tcp = { rx: 0, tx: 0 }, udp = { rx: 0, tx: 0 };
    Object.keys(stats).forEach(function (key) {
      var row = stats[key];
      if (!row || !accepted.has(row.name)) return;
      var type = String(row.type || "").toLowerCase();
      if (type !== "tcp" && type !== "udp") return;
      var rx = Number(row.rx_transfer), tx = Number(row.tx_transfer);
      rx = Number.isFinite(rx) && rx > 0 ? rx : 0;
      tx = Number.isFinite(tx) && tx > 0 ? tx : 0;
      var counter = type === "udp" ? udp : tcp;
      counter.rx += rx; counter.tx += tx;
      if (!aggregate[row.name]) aggregate[row.name] = 0;
      aggregate[row.name] += rx + tx;
    });
    var total = tcp.rx + tcp.tx + udp.rx + udp.tx;
    var top = Object.keys(aggregate).map(function (name) {
      return { name: name, bytes: aggregate[name] };
    }).sort(function (a,b) { return b.bytes - a.bytes || a.name.localeCompare(b.name); }).slice(0, 5);
    var rank = top.length ? top.map(function (x,i) {
      return (i+1) + ". " + esc(x.name) + "： " + unit(x.bytes);
    }).join("<br>") : "尚无匹配的节点流量统计";
    show("<b>策略/节点：</b>" + esc(policy) +
      "<br><b>TCP：</b>↓ " + unit(tcp.rx) + " / ↑ " + unit(tcp.tx) +
      "<br><b>UDP：</b>↓ " + unit(udp.rx) + " / ↑ " + unit(udp.tx) +
      "<br><b>统计总量：</b>" + unit(total) +
      "<br><br><b>本次统计 Top " + top.length + "</b><br>" + rank +
      "<br><small>只统计直接候选节点；嵌套策略组可能不完整。数据范围由 QX 提供，不等于机场订阅流量。</small>");
  })().catch(function (_) { show("⚠️ 查询异常，请重试。"); });
})();
