# WARBOUND — Design Pillars & Process

Working title. The user renames it when the pivot earns it.

## Pillars (agreed Oct 2, 2026 — his call, starting point to grow)

1. **You're the general, never the soldier.** Command, don't fight.
2. **Every automated outcome lands on a named someone.** No statistics, only people.
3. **The diary never lies and never babbles.** Visible checks, named stakes, cause next to effect.
4. **Cozy garrison, tense campaign.** The contrast is the rhythm.

Every design decision gets checked against these. If a feature can't serve a pillar, it doesn't ship.

## Process (the "like actual game makers" commitment)

- Vertical slice first: muster → garrison → campaign → aftermath, playable end-to-end before any breadth.
- Playtest-driven: every iteration ships to the playtest link; he plays on his phone; we adjust based on what he actually did, not what was intended.
- Design log below: what we tried, what worked, what got cut. No re-learning lessons.

## Design log

- Oct 2, 2026: Pivoted from Starward (spaceship crew sim) to WARBOUND (FM-as-general warsim). Trigger: the spaceship prototype read like an AI random text generator; war is friendlier, more intuitive, more unique. Reuses the Starward engine (crew→officers, voyages→campaigns, log→war diary, dynasty→succession).
- Oct 2, 2026: Art direction set to procedural 16-bit: pixel-rendered portraits, regimental standards, map tiles generated in code with a fixed palette, seeded per character. Dark command-tent terminal frame (phosphor gold/cyan on near-black).
- Oct 2, 2026: Design lenses: Tristram (recruit → send → watch → return → spend loop; town as progress bar), Caves of Qud + Dwarf Fortress (specificity over genericness, emergent stories from colliding systems), Redshirt (social web as survival), Radio General (uncertainty IS the game — delayed, fallible reports), Football Manager (the general's chair, transfer windows, inexhaustible rival content).
- Oct 2, 2026: Structure set: DIVE (procedural mission: insertion → objectives → extraction) → CAMPAIGN (sequence of 2-4 procedural dives, escalating extraction pressure, withdrawable between dives at war-score cost) → WAR (sequence of N campaigns; outcomes move the front, change sector control, kill/promote named characters on both sides, write history). Forever story = accumulated war chronicle across wars. Five approved features folded into the build: named rival commander who adapts and taunts; last letters from fallen officers; regimental traditions (earned names, bonuses, standard marks); garrison town mirrors war outcomes; succession with teeth (heir inherits grudges, debts, reputation). Lenses added: Helldivers/Jump Space/DRG (dive loop, Space Rig hub, galactic war), Stellaris (emergent history with outcomes).
- Oct 2, 2026: He likes the name WARBOUND. It graduates from working title to the actual title unless he renames it later.
