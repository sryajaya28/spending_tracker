#!/usr/bin/env python3
"""Orchestrator tooling: state machine, hashes, review validation, CEO decisions.

Only the orchestrator and CI run this. Subagents never write status.md or decision files.
Stdlib only (Python 3.9+). Paths must not contain spaces.

Exit codes: 0 ok, 1 refused (rule violation), 2 usage error, 3 stale brief.
"""
import datetime
import hashlib
import json
import os
import re
import subprocess
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
SLUG_RE = re.compile(r"^[a-z0-9][a-z0-9-]*$")

STATES = [
    "DRAFT_PRD", "PRD_REVIEW", "PRD_APPROVED", "TDD_DRAFT", "TDD_REVIEW", "TDD_APPROVED",
    "DESIGN", "DESIGN_REVIEW", "DESIGN_APPROVED", "CEO_PREDEV_BRIEF", "CEO_PREDEV_REVIEW",
    "BUILD", "CODE_REVIEW", "QA_CASES", "QA_CASES_REVIEW", "STAGING_QA", "UAT",
    "CEO_DEMO_BRIEF", "CEO_RELEASE_REVIEW", "RELEASE_READY", "RELEASED", "SMOKE_PROD",
    "POST_RELEASE", "DONE", "BLOCKED_NEEDS_HUMAN", "REJECTED",
]
ZONE = {"PRD_APPROVED", "TDD_DRAFT", "TDD_REVIEW", "TDD_APPROVED", "DESIGN", "DESIGN_REVIEW", "DESIGN_APPROVED"}
LINEAR = {
    "DRAFT_PRD": {"PRD_REVIEW"},
    "PRD_REVIEW": {"DRAFT_PRD", "PRD_APPROVED"},
    "CEO_PREDEV_BRIEF": {"CEO_PREDEV_REVIEW"},
    "CEO_PREDEV_REVIEW": {"BUILD", "REJECTED", "DRAFT_PRD", "TDD_DRAFT", "DESIGN"},
    "BUILD": {"CODE_REVIEW", "QA_CASES"},
    "CODE_REVIEW": {"BUILD", "QA_CASES"},
    "QA_CASES": {"QA_CASES_REVIEW"},
    "QA_CASES_REVIEW": {"QA_CASES", "STAGING_QA"},
    "STAGING_QA": {"BUILD", "UAT"},
    "UAT": {"CEO_DEMO_BRIEF", "BUILD"},
    "CEO_DEMO_BRIEF": {"CEO_RELEASE_REVIEW"},
    "CEO_RELEASE_REVIEW": {"RELEASE_READY", "REJECTED", "BUILD", "STAGING_QA"},
    "RELEASE_READY": {"RELEASED"},
    "RELEASED": {"SMOKE_PROD"},
    "SMOKE_PROD": {"POST_RELEASE"},
    "POST_RELEASE": {"DONE"},
}
LOOP_KINDS = {
    # kind: (artifact name or None, approval name or None, approver, loop key)
    "prd": ("prd", "prd", "head-of-product", "prd"),
    "tdd": ("tdd", "tdd", "principal-engineer", "tdd"),
    "design": ("design", "design", "product-manager", "design"),
    "fe_plan": ("fe-plan", None, "principal-engineer", "fe_plan"),
    "test_cases": ("test-cases", None, "product-manager", "test_cases"),
    "code": (None, None, "principal-engineer", "code"),
}
DECISIONS = {
    "approve": "APPROVE", "conditions": "APPROVE_WITH_CONDITIONS",
    "changes": "REQUEST_CHANGES", "reject": "REJECT",
}
GATES = {
    "predev": ("CEO_PREDEV_REVIEW", "ceo-brief-predev.md", "ceo_predev", "BUILD"),
    "release": ("CEO_RELEASE_REVIEW", "ceo-brief-demo.md", "ceo_release", "RELEASE_READY"),
}


class Refuse(Exception):
    pass


def die(msg, code=1):
    print(msg, file=sys.stderr)
    sys.exit(code)


def rel(p):
    return os.path.relpath(p, ROOT)


def feat(slug):
    if not SLUG_RE.match(slug or ""):
        die("invalid slug: %r" % slug, 2)
    return os.path.join(ROOT, "docs", "features", slug)


def sha_file(p):
    h = hashlib.sha256()
    with open(p, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def lines_for(paths):
    return sorted("%s  %s" % (sha_file(p), rel(p)) for p in paths)


def bundle_hash(paths):
    return hashlib.sha256(("\n".join(lines_for(paths)) + "\n").encode()).hexdigest()


def artifact_paths(slug, name):
    d = feat(slug)
    if name == "design":
        out = []
        for base, _, files in os.walk(os.path.join(d, "design")):
            out += [os.path.join(base, f) for f in files if f != ".gitkeep"]
        if not out:
            raise Refuse("design artifact has no files")
        return sorted(out)
    if not re.match(r"^[a-z0-9-]+$", name):
        raise Refuse("bad artifact name %r" % name)
    p = os.path.join(d, name + ".md")
    if not os.path.isfile(p):
        raise Refuse("artifact missing: %s" % rel(p))
    return [p]


def artifact_hash(slug, name):
    paths = artifact_paths(slug, name)
    return sha_file(paths[0]) if len(paths) == 1 and name != "design" else bundle_hash(paths)


# ---------- frontmatter ----------
def split_fm(path):
    with open(path, encoding="utf-8") as f:
        text = f.read()
    m = re.match(r"^---\n(.*?)\n---\n?(.*)$", text, re.S)
    if not m:
        raise Refuse("no frontmatter in %s" % rel(path))
    return m.group(1).split("\n"), m.group(2)


def join_fm(lines, body):
    return "---\n" + "\n".join(lines) + "\n---\n" + body


def fm_get(lines, key):
    for ln in lines:
        m = re.match(r"^%s:\s*(.*)$" % re.escape(key), ln)
        if m:
            return m.group(1).strip()
    return None


def fm_set(lines, key, value):
    for i, ln in enumerate(lines):
        if re.match(r"^%s:" % re.escape(key), ln):
            lines[i] = "%s: %s" % (key, value)
            return
    raise Refuse("key not found: %s" % key)


def status_path(slug):
    p = os.path.join(feat(slug), "status.md")
    if not os.path.isfile(p):
        raise Refuse("no status.md for %s (run init)" % slug)
    return p


def load(slug):
    p = status_path(slug)
    lines, body = split_fm(p)
    return p, lines, body


def save(p, lines, body):
    with open(p, "w", encoding="utf-8") as f:
        f.write(join_fm(lines, body))


def approval_get(lines, name):
    for ln in lines:
        m = re.match(r"^  %s:\s*\{(.*)\}\s*$" % re.escape(name), ln)
        if m:
            d = {}
            for part in m.group(1).split(","):
                if ":" in part:
                    k, v = part.split(":", 1)
                    d[k.strip()] = v.strip()
            return d
    raise Refuse("approval not found: %s" % name)


def approval_set(lines, name, d):
    for i, ln in enumerate(lines):
        if re.match(r"^  %s:\s*\{" % re.escape(name), ln):
            lines[i] = "  %s: { %s }" % (name, ", ".join("%s: %s" % (k, v) for k, v in d.items()))
            return
    raise Refuse("approval not found: %s" % name)


def waivers(lines):
    v = fm_get(lines, "pilot_waivers") or "[]"
    return set(x.strip() for x in v.strip("[]").split(",") if x.strip())


def now():
    return datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


# ---------- review validation ----------
def validate_review(review_path, slug=None, artifact=None):
    lines, body = split_fm(review_path)
    verdict = fm_get(lines, "verdict")
    if verdict not in ("APPROVE", "REVISE", "REJECT"):
        raise Refuse("review verdict invalid: %r" % verdict)
    try:
        nb = int(fm_get(lines, "blocking_issues"))
        nn = int(fm_get(lines, "non_blocking_issues"))
    except (TypeError, ValueError):
        raise Refuse("review counts missing or not integers")
    blocking = len(re.findall(r"Severity:\s*BLOCKING\b", body))
    nonblocking = len(re.findall(r"Severity:\s*NON-BLOCKING\b", body))
    if blocking != nb or nonblocking != nn:
        raise Refuse("review counts do not match issues in body (frontmatter %d/%d, body %d/%d)" % (nb, nn, blocking, nonblocking))
    if verdict == "APPROVE" and nb != 0:
        raise Refuse("APPROVE with %d BLOCKING issues" % nb)
    if verdict == "REVISE" and nb < 1:
        raise Refuse("REVISE without a BLOCKING issue")
    if slug and artifact:
        got = fm_get(lines, "artifact_hash")
        want = artifact_hash(slug, artifact)
        if got != want:
            raise Refuse("review artifact_hash %s does not match current artifact hash %s" % (got, want))
    return verdict, nb, nn


# ---------- commands ----------
def cmd_init(slug):
    d = feat(slug)
    if os.path.exists(d):
        raise Refuse("feature already exists: %s" % slug)
    os.makedirs(os.path.join(d, "design"))
    os.makedirs(os.path.join(d, "defects"))
    os.makedirs(os.path.join(d, "data"))
    with open(os.path.join(ROOT, "docs", "templates", "status.md"), encoding="utf-8") as f:
        t = f.read().replace("<slug>", slug)
    with open(os.path.join(d, "status.md"), "w", encoding="utf-8") as f:
        f.write(t)
    print("created %s at DRAFT_PRD" % rel(d))


def cmd_get(slug, key):
    _, lines, _ = load(slug)
    v = fm_get(lines, key)
    if v is None:
        raise Refuse("no key %s" % key)
    print(v)


def check_transition(slug, lines, cur, new):
    if new not in STATES:
        raise Refuse("unknown state %s" % new)
    if cur == new:
        raise Refuse("already in %s" % cur)
    if new == "BLOCKED_NEEDS_HUMAN":
        return
    if cur == "BLOCKED_NEEDS_HUMAN":
        # A human resolved the block. Resuming never bypasses a CEO gate.
        post_predev = STATES[STATES.index("BUILD"):STATES.index("BLOCKED_NEEDS_HUMAN")]
        if new in post_predev:
            verify_decision(slug, "predev")
        if new in ("RELEASE_READY", "RELEASED", "SMOKE_PROD", "POST_RELEASE", "DONE"):
            verify_decision(slug, "release")
        if new == "CEO_PREDEV_BRIEF":
            cur = "TDD_DRAFT"  # apply the same preconditions as leaving the parallel zone
        else:
            return
    if cur in ("DONE", "REJECTED"):
        raise Refuse("%s is terminal" % cur)
    w = waivers(lines)
    if cur in ZONE:
        if new in ZONE and new != "PRD_APPROVED":
            return
        if new == "CEO_PREDEV_BRIEF":
            if not approval_get(lines, "prd")["valid"] == "true":
                raise Refuse("PRD approval missing or invalid")
            if "design" not in w and approval_get(lines, "design")["valid"] != "true":
                raise Refuse("design approval missing or invalid (no pilot waiver)")
            if "tdd_review" not in w and approval_get(lines, "tdd")["valid"] != "true":
                raise Refuse("TDD approval missing or invalid (no pilot waiver)")
            if "tdd_review" in w and not os.path.isfile(os.path.join(feat(slug), "tdd.md")):
                raise Refuse("tdd.md must exist even under the pilot waiver")
            return
        raise Refuse("%s -> %s not allowed" % (cur, new))
    if cur == "PRD_REVIEW" and new == "PRD_APPROVED":
        if approval_get(lines, "prd")["valid"] != "true":
            raise Refuse("record the Head of Product APPROVE first (apply-review prd)")
        return
    if new in LINEAR.get(cur, set()):
        if new == "BUILD" and cur == "CEO_PREDEV_REVIEW":
            verify_decision(slug, "predev")
        if new == "RELEASE_READY" and cur == "CEO_RELEASE_REVIEW":
            verify_decision(slug, "release")
        if new in ("CODE_REVIEW",) and "code_review" in w:
            return
        return
    if cur == "BUILD" and new == "QA_CASES":
        return
    raise Refuse("transition %s -> %s not allowed" % (cur, new))


def cmd_set_state(slug, new):
    p, lines, body = load(slug)
    cur = fm_get(lines, "state")
    check_transition(slug, lines, cur, new)
    fm_set(lines, "state", new)
    fm_set(lines, "blocked", "true" if new == "BLOCKED_NEEDS_HUMAN" else "false")
    save(p, lines, body)
    print("%s: %s -> %s" % (slug, cur, new))


def cmd_set(slug, key, value):
    if key not in ("last_agent",):
        raise Refuse("use set-state for state; only last_agent can be set directly")
    p, lines, body = load(slug)
    fm_set(lines, key, value)
    save(p, lines, body)


def cmd_require_state(slug, *allowed):
    _, lines, _ = load(slug)
    cur = fm_get(lines, "state")
    if cur not in allowed:
        raise Refuse("state is %s, command requires one of: %s" % (cur, ", ".join(allowed)))
    print(cur)


def cmd_loop(slug, kind, op):
    p, lines, body = load(slug)
    key = LOOP_KINDS[kind][3]
    m = re.search(r"%s:\s*(\d+)" % key, fm_get(lines, "loop_counts"))
    n = int(m.group(1))
    if op == "get":
        print(n)
        return
    n += 1
    lc = re.sub(r"(%s:\s*)\d+" % key, r"\g<1>%d" % n, fm_get(lines, "loop_counts"))
    fm_set(lines, "loop_counts", lc)
    if n >= 3:
        fm_set(lines, "state", "BLOCKED_NEEDS_HUMAN")
        fm_set(lines, "blocked", "true")
        print("loop cap reached for %s (%d): BLOCKED_NEEDS_HUMAN, write the one-page disagreement summary" % (kind, n))
    else:
        print("%s loop_count = %d" % (kind, n))
    save(p, lines, body)


def cmd_apply_review(slug, kind, review_file):
    if kind not in LOOP_KINDS:
        raise Refuse("unknown kind %s" % kind)
    art, appr, by, _ = LOOP_KINDS[kind]
    rp = review_file if os.path.isabs(review_file) else os.path.join(ROOT, review_file)
    if not os.path.isfile(rp):
        raise Refuse("review file missing")
    verdict, nb, nn = validate_review(rp, slug, art)
    p, lines, body = load(slug)
    if verdict == "APPROVE":
        if appr:
            approval_set(lines, appr, {"by": by, "hash": artifact_hash(slug, art), "valid": "true"})
            save(p, lines, body)
        print("APPROVE recorded for %s (0 blocking, %d non-blocking)" % (kind, nn))
    else:
        print("%s: %d blocking issues, incrementing loop" % (verdict, nb))
        cmd_loop(slug, kind, "inc")


def cmd_validate_review(path):
    v, nb, nn = validate_review(path if os.path.isabs(path) else os.path.join(ROOT, path))
    print("review ok: %s (%d blocking, %d non-blocking)" % (v, nb, nn))


def cmd_revalidate(slug):
    p, lines, body = load(slug)
    changed = []
    for name in ("prd", "design", "tdd"):
        a = approval_get(lines, name)
        if a["valid"] == "true" and a["hash"] != "null":
            try:
                cur = artifact_hash(slug, name)
            except Refuse:
                cur = None
            if cur != a["hash"]:
                a["valid"] = "false"
                approval_set(lines, name, a)
                changed.append(name)
    for gate, (_, _, aname, _) in GATES.items():
        a = approval_get(lines, aname)
        if a["valid"] == "true":
            try:
                verify_decision(slug, gate, quiet=True)
            except Refuse:
                a["valid"] = "false"
                approval_set(lines, aname, a)
                changed.append(aname)
    save(p, lines, body)
    if changed:
        print("INVALIDATED approvals: %s. Reopen the relevant gate with a delta-only brief." % ", ".join(changed))
        sys.exit(1)
    print("all recorded approvals still match their hashes")


def brief_names(slug, gate):
    d = feat(slug)
    bp = os.path.join(d, GATES[gate][1])
    if not os.path.isfile(bp):
        raise Refuse("brief missing: %s" % rel(bp))
    lines, _ = split_fm(bp)
    v = fm_get(lines, "artifacts_hashed") or "[]"
    names = [x.strip() for x in v.strip("[]").split(",") if x.strip()]
    if not names:
        raise Refuse("brief lists no artifacts_hashed")
    bid = fm_get(lines, "build_id")
    return bp, names, bid


def collect_hashes(slug, gate):
    bp, names, bid = brief_names(slug, gate)
    paths = [bp]
    for n in names:
        paths += artifact_paths(slug, n)
    paths = sorted(set(paths))
    return paths, bid


def cmd_snapshot_brief(slug, gate):
    paths, bid = collect_hashes(slug, gate)
    snap = {rel(p): sha_file(p) for p in paths}
    with open(os.path.join(feat(slug), ".brief-%s.snapshot" % gate), "w") as f:
        json.dump({"build_id": bid, "files": snap}, f, indent=1, sort_keys=True)
    print("snapshot of %d files written for %s brief" % (len(snap), gate))


def next_decision_n(slug, gate):
    ns = [int(m.group(1)) for f in os.listdir(feat(slug)) for m in [re.match(r"^ceo-decision-%s-(\d+)\.md$" % gate, f)] if m]
    return max(ns) + 1 if ns else 1


def cmd_record_decision(slug, gate, decision, notes, *rest):
    if gate not in GATES or decision not in DECISIONS:
        raise Refuse("usage: record-decision <slug> predev|release approve|conditions|changes|reject \"notes\" [--condition text]...")
    conds = [rest[i + 1] for i, a in enumerate(rest) if a == "--condition" and i + 1 < len(rest)]
    if decision == "conditions" and not conds:
        raise Refuse("conditions decision needs at least one --condition")
    p, lines, body = load(slug)
    want_state, _, aname, next_state = GATES[gate]
    cur = fm_get(lines, "state")
    if cur != want_state:
        raise Refuse("state is %s, gate %s needs %s" % (cur, gate, want_state))
    sp = os.path.join(feat(slug), ".brief-%s.snapshot" % gate)
    if not os.path.isfile(sp):
        raise Refuse("no brief snapshot: run /ceo-brief first")
    snap = json.load(open(sp))
    paths, bid = collect_hashes(slug, gate)
    cur_files = {rel(x): sha_file(x) for x in paths}
    if cur_files != snap["files"] or bid != snap["build_id"]:
        print("STALE BRIEF: artifacts changed since the brief was compiled. Rerun /ceo-brief. No decision recorded.", file=sys.stderr)
        sys.exit(3)
    n = next_decision_n(slug, gate)
    fn = os.path.join(feat(slug), "ceo-decision-%s-%d.md" % (gate, n))
    out = ["---", "gate: %s" % gate, "feature: %s" % slug, "decision: %s" % DECISIONS[decision],
           "timestamp: %s" % now(), "build_id: %s" % (bid or "null"), "hash_bundle: %s" % bundle_hash(paths), "artifacts:"]
    out += ["  - %s: %s" % (k, v) for k, v in sorted(cur_files.items())]
    out += ["conditions:"] + ["  - %s" % c for c in conds] if conds else ["conditions: []"]
    out += ["---", "", "CEO notes (verbatim):", "", notes, ""]
    with open(fn, "x", encoding="utf-8") as f:
        f.write("\n".join(out))
    ok = decision in ("approve", "conditions")
    approval_set(lines, aname, {"decision": DECISIONS[decision], "hash_bundle": bundle_hash(paths),
                                "valid": "true" if ok else "false", **({"build_id": bid or "null"} if gate == "release" else {})})
    if conds:
        cl = [i for i, ln in enumerate(lines) if ln.startswith("conditions:")][0]
        lines[cl] = "conditions:"
        j = cl + 1
        while j < len(lines) and lines[j].startswith("  - "):
            j += 1
        lines[cl + 1:j] = lines[cl + 1:j] + ["  - { id: %s-%d-C%d, owner: unassigned, status: open, text: %s }" % (gate, n, i + 1, json.dumps(c)) for i, c in enumerate(conds)]
    save(p, lines, body)
    print("wrote %s" % rel(fn))
    if ok:
        cmd_set_state(slug, next_state)
    elif decision == "reject":
        cmd_set_state(slug, "REJECTED")
        with open(os.path.join(ROOT, "docs", "decisions.md"), "a", encoding="utf-8") as f:
            f.write("| %s | %s | CEO REJECT at %s gate | CEO | %s |\n" % (now()[:10], slug, gate, notes.replace("|", "/").replace("\n", " ")))
    else:
        print("Next: open a change request (/change), re-review affected artifacts, send a delta-only brief.")


def verify_decision(slug, gate, build_id=None, ci=False, quiet=False):
    d = feat(slug)
    fs = sorted(f for f in os.listdir(d) if re.match(r"^ceo-decision-%s-\d+\.md$" % gate, f))
    if not fs:
        raise Refuse("no ceo-decision-%s file for %s" % (gate, slug))
    latest = fs[-1]
    lines, _ = split_fm(os.path.join(d, latest))
    dec = fm_get(lines, "decision")
    if dec not in ("APPROVE", "APPROVE_WITH_CONDITIONS"):
        raise Refuse("latest decision %s is %s, not an approval" % (latest, dec))
    arts = {}
    for ln in lines:
        m = re.match(r"^  - (\S+): ([0-9a-f]{64})$", ln)
        if m:
            arts[m.group(1)] = m.group(2)
    if not arts:
        raise Refuse("decision file lists no artifacts")
    for pth, h in arts.items():
        fp = os.path.join(ROOT, pth)
        if not os.path.isfile(fp):
            raise Refuse("artifact missing since decision: %s" % pth)
        if sha_file(fp) != h:
            raise Refuse("artifact changed since CEO decision: %s (approval invalid)" % pth)
    if bundle_hash([os.path.join(ROOT, x) for x in arts]) != fm_get(lines, "hash_bundle"):
        raise Refuse("hash_bundle mismatch")
    if gate == "release":
        bid = fm_get(lines, "build_id")
        if not bid or bid == "null":
            raise Refuse("release decision has no build id")
        if build_id and build_id != bid:
            raise Refuse("build id %s differs from CEO-approved build id %s" % (build_id, bid))
        if ci and not build_id:
            raise Refuse("CI must pass --build-id")
    if ci:
        ident = os.path.join(ROOT, "docs", "ceo-identity.txt")
        email = open(ident).read().strip() if os.path.isfile(ident) else ""
        if not email or "PLACEHOLDER" in email:
            raise Refuse("docs/ceo-identity.txt not set to the CEO's email")
        target = rel(os.path.join(d, latest))
        if subprocess.run(["git", "diff", "--quiet", "HEAD", "--", target], cwd=ROOT).returncode != 0:
            raise Refuse("decision file not committed or modified since commit")
        out = subprocess.run(["git", "log", "-1", "--format=%ae %G?", "--", target], cwd=ROOT, capture_output=True, text=True).stdout.strip()
        try:
            ae, sig = out.split()
        except ValueError:
            raise Refuse("decision file has no git history")
        if ae.lower() != email.lower():
            raise Refuse("decision committed by %s, not the CEO (%s)" % (ae, email))
        if sig != "G":
            raise Refuse("decision commit signature status %r, need a good signature (G)" % sig)
    if not quiet:
        print("decision %s valid for %s (%s)" % (latest, slug, dec))
    return latest


def cmd_verify_decision(slug, gate, *rest):
    bid = rest[rest.index("--build-id") + 1] if "--build-id" in rest else None
    verify_decision(slug, gate, build_id=bid, ci="--ci" in rest)


def cmd_log(*args):
    """log <agent> <slug|-> <task> <outcome> [extra]   or   log-hook (reads hook JSON on stdin)."""
    os.makedirs(os.path.join(ROOT, "logs"), exist_ok=True)
    rec = {"ts": now(), "agent": args[0], "feature": args[1], "task": args[2], "outcome": args[3]}
    if len(args) > 4:
        rec["detail"] = args[4]
    with open(os.path.join(ROOT, "logs", "agent-runs.jsonl"), "a", encoding="utf-8") as f:
        f.write(json.dumps(rec) + "\n")


def cmd_log_hook():
    try:
        data = json.load(sys.stdin)
    except Exception:
        data = {}
    cmd_log(data.get("agent_type") or "main", "-", data.get("hook_event_name", "SubagentStop"),
            "stopped", (data.get("last_assistant_message") or "")[:200].replace("\n", " "))


def cmd_snapshot(out):
    r = subprocess.run(["git", "ls-files", "-z", "-co", "--exclude-standard"], cwd=ROOT, capture_output=True)
    inv = {}
    for pth in r.stdout.decode().split("\0"):
        if pth and os.path.isfile(os.path.join(ROOT, pth)):
            inv[pth] = sha_file(os.path.join(ROOT, pth))
    json.dump(inv, open(out, "w"))
    print("snapshot of %d files" % len(inv))


def cmd_diff_scope(role, snapshot_file):
    before = json.load(open(snapshot_file))
    r = subprocess.run(["git", "ls-files", "-z", "-co", "--exclude-standard"], cwd=ROOT, capture_output=True)
    after = {}
    for pth in r.stdout.decode().split("\0"):
        if pth and os.path.isfile(os.path.join(ROOT, pth)):
            after[pth] = sha_file(os.path.join(ROOT, pth))
    changed = sorted(k for k in set(before) | set(after) if before.get(k) != after.get(k))
    bad = []
    for pth in changed:
        if subprocess.run([os.path.join(ROOT, "scripts", "check-write-scope.sh"), role, pth], capture_output=True).returncode != 0:
            bad.append(pth)
    print("%d files changed by %s" % (len(changed), role))
    if bad:
        print("OUT OF SCOPE changes (revert them and flag):\n  " + "\n  ".join(bad), file=sys.stderr)
        sys.exit(1)


WAIVABLE = {"design": "designer", "tdd_review": "principal-engineer", "code_review": "principal-engineer"}


def cmd_waive(slug, name):
    """Pilot waiver: allowed only while the reviewing agent is parked (BUILD_PLAN v2, Phase 1)."""
    if name not in WAIVABLE:
        raise Refuse("waivable: %s" % ", ".join(sorted(WAIVABLE)))
    agent = WAIVABLE[name]
    if os.path.isfile(os.path.join(ROOT, ".claude", "agents", agent + ".md")):
        raise Refuse("%s is active, so '%s' cannot be waived" % (agent, name))
    p, lines, body = load(slug)
    w = waivers(lines) | {name}
    fm_set(lines, "pilot_waivers", "[%s]" % ", ".join(sorted(w)))
    save(p, lines, body)
    print("waiver recorded: %s (agent %s is parked)" % (name, agent))


def cmd_status(slug=None):
    base = os.path.join(ROOT, "docs", "features")
    slugs = [slug] if slug else sorted(d for d in os.listdir(base) if os.path.isfile(os.path.join(base, d, "status.md")))
    if not slugs:
        print("no features yet")
    for s in slugs:
        p, lines, _ = load(s)
        print("== %s ==" % s)
        for k in ("state", "blocked", "loop_counts", "pilot_waivers", "last_agent"):
            print("  %s: %s" % (k, fm_get(lines, k)))
        for n in ("prd", "design", "tdd"):
            a = approval_get(lines, n)
            cur = "n/a"
            if a["hash"] != "null":
                try:
                    cur = "matches" if artifact_hash(s, n) == a["hash"] else "CHANGED SINCE APPROVAL"
                except Refuse:
                    cur = "artifact missing"
            print("  approval %s: valid=%s file %s" % (n, a["valid"], cur))
        for n in ("ceo_predev", "ceo_release"):
            a = approval_get(lines, n)
            print("  approval %s: decision=%s valid=%s" % (n, a.get("decision"), a["valid"]))
        open_c = [ln.strip() for ln in lines if ln.startswith("  - {")]
        print("  conditions: %s" % (open_c or "none"))
    lp = os.path.join(ROOT, "logs", "agent-runs.jsonl")
    if os.path.isfile(lp):
        tail = open(lp).read().strip().split("\n")[-5:]
        print("last log lines:\n  " + "\n  ".join(tail))
    print("cost: not recorded (hook input has no token counts; COULD NOT VERIFY a source)")


COMMANDS = {
    "waive": cmd_waive, "status": cmd_status,
    "init": cmd_init, "get": cmd_get, "set": cmd_set, "set-state": cmd_set_state,
    "require-state": cmd_require_state, "loop": cmd_loop, "apply-review": cmd_apply_review,
    "validate-review": cmd_validate_review, "revalidate": cmd_revalidate,
    "snapshot-brief": cmd_snapshot_brief, "record-decision": cmd_record_decision,
    "verify-decision": cmd_verify_decision, "log": cmd_log, "log-hook": cmd_log_hook,
    "snapshot": cmd_snapshot, "diff-scope": cmd_diff_scope,
}

if __name__ == "__main__":
    if len(sys.argv) < 2 or sys.argv[1] not in COMMANDS:
        die("usage: aidev.py <%s> ..." % "|".join(COMMANDS), 2)
    try:
        COMMANDS[sys.argv[1]](*sys.argv[2:])
    except Refuse as e:
        die("REFUSED: %s" % e, 1)
    except TypeError as e:
        die("usage error: %s" % e, 2)
