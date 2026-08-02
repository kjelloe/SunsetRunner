#!/usr/bin/env python3
"""Aggregate a sim_sweep CSV into balance numbers (§15.5).

    node tools/sim_sweep.mjs 300 6 | python3 tools/analyze_sweep.py
    python3 tools/analyze_sweep.py sweep.csv

Reads the CSV emitted by tools/sim_sweep.mjs and reports, per car: how often it
won, and how it fared on average. The point is to catch a car that is too strong
(win share well above its fair share) or a course that mostly times out.
"""
import csv
import statistics
import sys

# A win share above fair_share * this factor is flagged as likely imbalance.
IMBALANCE_FACTOR = 1.5


def load(rows):
    out = []
    for r in rows:
        out.append({
            "winnerCar": int(r["winnerCar"]),
            "finishCount": int(r["finishCount"]),
            "timeoutCount": int(r["timeoutCount"]),
            "avgFinishTicks": int(r["avgFinishTicks"]),
            "collisionsTraffic": int(r["collisionsTraffic"]),
            "collisionsRival": int(r["collisionsRival"]),
            "maxSpeed": int(r["maxSpeed"]),
        })
    return out


def analyze(races):
    n = len(races)
    if not n:
        return {"races": 0, "cars": {}, "flags": ["no races in input"]}

    ties = sum(1 for r in races if r["winnerCar"] < 0)
    decided = [r for r in races if r["winnerCar"] > 0]
    # Roster size = highest car id seen (cars are ids 1..K), NOT the count of
    # cars that happened to win — else a car that never wins would shrink the
    # denominator and hide the imbalance it is the victim of.
    roster = max((r["winnerCar"] for r in decided), default=0)
    cars = list(range(1, roster + 1))
    fair = 1.0 / roster if roster else 0.0

    per_car = {}
    for c in cars:
        wins = sum(1 for r in decided if r["winnerCar"] == c)
        per_car[c] = {
            "wins": wins,
            "winShare": wins / len(decided) if decided else 0.0,
        }

    flags = []
    for c, s in per_car.items():
        if fair and s["winShare"] > fair * IMBALANCE_FACTOR:
            flags.append(f"car {c} win share {s['winShare']:.0%} > fair {fair:.0%} x{IMBALANCE_FACTOR} — likely too strong")

    timeout_races = sum(1 for r in races if r["timeoutCount"] > 0)
    if timeout_races > n * 0.2:
        flags.append(f"{timeout_races}/{n} races had a timeout — course may be too long / cars too slow")

    return {
        "races": n,
        "ties": ties,
        "fairShare": fair,
        "cars": per_car,
        "avgFinishTicks": round(statistics.mean(r["avgFinishTicks"] for r in decided)) if decided else -1,
        "avgTrafficCollisions": round(statistics.mean(r["collisionsTraffic"] for r in races), 1),
        "avgRivalCollisions": round(statistics.mean(r["collisionsRival"] for r in races), 1),
        "maxSpeed": max(r["maxSpeed"] for r in races),
        "flags": flags,
    }


def render(a):
    lines = []
    lines.append(f"races={a['races']}  ties={a.get('ties', 0)}  fairShare={a.get('fairShare', 0):.0%}")
    for c in sorted(a["cars"]):
        s = a["cars"][c]
        lines.append(f"  car {c}: wins={s['wins']:4d}  winShare={s['winShare']:.0%}")
    lines.append(f"avgFinishTicks={a.get('avgFinishTicks')}  avgTrafficCol={a.get('avgTrafficCollisions')}  avgRivalCol={a.get('avgRivalCollisions')}  maxSpeed={a.get('maxSpeed')}")
    if a["flags"]:
        lines.append("FLAGS:")
        for f in a["flags"]:
            lines.append(f"  ! {f}")
    else:
        lines.append("FLAGS: none — roster looks balanced")
    return "\n".join(lines)


def main(argv):
    if len(argv) > 1:
        with open(argv[1], newline="") as fh:
            races = load(csv.DictReader(fh))
    else:
        races = load(csv.DictReader(sys.stdin))
    print(render(analyze(races)))


if __name__ == "__main__":
    main(sys.argv)
