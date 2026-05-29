# Reddit — r/cycling

**Subreddit cible :** r/cycling (et r/Velo si applicable)
**Best time :** dimanche soir (les cyclistes lisent après leur sortie)

---

## Titre

> I built an open-source platform for cycling clubs — Strava sync, GPX import, OSM routes, member management

---

## Body

Hi r/cycling,

I'm a developer and also a member of a small cycling club. We were juggling Facebook events + WhatsApp + Strava clubs to organize rides, and it was a mess. So I built a proper web platform for our club, and it's now open source.

### What it does

- **Ride catalog** auto-fed from OpenStreetMap (real named cycling routes, not approximations) for our region
- **Strava OAuth** — members connect their account, activities sync automatically
- **GPX import** with live preview (distance / elevation / waypoints)
- **Route explorer** : Street View + synced trail, elevation profile colored by gradient, weather forecast/observation
- **Events with registration** + waiting list when full
- **Member profiles** : equipment, FTP + power zones, personal stats vs club
- **Admin panel** : event management, broadcast emails, audit log

### For clubs / coaches

If you run a club, this could replace 3-4 tools you're currently using. Self-hosted (Node.js + MySQL), so you keep your members' data.

### Tech

Built on Node.js / Express / MySQL / Vanilla JS. PWA installable on mobile. ~50 API endpoints, 14 DB tables, 63 tests.

### Code

https://github.com/Abdoulrazack1/Cycling

MIT license. If you're in a club and would consider using it, I'd love to hear what's missing for your use case.

### Live example

Currently running for **C.C. Salouel** (Hauts-de-France, France) — happy to share a link if mods allow it.

---

## Notes

- Cyclistes ≠ devs : éviter le jargon, parler **fonctionnalités et bénéfices**
- Inclure une screenshot du explorateur de parcours (la feature visuellement la plus impressionnante)
- Anticiper la question "pourquoi pas Strava clubs ?" — réponse : self-hosted, contrôle des données, features admin manquantes (broadcast, audit)
