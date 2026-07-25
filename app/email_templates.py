WEEKLY_REPORT_HTML = """\
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif">
<table width="100%%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden">
<tr><td style="padding:24px;background:linear-gradient(135deg,#667eea,#764ba2);text-align:center">
<h1 style="color:#fff;margin:0;font-size:22px">Creator Content Radar</h1>
<p style="color:rgba(255,255,255,.8);margin:8px 0 0;font-size:14px">Your Weekly Report</p>
</td></tr>
<tr><td style="padding:24px">
<p style="color:#555;font-size:14px;line-height:1.6">Hi there,</p>
<p style="color:#555;font-size:14px;line-height:1.6">Here are your latest channel analyses from the past week:</p>
<table width="100%%" cellpadding="0" cellspacing="0" style="margin-top:16px">
<tr><th style="text-align:left;padding:8px 12px;background:#f8f8f8;font-size:12px;color:#888;text-transform:uppercase">Channel</th>
<th style="text-align:left;padding:8px 12px;background:#f8f8f8;font-size:12px;color:#888;text-transform:uppercase">Topic</th>
<th style="text-align:left;padding:8px 12px;background:#f8f8f8;font-size:12px;color:#888;text-transform:uppercase">Date</th></tr>
__ROWS__
</table>
<p style="color:#555;font-size:14px;line-height:1.6;margin-top:24px">
<a href="__APP_URL__" style="display:inline-block;padding:12px 24px;background:#667eea;color:#fff;text-decoration:none;border-radius:4px;font-size:14px">Go to Dashboard</a>
</p>
</td></tr>
<tr><td style="padding:16px 24px;background:#f8f8f8;text-align:center;font-size:12px;color:#aaa">
Creator Content Radar &mdash; AI-powered YouTube growth tools
</td></tr>
</table>
</td></tr></table>
</body>
</html>"""


def render_weekly_report(data: dict) -> str:
    rows_html = ""
    for r in data.get("reports", []):
        title = r.get("channel_title", r.get("channel_url", "Unknown"))
        topic = r.get("topic", "-")
        date = r.get("created_at", "")[:10]
        rows_html += (
            f'<tr><td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:14px;color:#333">{title}</td>'
            f'<td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:14px;color:#666">{topic}</td>'
            f'<td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:14px;color:#999">{date}</td></tr>'
        )
    if not rows_html:
        rows_html = '<tr><td colspan="3" style="padding:12px;text-align:center;color:#999;font-size:14px">No new analyses this week</td></tr>'

    app_url = data.get("app_url", "https://creator-content-radar-2.onrender.com")
    html = WEEKLY_REPORT_HTML.replace("__ROWS__", rows_html).replace("__APP_URL__", app_url)
    return html


def render_alert_email(alert_type: str, message: str, app_url: str = "") -> str:
    url = app_url or "https://creator-content-radar-2.onrender.com"
    return f"""\
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden">
<tr><td style="padding:24px;background:linear-gradient(135deg,#667eea,#764ba2);text-align:center">
<h1 style="color:#fff;margin:0;font-size:22px">\u26a0\ufe0f {alert_type.replace('_', ' ').title()}</h1>
</td></tr>
<tr><td style="padding:24px">
<p style="color:#555;font-size:14px;line-height:1.6">{message}</p>
<p style="margin-top:24px">
<a href="{url}" style="display:inline-block;padding:12px 24px;background:#667eea;color:#fff;text-decoration:none;border-radius:4px;font-size:14px">View Details</a>
</p>
</td></tr>
</table>
</td></tr></table>
</body>
</html>"""
