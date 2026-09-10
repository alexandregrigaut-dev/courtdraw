#!/usr/bin/env python3
# scripts/generate-guides.py
# Generates CourtDraw /guides/ articles from the shared template below.
# Run: python3 scripts/generate-guides.py
"""Renders the GUIDES list into <slug>/index.html using the same design
system as the sport-tactics-board pages. Content-only script (no deps)."""

import json
import os

BASE = os.path.join(os.path.dirname(__file__), "..")

LOGO_SVG = """<svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="28" height="28" rx="6" fill="#3b82f6"/>
  <rect x="2" y="8.5" width="24" height="11" rx="1" fill="#1d4ed8"/>
  <rect x="2" y="8.5" width="24" height="11" rx="1" stroke="white" stroke-width="0.9"/>
  <line x1="14" y1="8.5" x2="14" y2="19.5" stroke="white" stroke-width="0.9"/>
  <line x1="7.5" y1="9.8" x2="7.5" y2="18.2" stroke="white" stroke-width="0.75"/>
  <line x1="20.5" y1="9.8" x2="20.5" y2="18.2" stroke="white" stroke-width="0.75"/>
  <line x1="2" y1="9.8" x2="26" y2="9.8" stroke="white" stroke-width="0.75"/>
  <line x1="2" y1="18.2" x2="26" y2="18.2" stroke="white" stroke-width="0.75"/>
  <line x1="7.5" y1="14" x2="20.5" y2="14" stroke="white" stroke-width="0.75"/>
  <line x1="2" y1="14" x2="2.7" y2="14" stroke="white" stroke-width="0.75"/>
  <line x1="26" y1="14" x2="25.3" y2="14" stroke="white" stroke-width="0.75"/>
</svg>"""

STYLE = """
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --bg: #0a1628; --bg2: #0d1f3c; --bg3: #1a2d4a;
      --border: #1a2d4a; --border2: #2a3f5c;
      --text: #f1f5f9; --muted: #94a3b8;
      --accent: #3b82f6; --accent-glow: rgba(59,130,246,0.18);
      --radius: 14px; --radius-lg: 22px;
    }
    html { scroll-behavior: smooth; }
    body { background: var(--bg); color: var(--text); font-family: 'Plus Jakarta Sans', system-ui, sans-serif; line-height: 1.6; -webkit-font-smoothing: antialiased; }
    a { color: inherit; text-decoration: none; }
    img, svg { display: block; }
    .container { max-width: 1160px; margin: 0 auto; padding: 0 24px; }
    .badge { display: inline-flex; align-items: center; gap: 6px; background: rgba(59,130,246,0.12); border: 1px solid rgba(59,130,246,0.3); color: var(--accent); border-radius: 100px; padding: 4px 14px; font-size: 0.78rem; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; }
    .badge-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--accent); animation: pulse 2s infinite; }
    @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
    .btn { display: inline-flex; align-items: center; gap: 8px; font-family: inherit; font-weight: 700; border-radius: 12px; cursor: pointer; transition: all .18s; border: none; text-decoration: none; }
    .btn-primary { background: var(--accent); color: #fff; padding: 14px 28px; font-size: 1rem; }
    .btn-primary:hover { background: #60a5fa; transform: translateY(-1px); box-shadow: 0 8px 30px rgba(59,130,246,0.4); }
    .btn-ghost { background: transparent; color: var(--text); border: 1.5px solid var(--border2); padding: 13px 26px; font-size: 1rem; }
    .btn-ghost:hover { border-color: var(--accent); color: var(--accent); }
    .btn-lg { padding: 18px 36px; font-size: 1.1rem; border-radius: 14px; }
    .gradient-text { background: linear-gradient(135deg,#3b82f6 0%,#60a5fa 50%,#93c5fd 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
    nav { position: sticky; top: 0; z-index: 100; background: rgba(10,22,40,0.85); backdrop-filter: blur(16px); border-bottom: 1px solid var(--border); }
    .nav-inner { display: flex; align-items: center; justify-content: space-between; height: 64px; }
    .nav-logo { display: flex; align-items: center; gap: 10px; font-size: 1.3rem; font-weight: 800; letter-spacing: -0.03em; }
    .nav-logo-mark { width: 34px; height: 34px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .nav-links { display: flex; align-items: center; gap: 8px; }
    .nav-links a { color: var(--muted); font-size: 0.9rem; font-weight: 500; padding: 6px 12px; border-radius: 8px; transition: color .15s; }
    .nav-links a:hover, .nav-links a.active { color: var(--text); }
    .nav-cta { display: flex; align-items: center; gap: 10px; }
    @media (max-width: 680px) { .nav-links { display: none; } }
    footer { border-top: 1px solid var(--border); padding: 48px 0 32px; }
    .footer-grid { display: grid; grid-template-columns: 2fr 1fr 1fr 1fr; gap: 48px; margin-bottom: 32px; }
    @media (max-width: 780px) { .footer-grid { grid-template-columns: 1fr 1fr; } }
    @media (max-width: 480px) { .footer-grid { grid-template-columns: 1fr; } }
    .footer-brand p { color: var(--muted); font-size: 0.875rem; margin-top: 14px; line-height: 1.6; max-width: 260px; }
    .footer-col h4 { font-size: 0.78rem; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--muted); margin-bottom: 16px; }
    .footer-col ul { list-style: none; display: flex; flex-direction: column; gap: 10px; }
    .footer-col ul li a { color: var(--muted); font-size: 0.875rem; transition: color .15s; }
    .footer-col ul li a:hover { color: var(--text); }
    .footer-bottom { display: flex; align-items: center; justify-content: space-between; border-top: 1px solid var(--border); padding-top: 24px; flex-wrap: wrap; gap: 16px; }
    .footer-bottom p { color: var(--muted); font-size: 0.8rem; }
    .footer-legal { display: flex; gap: 20px; }
    .footer-legal a { color: var(--muted); font-size: 0.8rem; }
    .sp-hero { padding: 72px 0 56px; text-align: center; position: relative; overflow: hidden; }
    .sp-hero::before { content: ''; position: absolute; inset: 0; background: radial-gradient(ellipse 80% 60% at 50% -10%, rgba(59,130,246,0.15) 0%, transparent 70%); pointer-events: none; }
    .sp-hero-badge { margin-bottom: 20px; }
    .sp-hero h1 { font-size: clamp(2rem, 5vw, 3.4rem); font-weight: 800; line-height: 1.1; letter-spacing: -0.04em; margin-bottom: 20px; }
    .sp-hero-sub { font-size: 1.05rem; color: var(--muted); max-width: 620px; margin: 0 auto 16px; line-height: 1.65; }
    .sp-hero-sub p { color: var(--muted); }
    .sp-hero-actions { display: flex; align-items: center; justify-content: center; gap: 14px; flex-wrap: wrap; }
    .sp-hero-fine { font-size: 0.82rem; color: var(--muted); margin-top: 12px; }
    .breadcrumb { padding: 12px 0; border-bottom: 1px solid var(--border); background: var(--bg2); }
    .bc-list { list-style: none; display: flex; gap: 8px; align-items: center; font-size: 0.82rem; color: var(--muted); }
    .bc-list li + li::before { content: '/'; color: var(--border2); }
    .bc-list li a { color: var(--accent); }
    .sp-section { padding: 72px 0; }
    .sp-section:nth-child(odd) { background: var(--bg2); border-top: 1px solid var(--border); border-bottom: 1px solid var(--border); }
    .section-header { text-align: center; margin-bottom: 48px; }
    .section-header h2 { font-size: clamp(1.6rem, 3vw, 2.4rem); font-weight: 800; letter-spacing: -0.03em; margin-top: 14px; margin-bottom: 16px; }
    .section-header p { color: var(--muted); max-width: 520px; margin: 0 auto; }
    .sp-body { max-width: 820px; margin: 0 auto; }
    .sp-body h2 { font-size: 1.35rem; font-weight: 800; letter-spacing: -0.02em; margin: 40px 0 16px; color: var(--text); }
    .sp-body h2:first-child { margin-top: 0; }
    .sp-body p { color: var(--muted); line-height: 1.75; margin-bottom: 16px; font-size: 0.975rem; }
    .sp-body ul, .sp-body ol { color: var(--muted); padding-left: 20px; margin-bottom: 16px; display: flex; flex-direction: column; gap: 10px; }
    .sp-body ul li, .sp-body ol li { line-height: 1.65; font-size: 0.95rem; }
    .sp-body strong { color: var(--text); }
    .how-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0; }
    @media (max-width: 860px) { .how-grid { grid-template-columns: repeat(2, 1fr); gap: 32px; } }
    @media (max-width: 500px) { .how-grid { grid-template-columns: 1fr; } }
    .how-step { text-align: center; padding: 0 24px; position: relative; }
    .how-step + .how-step::before { content: ''; position: absolute; left: 0; top: 24px; width: 1px; height: 48px; background: var(--border2); }
    @media (max-width: 860px) { .how-step + .how-step::before { display: none; } }
    .how-num { width: 48px; height: 48px; border-radius: 50%; background: var(--bg3); border: 2px solid var(--border2); display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 1rem; margin: 0 auto 20px; color: var(--accent); }
    .how-step h3 { font-size: 1rem; font-weight: 700; margin-bottom: 10px; }
    .how-step p { color: var(--muted); font-size: 0.875rem; line-height: 1.6; }
    .faq-list { max-width: 700px; margin: 0 auto; display: flex; flex-direction: column; gap: 16px; }
    .faq-item { background: var(--bg3); border: 1px solid var(--border); border-radius: var(--radius); padding: 24px 28px; }
    .faq-item h3 { font-size: 1rem; font-weight: 700; margin-bottom: 10px; }
    .faq-item p { color: var(--muted); font-size: 0.9rem; line-height: 1.65; }
    .related-grid { display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; }
    .related-link { background: var(--bg2); border: 1px solid var(--border2); border-radius: 100px; padding: 8px 18px; font-size: 0.85rem; font-weight: 600; color: var(--muted); transition: all .15s; }
    .related-link:hover { border-color: var(--accent); color: var(--accent); }
    .sp-cta { text-align: center; padding: 80px 0; }
    .sp-cta h2 { font-size: clamp(1.8rem, 3.5vw, 2.8rem); font-weight: 800; letter-spacing: -0.03em; margin-bottom: 16px; }
    .sp-cta p { color: var(--muted); max-width: 480px; margin: 0 auto 36px; }
"""

def render(g):
    faq_schema = [
        {
            "@type": "Question",
            "name": q,
            "acceptedAnswer": {"@type": "Answer", "text": a},
        }
        for q, a in g["faqs"]
    ]
    jsonld = {
        "@context": "https://schema.org",
        "@graph": [
            {
                "@type": "BreadcrumbList",
                "itemListElement": [
                    {"@type": "ListItem", "position": 1, "name": "Home", "item": "https://courtdraw.app/"},
                    {"@type": "ListItem", "position": 2, "name": "Guides", "item": "https://courtdraw.app/guides/"},
                    {"@type": "ListItem", "position": 3, "name": g["breadcrumb"], "item": f"https://courtdraw.app/guides/{g['slug']}/"},
                ],
            },
            {"@type": "FAQPage", "mainEntity": faq_schema},
        ],
    }

    faq_html = "\n".join(
        f'      <div class="faq-item">\n        <h3>{q}</h3>\n        <p>{a}</p>\n      </div>'
        for q, a in g["faqs"]
    )

    related_html = "\n".join(
        f'      <a href="{href}" class="related-link">{label}</a>' for href, label in g["related"]
    )

    how_html = ""
    if g.get("steps"):
        cards = "\n".join(
            f'''      <div class="how-step">
        <div class="how-num">{i+1}</div>
        <h3>{title}</h3>
        <p>{desc}</p>
      </div>'''
            for i, (title, desc) in enumerate(g["steps"])
        )
        how_html = f'''
<section class="sp-section sp-how">
  <div class="container">
    <div class="section-header">
      <span class="badge"><span class="badge-dot"></span>Quick Reference</span>
      <h2>{g["steps_heading"]}</h2>
    </div>
    <div class="how-grid">
{cards}
    </div>
  </div>
</section>
'''

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-9NZSFKFV1N"></script>
  <script>window.dataLayer=window.dataLayer||[];function gtag(){{dataLayer.push(arguments);}}gtag('js',new Date());gtag('config','G-9NZSFKFV1N');</script>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>{g["title"]}</title>
  <meta name="description" content="{g["meta_desc"]}" />
  <link rel="canonical" href="https://courtdraw.app/guides/{g['slug']}/" />
  <meta property="og:type" content="article" />
  <meta property="og:url" content="https://courtdraw.app/guides/{g['slug']}/" />
  <meta property="og:title" content="{g["og_title"]}" />
  <meta property="og:description" content="{g["meta_desc"]}" />
  <meta property="og:image" content="https://courtdraw.app/assets/og-image.png" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:site_name" content="CourtDraw" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="{g["og_title"]}" />
  <meta name="twitter:description" content="{g["meta_desc"]}" />
  <meta name="twitter:image" content="https://courtdraw.app/assets/og-image.png" />
  <link rel="manifest" href="/manifest.json" />
  <meta name="theme-color" content="#1d4ed8" />
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <meta name="apple-mobile-web-app-title" content="CourtDraw">
  <link rel="apple-touch-icon" href="/assets/icons/icon-192.png" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
  <script type="application/ld+json">{json.dumps(jsonld, indent=2)}</script>
  <style>{STYLE}</style>
</head>
<body>

<nav>
  <div class="container nav-inner">
    <a href="/" class="nav-logo">
      <div class="nav-logo-mark">{LOGO_SVG}</div>
      CourtDraw
    </a>
    <div class="nav-links">
      <a href="/sports/">All Sports</a>
      <a href="/guides/">Guides</a>
      <a href="/#pricing">Pricing</a>
    </div>
    <div class="nav-cta">
      <a href="/login.html" class="btn btn-ghost" style="padding:9px 18px;font-size:.875rem;">Sign in</a>
      <a href="/courtdraw-app.html" class="btn btn-primary" style="padding:9px 18px;font-size:.875rem;">Try Free</a>
    </div>
  </div>
</nav>

<div class="breadcrumb">
  <div class="container">
    <ol class="bc-list">
      <li><a href="/">Home</a></li>
      <li><a href="/guides/">Guides</a></li>
      <li>{g["breadcrumb"]}</li>
    </ol>
  </div>
</div>

<section class="sp-hero">
  <div class="container">
    <div class="sp-hero-badge">
      <span class="badge"><span class="badge-dot"></span>{g["eyebrow"]}</span>
    </div>
    <h1>{g["h1"]}</h1>
    <div class="sp-hero-sub">
      <p>{g["hero_sub"]}</p>
    </div>
    <div class="sp-hero-actions" style="margin-top:28px;">
      <a href="{g.get("cta_primary_href", "/courtdraw-app.html")}" class="btn btn-primary btn-lg">{g["cta_primary"]}</a>
      <a href="/sports/" class="btn btn-ghost btn-lg">Browse All Sports</a>
    </div>
    <p class="sp-hero-fine">{g["hero_fine"]}</p>
  </div>
</section>

<section class="sp-section sp-content">
  <div class="container">
    <div class="sp-body">
{g["body"]}
    </div>
  </div>
</section>
{how_html}
<section class="sp-section sp-faq">
  <div class="container">
    <div class="section-header">
      <span class="badge"><span class="badge-dot"></span>FAQ</span>
      <h2>{g["faq_heading"]}</h2>
    </div>
    <div class="faq-list">
{faq_html}
    </div>
  </div>
</section>

<section class="sp-section sp-related" style="padding:56px 0;">
  <div class="container">
    <div class="section-header" style="margin-bottom:28px;">
      <h2 style="font-size:1.4rem;">Related</h2>
    </div>
    <div class="related-grid">
{related_html}
    </div>
  </div>
</section>

<section class="sp-cta" style="background:var(--bg2);border-top:1px solid var(--border);border-bottom:1px solid var(--border);">
  <div class="container">
    <h2>{g["cta_heading"]}</h2>
    <p>{g["cta_sub"]}</p>
    <a href="/courtdraw-app.html" class="btn btn-primary btn-lg">Open CourtDraw →</a>
    <p style="margin-top:16px;font-size:0.82rem;color:var(--muted);">Free forever · Pro from €6/month · Club from €99/year</p>
  </div>
</section>

<footer>
  <div class="container">
    <div class="footer-grid">
      <div class="footer-brand">
        <a href="/" class="nav-logo">
          <div class="nav-logo-mark">{LOGO_SVG}</div>
          CourtDraw
        </a>
        <p>The tactics board for every coach. Draw plays for 38+ sports in your browser — free, fast, and offline-ready.</p>
      </div>
      <div class="footer-col">
        <h4>Sports</h4>
        <ul>
          <li><a href="/sports/">All Sports Hub</a></li>
          <li><a href="/football-tactics-board/">Football</a></li>
          <li><a href="/basketball-tactics-board/">Basketball</a></li>
          <li><a href="/tennis-tactics-board/">Tennis</a></li>
        </ul>
      </div>
      <div class="footer-col">
        <h4>Product</h4>
        <ul>
          <li><a href="/courtdraw-app.html">Open App</a></li>
          <li><a href="/#features">Features</a></li>
          <li><a href="/#pricing">Pricing</a></li>
          <li><a href="/#faq">FAQ</a></li>
        </ul>
      </div>
      <div class="footer-col">
        <h4>Legal</h4>
        <ul>
          <li><a href="/privacy.html">Privacy Policy</a></li>
          <li><a href="/terms.html">Terms of Service</a></li>
          <li><a href="mailto:hello@courtdraw.app">Contact</a></li>
        </ul>
      </div>
    </div>
    <div class="footer-bottom">
      <p>© 2026 CourtDraw. All rights reserved.</p>
      <div class="footer-legal">
        <a href="/privacy.html">Privacy</a>
        <a href="/terms.html">Terms</a>
        <a href="mailto:hello@courtdraw.app">Contact</a>
      </div>
    </div>
  </div>
</footer>

</body>
</html>
"""


GUIDES = [
    {
        "slug": "one-tactics-board-multi-sport-club",
        "breadcrumb": "One Tactics Board for a Multi-Sport Club",
        "title": "One Tactics Board for a Multi-Sport Club | CourtDraw",
        "og_title": "One Tactics Board for a Multi-Sport Club",
        "meta_desc": "Running football, basketball, and tennis programs with three different tools? Here's how one Club plan covers every coach and every sport instead.",
        "eyebrow": "🏟️ For Directors of Coaching",
        "h1": "One Tactics Board for a <span class=\"gradient-text\">Multi-Sport</span> Club",
        "hero_sub": "Academies and multi-sport clubs end up running one tactics tool per sport, one login per coach, and no shared record of what any of them actually taught. Here's what changes when every coach, in every sport, works from the same board.",
        "hero_fine": "Club plan · Up to 10 coaches · €99/year · 7-day free trial",
        "cta_primary": "See the Club Plan →",
        "cta_primary_href": "/#pricing",
        "steps_heading": None,
        "steps": None,
        "faq_heading": "Multi-Sport Club Setup — Questions",
        "body": """      <h2>The Problem: One Tool Per Sport, Zero Shared Record</h2>
<p>A multi-sport academy running football, basketball, and tennis programs typically ends up with three different ways of planning tactics — a football coach's personal notebook, a basketball coach's phone photos, a tennis coach who doesn't bother writing anything down at all. When a coach leaves, their tactical knowledge leaves with them. When a director of coaching wants to see what's actually being taught across programs, there's nothing to look at.</p>
<p>The underlying issue usually isn't a lack of effort from coaches — it's that most tactics tools are built for a single sport, a single user, and no shared visibility. Buying three separate subscriptions to cover three sports, each with its own login for each coach, is expensive and nobody actually keeps them all active.</p>

<h2>What a Shared Club Library Actually Solves</h2>
<p>CourtDraw's Club plan covers all 38+ sport courts under one subscription, and every coach on the roster works from the same shared tactic library rather than a personal one. When a football coach saves a set-piece routine, it's visible to every other coach on the staff — including the basketball and tennis coaches, who might never use it, and the assistant football coaches, who will. Any coach can load a shared tactic, adapt it, and re-publish it, so the library compounds instead of resetting every time someone leaves.</p>
<p>Because it covers every sport in one place, a club running multiple programs doesn't need one subscription per sport — the same €99/year plan covers a football program, a basketball program, and anything else on the same roster.</p>

<h2>What the Director of Coaching Actually Sees</h2>
<p>The admin dashboard gives whoever runs the program a live view of the whole staff: who's joined, when they joined, and how many plays each coach has contributed to the shared library. That's a genuinely different kind of visibility than "ask each coach how their session planning is going" — it's a real usage record, updated as coaches actually save tactics, not a self-report.</p>
<p>Coaches join with a single 6-character code — no individual invitations, no IT setup, no per-coach email whitelisting. A new hire is coaching from the shared library within a minute of getting the code.</p>

<h2>Branding That Applies Automatically</h2>
<p>Every coach's exports carry the club's own colors and logo without any manual setup per coach. Set the club's primary and secondary colors once, and every player token across every coach's board matches the kit automatically. PDF exports carry the club logo bottom-left and club name bottom-right — so a handout from the U12 basketball coach and a handout from the first-team football coach both look like they came from the same organization, because they did.</p>
<p>Presentation mode extends the same idea to team meetings: one tap goes full-screen with the club logo, tactic name, and phase controls — built for a projector at a parent evening or a scouting session, not just a laptop screen in an office.</p>

<h2>Is This Worth It for a Small Multi-Sport Setup?</h2>
<p>The math is straightforward: €99/year covers up to 10 coaches across every sport the club runs, which works out to roughly €10 per coach per year — less than the cost of most single-sport coaching apps for one coach alone. For a club running two or three sports with a handful of coaches each, that's a meaningful consolidation, not just a discount.</p>""",
        "faqs": [
            (
                "Does the Club plan cover multiple sports, or do we need one plan per sport?",
                "One Club plan covers all 38+ sport courts. A club running football, basketball, and tennis programs uses the same subscription and the same shared library across all three — there's no per-sport add-on.",
            ),
            (
                "How many coaches can be on one Club plan?",
                "Up to 10 coaching staff. Coaches join with a 6-character code generated by the club owner — no individual email invitations needed.",
            ),
            (
                "Can a coach who only coaches one sport still see tactics from other sports in the library?",
                "Yes — the shared library isn't filtered by sport by default, since directors of coaching often want visibility across the whole program. Coaches simply load and use what's relevant to them.",
            ),
            (
                "What happens to the shared library if a coach leaves the club?",
                "Nothing. Tactics they published stay in the club's shared library — that's the point of a shared library over each coach's personal one. Only their individual seat on the roster is removed.",
            ),
        ],
        "related": [
            ("/football-tactics-board/", "Football Tactics Board"),
            ("/basketball-tactics-board/", "Basketball Tactics Board"),
            ("/guides/how-to-build-a-training-session-plan/", "How to Build a Training Session Plan"),
            ("/sports/", "All 38+ Sports →"),
            ("/guides/", "← All Guides"),
        ],
        "cta_heading": 'Bring Your Whole Staff <span class="gradient-text">Onto One Board</span>',
        "cta_sub": "Up to 10 coaches, every sport, one shared library. 7-day free trial, cancel anytime before it ends.",
    },
    {
        "slug": "how-to-build-a-training-session-plan",
        "breadcrumb": "How to Build a Training Session Plan",
        "title": "How to Build a Training Session Plan From Saved Plays | CourtDraw",
        "og_title": "How to Build a Training Session Plan From Saved Plays",
        "meta_desc": "Turn individual saved tactics into a full training session with timed drills — then export the whole thing as a handout for assistant coaches.",
        "eyebrow": "📅 Session Planning",
        "h1": "How to Build a Training Session Plan From Saved Plays",
        "hero_sub": "A session plan is more than a list of drills — it's a sequence, with a duration attached to each one, that an assistant coach could run without you standing next to them. Here's how to build one from tactics you've already saved.",
        "hero_fine": "Session Builder is a Pro feature · 7-day free trial",
        "cta_primary": "Start a Session Free →",
        "steps_heading": "Building a Session, Step by Step",
        "steps": [
            ("Save the plays first", "Draw and save each drill or tactic you want in the session as its own tactic in your library."),
            ("Open Session Builder", "Chain 3–8 saved plays into a session in the order you'll actually run them."),
            ("Set drill durations", "Attach a duration to each play — this is what turns a list of drills into a real timed plan."),
            ("Export as PDF", "Export the whole session as a multi-page PDF, ready to hand to an assistant coach."),
        ],
        "faq_heading": "Session Planning — Questions",
        "body": """      <h2>Why a List of Drills Isn't a Session Plan</h2>
<p>Most training "plans" are a list of drill names scribbled the morning of practice — useful as a personal reminder, useless as something you could hand to an assistant coach and expect them to run unsupervised. A real session plan needs three things a list doesn't have: the tactical detail of each drill, the order they run in, and how long each one actually gets. Without the third part especially, sessions run long, the last two drills get cut, and players never get to the part of practice that mattered most.</p>

<h2>Step 1 — Save Each Drill as Its Own Tactic</h2>
<p>Before building a session, each individual drill or tactic needs to exist as a saved play in your library — the warm-up rondo, the possession drill, the shape work, the finishing exercise, whatever's on the plan for that day. Draw each one on the appropriate court, with player tokens and movement arrows, and save it with a name that'll make sense to whoever runs it later.</p>

<h2>Step 2 — Chain Plays Into a Session</h2>
<p>The Session Builder takes 3 to 8 saved plays and chains them into a single session, in the order you'll run them on the pitch. This is the part a folder of separate saved tactics can't do on its own — it turns individual plays into a sequence with a clear start and end point.</p>

<h2>Step 3 — Attach a Duration to Each Drill</h2>
<p>Every play in the session gets its own duration. This is the detail that actually makes a session plan usable by someone other than you: instead of "we'll do the rondo for a while," the plan says 10 minutes, and whoever's running the session — you, an assistant, a parent helper — knows exactly when to move to the next drill. Set realistic durations here rather than aspirational ones; a session plan that assumes everything runs perfectly on time will still run over.</p>

<h2>Step 4 — Step Through It On the Pitch</h2>
<p>Once built, you can step through each play in the session directly from your phone or tablet at the pitch — no need to flip between separate saved tactics mid-session. This matters most when you're coaching solo and don't have a spare hand to be scrolling through a folder of unrelated saved plays.</p>

<h2>Step 5 — Export the Whole Session as a PDF</h2>
<p>The finished session exports as a multi-page PDF — one page per drill, each showing the diagram and its duration. Hand this to an assistant coach, a parent helper running a station, or keep it as a written record of what a given week of training actually covered. Club accounts get their branding on every page automatically, so a handout from any coach on staff looks consistent.</p>""",
        "faqs": [
            (
                "How many drills can I put in one session?",
                "Session Builder chains 3 to 8 saved plays into a single session. For longer sessions, split into two session plans rather than overloading one.",
            ),
            (
                "Do I need to save each drill separately before building a session?",
                "Yes — Session Builder works from your existing saved tactics library, so each drill needs to exist as its own saved play first.",
            ),
            (
                "Can I hand the session plan to someone else to run?",
                "Yes. Export the session as a multi-page PDF and hand it to an assistant coach — each page shows the diagram and the duration for that drill, so it's runnable without you there to explain it.",
            ),
            (
                "Is Session Builder available on the free plan?",
                "No, Session Builder is a Pro feature. The free plan covers drawing, saving up to 3 tactics, and PNG export on one court.",
            ),
        ],
        "related": [
            ("/guides/one-tactics-board-multi-sport-club/", "One Tactics Board for a Multi-Sport Club"),
            ("/football-tactics-board/", "Football Tactics Board"),
            ("/basketball-tactics-board/", "Basketball Tactics Board"),
            ("/sports/", "All 38+ Sports →"),
            ("/guides/", "← All Guides"),
        ],
        "cta_heading": 'Build Your First <span class="gradient-text">Session Plan</span>',
        "cta_sub": "Chain saved plays into a timed session and export it as a handout. Pro feature, 7-day free trial.",
    },
    {
        "slug": "digital-vs-whiteboard-coaching",
        "breadcrumb": "Digital vs. Whiteboard Coaching",
        "title": "Digital vs. Whiteboard Coaching: What Actually Changes | CourtDraw",
        "og_title": "Digital vs. Whiteboard Coaching: What Actually Changes",
        "meta_desc": "A magnetic whiteboard and a digital tactics board can show the same arrows. Here's what's genuinely different once you switch — and what isn't.",
        "eyebrow": "✏️ Coaching Tools",
        "h1": "Digital vs. Whiteboard Coaching: What Actually Changes",
        "hero_sub": "A magnetic whiteboard and a digital tactics board can draw the same arrow. The difference isn't the drawing — it's what happens to that drawing five minutes, one week, and one season later.",
        "hero_fine": "No install · Free to start · Works offline",
        "cta_primary": "Try It Free →",
        "steps_heading": None,
        "steps": None,
        "faq_heading": "Switching From a Whiteboard — Questions",
        "body": """      <h2>What Stays Exactly the Same</h2>
<p>Nobody needs convincing that drawing an arrow is drawing an arrow. A magnetic whiteboard, a piece of paper, and a digital tactics board all let you show a run, a pass, a rotation. If the only thing you're comparing is "can I put a diagram in front of a player," a whiteboard has done that job fine for decades and will keep doing it. That's not where the actual difference is.</p>

<h2>What Changes: The Drawing Doesn't Disappear</h2>
<p>A whiteboard gets wiped for the next session, or the next team using the same room. Whatever tactical detail you built up over a session — the corner routine you refined three times, the defensive shape you adjusted after the first attempt didn't work — is gone unless you photographed it, and a phone photo of a whiteboard is rarely something you can read clearly a week later. A saved tactic on a digital board is just there next time you open the app: same detail, same colors, ready to reuse or adjust rather than redraw from memory.</p>

<h2>What Changes: Getting It to Players Is a Different Order of Effort</h2>
<p>Getting a whiteboard diagram to a player who wasn't in the room means photographing it and texting the photo — assuming the lighting and angle cooperate. A digital board exports a clean, correctly-lit image on demand, and on mobile can go straight into a share sheet to WhatsApp or wherever the team actually communicates, without a re-photograph. The gap is small for one diagram; it compounds across a season of sessions.</p>

<h2>What Changes: Multi-Phase Sequences</h2>
<p>A whiteboard shows one static moment. Showing what happens next means either erasing and redrawing, or drawing everything at once in a way that gets visually crowded fast. A digital board with phase support lets you build a sequence — starting position, first movement, second movement — and step through it, or play it back as an animation, without erasing anything. For anything more complex than a single static shape, this is a genuine capability gap, not just a convenience.</p>

<h2>What Doesn't Actually Change: The Coaching</h2>
<p>Switching tools doesn't make a coach's tactical understanding better. A digital board organizes and preserves what a coach already knows how to teach — it doesn't generate tactics on its own, and a coach who struggles to explain a concept on a whiteboard will likely struggle to explain it digitally too. The value is in retention and distribution of the coaching that's already happening, not a replacement for it.</p>

<h2>When a Physical Whiteboard Still Wins</h2>
<p>In a locker room at halftime, physically pointing at a board while the team gathers round has an immediacy a phone screen doesn't fully replace — a shared physical object the group is looking at together is a real thing worth keeping. Most coaches who switch don't get rid of the whiteboard entirely; they use it for the in-the-moment, in-person adjustment, and the digital board for anything that needs to be prepared beforehand, saved for later, or sent to someone who isn't in the room.</p>""",
        "faqs": [
            (
                "Do I have to choose one or the other?",
                "No — most coaches who adopt a digital tactics board keep a physical whiteboard for in-person, in-the-moment adjustments (like a halftime talk) and use the digital board for anything prepared beforehand, saved, or shared with someone who isn't in the room.",
            ),
            (
                "Does a digital tactics board work without an internet connection, like a whiteboard does?",
                "Yes, if it's built as an offline-capable app. CourtDraw is a Progressive Web App that caches itself after the first visit, so it works with no signal — useful for training grounds with poor reception.",
            ),
            (
                "Is a digital tactics board harder to learn than a whiteboard?",
                "Drawing an arrow works the same way conceptually — drag, draw, place a token. The learning curve is closer to using a drawing app on a phone than learning new software, and most coaches are drawing their first play within a minute of opening one.",
            ),
        ],
        "related": [
            ("/guides/share-tactics-board-whatsapp/", "Share a Tactics Board on WhatsApp"),
            ("/football-tactics-board/", "Football Tactics Board"),
            ("/sports/", "All 38+ Sports →"),
            ("/guides/", "← All Guides"),
        ],
        "cta_heading": 'See What Changes for <span class="gradient-text">Yourself</span>',
        "cta_sub": "Free to start, no install, no credit card. Draw your first play in under a minute.",
    },
]

for g in GUIDES:
    out_dir = os.path.join(BASE, "guides", g["slug"])
    os.makedirs(out_dir, exist_ok=True)
    with open(os.path.join(out_dir, "index.html"), "w") as f:
        f.write(render(g))
    print("wrote", g["slug"])
