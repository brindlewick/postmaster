#!/usr/bin/env bash
# Decide whether a git change touches the coachman contract, defined as a list
# of files in docs/coachman-contract.toml. A change anywhere in a listed file
# is a contract change.
#
#   coachman-contract.sh <base> <head>
#   coachman-contract.sh [<repo>] <base> <head>   (or --repo <repo> <base> <head>)
#   coachman-contract.sh --self-test
#
#   exit 0  no contract change
#   exit 1  contract change; print each listed file the change touched
#   exit 2  usage, git or contract-list error
set -uo pipefail
HERE=$(cd "$(dirname "$0")" && pwd -P)

python3 - "$HERE" "$@" <<'PY'
import os, pathlib, shutil, subprocess, sys, tempfile, tomllib


INDEX = "docs/coachman-contract.toml"


class ContractError(Exception):
    pass


def run(argv, *, cwd=None, check=True, env=None, text=True):
    p = subprocess.run(argv, cwd=cwd, capture_output=True, text=text, env=env)
    if check and p.returncode:
        detail = p.stderr.strip() or p.stdout.strip() or "exit %d" % p.returncode
        raise ContractError("%s: %s" % (" ".join(map(str, argv)), detail))
    return p


def blob(repo, rev, path):
    p = run(["git", "-C", str(repo), "show", "%s:%s" % (rev, path)], check=False, text=False)
    if p.returncode:
        return None
    return p.stdout.decode("latin-1")


def read_index(repo, rev):
    raw = blob(repo, rev, INDEX)
    if raw is None:
        return None
    try:
        data = tomllib.loads(raw)
    except tomllib.TOMLDecodeError as e:
        raise ContractError("%s at %s is invalid TOML: %s" % (INDEX, rev, e))
    if data.get("version") != 1:
        raise ContractError("%s at %s must set version = 1" % (INDEX, rev))
    detector = data.get("detector")
    if (not isinstance(detector, str) or not detector or detector.startswith("/")
            or ".." in pathlib.PurePosixPath(detector).parts):
        raise ContractError("%s at %s must name its detector file" % (INDEX, rev))
    files = data.get("files")
    if not isinstance(files, list) or not files:
        raise ContractError("%s at %s must list its contract files" % (INDEX, rev))
    seen = set()
    for entry in files:
        path = entry.get("path")
        holds = entry.get("holds")
        if (not isinstance(path, str) or not path or path.startswith("/")
                or ".." in pathlib.PurePosixPath(path).parts or path in seen
                or not isinstance(holds, str) or not holds.strip()):
            raise ContractError("%s at %s has a bad contract file entry" % (INDEX, rev))
        seen.add(path)
    return data


def changed_files(repo, base, head):
    p = run(["git", "-C", str(repo), "diff", "--no-ext-diff", "--no-renames",
             "--name-only", "-z", base, head, "--"], text=False)
    return [name for name in p.stdout.decode("latin-1").split("\0") if name]


def check_change(repo, base, head):
    repo = pathlib.Path(repo).resolve()
    for rev in (base, head):
        run(["git", "-C", str(repo), "rev-parse", "--verify", "%s^{commit}" % rev])
    base_index = read_index(repo, base)
    head_index = read_index(repo, head)
    if base_index is None and head_index is None:
        return []
    listed = set()
    for data in (base_index, head_index):
        if data:
            for entry in data["files"]:
                listed.add(entry["path"])
    return sorted(set(changed_files(repo, base, head)) & listed)


def print_result(touched, base, head):
    if not touched:
        print("no coachman contract change (%s..%s)" % (base, head))
        return 0
    for path in touched:
        print("yes %s" % path)
    return 1


def control(ok, name, detail=""):
    print("  %s %s%s" % ("ok  " if ok else "FAIL", name, (": " + detail) if detail else ""))
    return ok


def git_fixture(repo, root, source_root, manifest_data):
    repo.mkdir(parents=True)
    shutil.copy2(source_root / "scripts" / "coachman-contract.sh", repo / "coachman-contract.sh")
    for entry in manifest_data["files"]:
        source = source_root / entry["path"]
        target = repo / entry["path"]
        target.parent.mkdir(parents=True, exist_ok=True)
        if not target.exists():
            shutil.copy2(source, target)
    (repo / "skills/postmaster/harnesses.md").parent.mkdir(parents=True, exist_ok=True)
    (repo / "README.md").write_text("fixture\n", encoding="utf-8")
    run(["git", "init", "-q", "-b", "main", str(repo)])
    run(["git", "-C", str(repo), "config", "user.name", "brindlewick"])
    run(["git", "-C", str(repo), "config", "user.email", "332054101+brindlewick@users.noreply.github.com"])
    os.chmod(repo / "coachman-contract.sh", 0o755)
    run(["git", "-C", str(repo), "add", "."])
    run(["git", "-C", str(repo), "commit", "-q", "-m", "fixture baseline"])
    return run(["git", "-C", str(repo), "rev-parse", "HEAD"]).stdout.strip()


def commit_fixture(repo, message):
    run(["git", "-C", str(repo), "add", "."])
    run(["git", "-C", str(repo), "commit", "-q", "-m", message])
    return run(["git", "-C", str(repo), "rev-parse", "HEAD"]).stdout.strip()


def exercise_self_test(source_root):
    index_path = source_root / INDEX
    try:
        manifest_data = tomllib.loads(index_path.read_text(encoding="utf-8"))
    except (OSError, tomllib.TOMLDecodeError) as e:
        raise ContractError("cannot read the current contract index: %s" % e)
    script = pathlib.Path(sys.argv[1]) / "coachman-contract.sh"
    passed = 0
    failed = 0
    print("coachman-contract self-test")

    def run_case(label, edit, expected_file=None):
        nonlocal passed, failed
        with tempfile.TemporaryDirectory(prefix="coachman-contract-", dir=source_root) as scratch:
            repo = pathlib.Path(scratch) / "repo"
            base = git_fixture(repo, pathlib.Path(scratch), source_root, manifest_data)
            edit(repo)
            head = commit_fixture(repo, label)
            result = subprocess.run([str(repo / "coachman-contract.sh"), base, head], cwd=repo,
                                    capture_output=True, text=True)
            expected_code = 1 if expected_file else 0
            ok = result.returncode == expected_code
            output = result.stdout
            if expected_file:
                ok = ok and any(line == "yes %s" % expected_file for line in output.splitlines())
            else:
                ok = ok and output.startswith("no coachman contract change")
            if control(ok, label, "exit %d" % result.returncode):
                passed += 1
            else:
                failed += 1
                if result.stderr:
                    print("       " + result.stderr.strip().replace("\n", "\n       "))
                if output:
                    print("       " + output.strip().replace("\n", "\n       "))

    def replace_once(repo, path, before, after):
        target = repo / path
        content = target.read_text(encoding="utf-8")
        if before not in content:
            raise ContractError("self-test fixture is missing %r in %s" % (before, path))
        target.write_text(content.replace(before, after, 1), encoding="utf-8")

    run_case("editing the contract list itself answers yes",
             lambda repo: replace_once(repo, INDEX,
                                       'holds = "the required handoff sections"',
                                       'holds = "the required handoff sections, every one of them"'),
             INDEX)
    run_case("a wording fix in coachman.md answers yes",
             lambda repo: replace_once(repo, "skills/postmaster/coachman.md",
                                       "will be killed and restarted.",
                                       "will be killed, then restarted."),
             "skills/postmaster/coachman.md")
    run_case("a wording fix in postmaster.md answers yes",
             lambda repo: replace_once(repo, "skills/postmaster/postmaster.md",
                                       "You run no model lane and edit no source.",
                                       "You run no model lane and edit no source at all."),
             "skills/postmaster/postmaster.md")
    run_case("a wording fix in the waybill template answers yes",
             lambda repo: replace_once(repo, "skills/postmaster/SKILL.md",
                                       "(the postmaster sets yes or no at the final card)",
                                       "(the postmaster sets yes or no there)"),
             "skills/postmaster/SKILL.md")
    run_case("a wording fix in host.sh answers yes",
             lambda repo: replace_once(repo, "scripts/host.sh",
                                       "# never an earlier launch's pid",
                                       "# never an earlier launch's pid here"),
             "scripts/host.sh")
    run_case("a change in runs-status.sh answers yes",
             lambda repo: replace_once(repo, "scripts/runs-status.sh",
                                       '"IDLE", "NEXT"', '"IDLE", "NEXT!"'),
             "scripts/runs-status.sh")
    run_case("a wording fix in turnpikes.sh answers yes",
             lambda repo: replace_once(repo, "scripts/turnpikes.sh",
                                       "# name     set      leg     what it checks",
                                       "# name     set      leg     what each checks"),
             "scripts/turnpikes.sh")
    run_case("a wording fix in stage.sh answers yes",
             lambda repo: replace_once(repo, "scripts/stage.sh",
                                       "#   exit 4  a terminal stage, or shipped on a contract 2 run, set by any actor but the postmaster",
                                       "#   exit 4  a terminal stage, or shipped on a contract-2 run, set by any actor but the postmaster"),
             "scripts/stage.sh")
    run_case("a wording fix in handoff-check.sh answers yes",
             lambda repo: replace_once(repo, "scripts/handoff-check.sh",
                                       "#   exit 0  every section present and non-empty",
                                       "#   exit 0  every section present, and none empty"),
             "scripts/handoff-check.sh")
    run_case("a wording fix in the detector answers yes",
             lambda repo: replace_once(repo, "scripts/coachman-contract.sh",
                                       "#   exit 2  usage, git or contract-list error",
                                       "#   exit 2  usage, git, or contract-list error"),
             "scripts/coachman-contract.sh")
    run_case("a wiki-only change is not a contract change",
             lambda repo: (repo / "wiki/concepts/probe-note.md").parent.mkdir(parents=True, exist_ok=True) or
                          (repo / "wiki/concepts/probe-note.md").write_text("notes\n", encoding="utf-8"))
    run_case("a README-only change is not a contract change",
             lambda repo: (repo / "README.md").write_text(
                 (repo / "README.md").read_text(encoding="utf-8") + "More fixture.\n", encoding="utf-8"))
    run_case("adding a harness entry is not a contract change",
             lambda repo: (repo / "skills/postmaster/harnesses.md").write_text("\nNew harness entry.\n", encoding="utf-8"))
    run_case("ticket prose naming the contract is not a contract change",
             lambda repo: (repo / "TICKET.md").write_text(
                 "## Problem\n\nThis changes the coachman contract and the markers.\n", encoding="utf-8"))

    def neutered_control():
        nonlocal passed, failed
        label = "neutering the detector entrypoint is a contract change"
        with tempfile.TemporaryDirectory(prefix="coachman-contract-", dir=source_root) as scratch:
            repo = pathlib.Path(scratch) / "repo"
            base = git_fixture(repo, pathlib.Path(scratch), source_root, manifest_data)
            shown = run(["git", "-C", str(repo), "show",
                         "%s:scripts/coachman-contract.sh" % base], text=False)
            honest = pathlib.Path(scratch) / "honest-contract.sh"
            honest.write_bytes(shown.stdout)
            os.chmod(honest, 0o755)
            for path in ("coachman-contract.sh", "scripts/coachman-contract.sh"):
                replace_once(repo, path,
                             "    try:\n        return print_result(check_change(repo, base, head), base, head)",
                             "    try:\n        return 0")
            head = commit_fixture(repo, label)
            neutered = subprocess.run([str(repo / "coachman-contract.sh"), base, head], cwd=repo,
                                      capture_output=True, text=True)
            result = subprocess.run([str(honest), base, head], cwd=repo,
                                    capture_output=True, text=True)
            ok = (neutered.returncode == 0 and result.returncode == 1 and any(
                line == "yes scripts/coachman-contract.sh" for line in result.stdout.splitlines()))
            if control(ok, label, "exits %d/%d" % (neutered.returncode, result.returncode)):
                passed += 1
            else:
                failed += 1
                if result.stderr:
                    print("       " + result.stderr.strip().replace("\n", "\n       "))
                if result.stdout:
                    print("       " + result.stdout.strip().replace("\n", "\n       "))

    neutered_control()

    def version_control():
        nonlocal passed, failed
        label = "an index that does not set version 1 is an error"
        with tempfile.TemporaryDirectory(prefix="coachman-contract-", dir=source_root) as scratch:
            repo = pathlib.Path(scratch) / "repo"
            base = git_fixture(repo, pathlib.Path(scratch), source_root, manifest_data)
            replace_once(repo, INDEX, "version = 1", "version = 2")
            head = commit_fixture(repo, label)
            result = subprocess.run([str(repo / "coachman-contract.sh"), base, head], cwd=repo,
                                    capture_output=True, text=True)
            ok = result.returncode == 2 and "version" in result.stderr
            if control(ok, label, "exit %d" % result.returncode):
                passed += 1
            else:
                failed += 1
                if result.stderr:
                    print("       " + result.stderr.strip().replace("\n", "\n       "))
                if result.stdout:
                    print("       " + result.stdout.strip().replace("\n", "\n       "))

    version_control()

    def detector_control():
        nonlocal passed, failed
        label = "an index that names no detector file is an error"
        with tempfile.TemporaryDirectory(prefix="coachman-contract-", dir=source_root) as scratch:
            repo = pathlib.Path(scratch) / "repo"
            base = git_fixture(repo, pathlib.Path(scratch), source_root, manifest_data)
            replace_once(repo, INDEX, 'detector = "scripts/coachman-contract.sh"\n', "")
            head = commit_fixture(repo, label)
            result = subprocess.run([str(repo / "coachman-contract.sh"), base, head], cwd=repo,
                                    capture_output=True, text=True)
            ok = result.returncode == 2 and "detector" in result.stderr
            if control(ok, label, "exit %d" % result.returncode):
                passed += 1
            else:
                failed += 1
                if result.stderr:
                    print("       " + result.stderr.strip().replace("\n", "\n       "))
                if result.stdout:
                    print("       " + result.stdout.strip().replace("\n", "\n       "))

    detector_control()

    def merge_control(contract):
        nonlocal passed, failed
        label = "main merge with a contract change repeats the fixture" if contract else "main merge without a contract change keeps the fixture"
        with tempfile.TemporaryDirectory(prefix="coachman-contract-", dir=source_root) as scratch:
            repo = pathlib.Path(scratch) / "repo"
            base = git_fixture(repo, pathlib.Path(scratch), source_root, manifest_data)
            run(["git", "-C", str(repo), "switch", "-q", "-c", "feature"])
            run(["git", "-C", str(repo), "switch", "-q", "main"])
            if contract:
                replace_once(repo, "scripts/stage.sh",
                             "#   exit 4  a terminal stage, or shipped on a contract 2 run, set by any actor but the postmaster",
                             "#   exit 4  a terminal stage, or shipped on a contract-2 run, set by any actor but the postmaster")
                part = "scripts/stage.sh"
            else:
                (repo / "skills/postmaster/harnesses.md").write_text("new harness\n", encoding="utf-8")
                part = None
            commit_fixture(repo, "change on main")
            run(["git", "-C", str(repo), "switch", "-q", "feature"])
            run(["git", "-C", str(repo), "merge", "-q", "--no-ff", "main", "-m", "merge main"])
            head = run(["git", "-C", str(repo), "rev-parse", "HEAD"]).stdout.strip()
            result = subprocess.run([str(repo / "coachman-contract.sh"), base, head], cwd=repo,
                                    capture_output=True, text=True)
            ok = result.returncode == (1 if contract else 0)
            if part:
                ok = ok and any(line == "yes %s" % part for line in result.stdout.splitlines())
            else:
                ok = ok and result.stdout.startswith("no coachman contract change")
            if control(ok, label, "exit %d" % result.returncode):
                passed += 1
            else:
                failed += 1
                if result.stderr:
                    print("       " + result.stderr.strip().replace("\n", "\n       "))
                if result.stdout:
                    print("       " + result.stdout.strip().replace("\n", "\n       "))

    merge_control(True)
    merge_control(False)

    def repo_form_control():
        nonlocal passed, failed
        label = "the [repo] base head form classifies from outside the repo"
        with tempfile.TemporaryDirectory(prefix="coachman-contract-", dir=source_root) as scratch:
            repo = pathlib.Path(scratch) / "repo"
            base = git_fixture(repo, pathlib.Path(scratch), source_root, manifest_data)
            replace_once(repo, "scripts/stage.sh",
                         "#   exit 4  a terminal stage, or shipped on a contract 2 run, set by any actor but the postmaster",
                         "#   exit 4  a terminal stage, or shipped on a contract-2 run, set by any actor but the postmaster")
            head = commit_fixture(repo, label)
            result = subprocess.run([str(repo / "coachman-contract.sh"), str(repo), base, head],
                                    cwd=source_root, capture_output=True, text=True)
            ok = result.returncode == 1 and any(
                line == "yes scripts/stage.sh" for line in result.stdout.splitlines())
            if control(ok, label, "exit %d" % result.returncode):
                passed += 1
            else:
                failed += 1
                if result.stderr:
                    print("       " + result.stderr.strip().replace("\n", "\n       "))
                if result.stdout:
                    print("       " + result.stdout.strip().replace("\n", "\n       "))

    repo_form_control()
    print("coachman-contract self-test: %d passed, %d failed" % (passed, failed))
    return 0 if failed == 0 else 1


def main():
    args = sys.argv[2:]
    if not args:
        print("usage: coachman-contract.sh [<repo>] <base> <head> | --self-test", file=sys.stderr)
        return 2
    if args[0] == "--self-test":
        if len(args) != 1:
            print("usage: coachman-contract.sh --self-test", file=sys.stderr)
            return 2
        try:
            source_root = pathlib.Path(sys.argv[1]).resolve().parent
            return exercise_self_test(source_root)
        except ContractError as e:
            print("coachman-contract: %s" % e, file=sys.stderr)
            return 2
    if args[0] == "--repo" and len(args) == 4:
        _, repo, base, head = args
    elif len(args) == 2:
        repo_result = run(["git", "rev-parse", "--show-toplevel"], check=False)
        if repo_result.returncode:
            print("coachman-contract: run from a git repository or pass --repo", file=sys.stderr)
            return 2
        repo, base, head = repo_result.stdout.strip(), args[0], args[1]
    elif len(args) == 3:
        repo, base, head = args
    else:
        print("usage: coachman-contract.sh [<repo>] <base> <head> | --self-test", file=sys.stderr)
        return 2
    try:
        return print_result(check_change(repo, base, head), base, head)
    except ContractError as e:
        print("coachman-contract: %s" % e, file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
PY
