/**
 * QxRuleSet Interactive Geo Query v1.0.0
 * Updated: 2026-10-09T10:57:33+08:00
 * Queries ONLY the selected QX policy's exit, not device GPS coordinates.
 */
(function () {
  var policy = String(($environment && $environment.params) || "").trim();
  var title = "🌍 地理位置检测";
  function esc(x) {
    return String(x == null ? "" : x).replace(/&/g,"&amp;").replace(/</g,"&lt;")
      .replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
  }
  function flag(code) {
    var c = String(code || "").toUpperCase();
    return /^[A-Z]{2}$/.test(c)
      ? String.fromCodePoint(127462 + c.charCodeAt(0)-65,127462 + c.charCodeAt(1)-65) : "🌐";
  }
  function done(html) { $done({ title: title, htmlMessage: "<p>" + html + "</p>" }); }
  function fetchPolicy(url) {
    return new Promise(function (resolve, reject) {
      var finished = false;
      var timer = setTimeout(function () {
        if (finished) return;
        finished = true;
        reject(new Error("timeout"));
      }, 5500);
      try {
        $task.fetch({ url: url, opts: { policy: policy }, headers: { "Accept": "application/json,text/plain" } })
          .then(function (response) {
            if (finished) return;
            finished = true; clearTimeout(timer); resolve(response);
          }, function (error) {
            if (finished) return;
            finished = true; clearTimeout(timer); reject(error);
          });
      } catch (error) { if (!finished) { finished = true; clearTimeout(timer); reject(error); } }
    });
  }

  (async function () {
    if (!policy) { done("请从 Quantumult X 策略/节点的交互菜单启动查询。"); return; }
    try {
      var response = await fetchPolicy("https://ipwho.is/");
      if (Number(response.statusCode) !== 200) throw new Error("HTTP " + response.statusCode);
      var data = JSON.parse(response.body || "{}");
      if (!data || data.success !== true || !data.ip) throw new Error("invalid data");
      var area = [data.country, data.region, data.city].filter(Boolean).join(" · ");
      var conn = data.connection || {};
      var name = conn.isp || conn.org || "未知";
      var asn = conn.asn == null ? "未知" : "AS" + conn.asn;
      done("<b>策略：</b>" + esc(policy) + "<br><b>出口 IP：</b>" + esc(data.ip) +
        "<br><b>位置：</b>" + flag(data.country_code) + " " + esc(area || "未知") +
        "<br><b>ASN：</b>" + esc(asn) + "<br><b>运营商：</b>" + esc(name) +
        "<br><small>数据源：ipwho.is。IP 地理位置不是设备 GPS。</small>");
    } catch (_) {
      // Fallback is intentionally country/IP only; never invent city/ASN.
      try {
        var trace = await fetchPolicy("https://www.cloudflare.com/cdn-cgi/trace");
        if (Number(trace.statusCode) !== 200) throw new Error("trace status");
        var body = String(trace.body || "");
        var ip = (body.match(/^ip=([^\r\n]+)/m) || [])[1] || "";
        var country = (body.match(/^loc=([A-Z]{2})$/m) || [])[1] || "";
        if (!ip && !country) throw new Error("empty trace");
        done("<b>策略：</b>" + esc(policy) + "<br><b>出口 IP：</b>" + esc(ip || "未知") +
          "<br><b>Cloudflare 区域：</b>" + flag(country) + " " + esc(country || "未知") +
          "<br><small>ipwho.is 不可用，已降级为 Cloudflare Trace；没有城市/ASN 数据。</small>");
      } catch (_) {
        done("<b>策略：</b>" + esc(policy) +
          "<br>⚠️ 地理信息暂不可用（网络超时、API 限流或解析失败）；不代表该节点不可用。");
      }
    }
  })().catch(function (_) { done("⚠️ 查询发生异常，请重试。"); });
})();
