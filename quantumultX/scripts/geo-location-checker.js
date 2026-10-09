/**
 * QxRuleSet Geo Location Checker v1.0.0
 * Updated: 2026-10-09T10:57:33+08:00
 * [general] geo_location_checker=https://ipwho.is/, <this-script-URL>
 * QX injects $response; this script makes NO additional network requests.
 */
(function () {
  function str(value) { return typeof value === "string" ? value.trim() : ""; }
  function flag(code) {
    var s = str(code).toUpperCase();
    if (!/^[A-Z]{2}$/.test(s)) return "🌐";
    return String.fromCodePoint(127462 + s.charCodeAt(0) - 65, 127462 + s.charCodeAt(1) - 65);
  }
  try {
    var response = typeof $response === "object" && $response ? $response : {};
    var status = Number(response.statusCode == null ? response.status : response.statusCode);
    if (status !== 200) { $done(null); return; }
    var data = JSON.parse(response.body || "{}");
    if (!data || data.success !== true || !str(data.ip)) { $done(null); return; }

    var connection = data.connection || {};
    var timezone = data.timezone || {};
    var area = [str(data.country), str(data.region), str(data.city)].filter(Boolean);
    var title = flag(data.country_code) + " " + (area[0] || str(data.country_code) || "未知地区");
    var subtitle = [str(data.region), str(data.city)].filter(Boolean).join(" · ");
    var lines = [
      "位置：" + (area.join(" · ") || "未知"),
      "出口 IP：" + str(data.ip),
      "ASN：" + (connection.asn == null ? "未知" : "AS" + String(connection.asn)),
      "运营商：" + (str(connection.isp) || str(connection.org) || "未知"),
      "时区：" + (str(timezone.id) || "未知"),
      "数据源：ipwho.is（IP 地理位置是近似信息）"
    ];
    $done({ title: title, subtitle: subtitle, ip: str(data.ip), description: lines.join("\n") });
  } catch (_) {
    // A provider failure, malformed JSON or QX schema difference must not
    // create invented geolocation/flag data.
    $done(null);
  }
})();
