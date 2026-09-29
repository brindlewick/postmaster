#!/usr/bin/env python3
"""Extract MiMo Code's own JavaScript from its Bun executable, to run it on another Bun.

    extract.py <mimocode binary> <bun> <out dir>

MiMo Code 0.1.15 ships as a Bun 1.3.14 standalone executable (`.mimocode` beside its npm
launcher). Its modules sit in the ELF section `.bun`: a u64 payload length, the payload, then a
32-byte offsets record and the trailer `\\n---- Bun! ----\\n`. The offsets name the module table
(52-byte records: six string pointers, then encoding, loader, format and side), the entry point
and the runtime arguments the executable was built with. Each module is written under <out dir>
at its path below `/$bunfs/root/`, and every `"/$bunfs/root/` in a module's text is pointed at
<out dir>, so imports and bundled assets resolve there. <out dir>/mimo runs the entry point on
<bun> with the executable's own runtime arguments; MiMo Code's launcher runs it when
MIMOCODE_BIN_PATH names it, and MiMo Code re-runs itself through the same variable.

Anything that does not match that layout is refused: exit 1, nothing written.
"""
import hashlib, os, shlex, stat, struct, sys

TRAILER = b"\n---- Bun! ----\n"
ROOT = "/$bunfs/root/"
RECORD = 52


def die(msg):
    sys.exit(f"extract: {msg}")


def section(b, want):
    if b[:4] != b"\x7fELF" or b[4] != 2 or b[5] != 1:
        die("not a 64-bit little-endian ELF file")
    shoff = struct.unpack_from("<Q", b, 0x28)[0]
    shentsize, shnum, shstrndx = struct.unpack_from("<HHH", b, 0x3A)
    heads = [struct.unpack_from("<IIQQQQ", b, shoff + i * shentsize) for i in range(shnum)]
    names_at = heads[shstrndx][4]
    for name, _typ, _flags, _addr, off, size in heads:
        n = b[names_at + name:b.index(b"\0", names_at + name)].decode()
        if n == want:
            return b[off:off + size]
    die(f"no {want} section: not a Bun standalone executable")


def main():
    if len(sys.argv) != 4:
        die("usage: extract.py <mimocode binary> <bun> <out dir>")
    binary, bun, out = sys.argv[1], os.path.abspath(sys.argv[2]), os.path.abspath(sys.argv[3])
    b = open(binary, "rb").read()
    sec = section(b, ".bun")
    length = struct.unpack_from("<Q", sec, 0)[0]
    pay = sec[8:8 + length]
    if not pay.endswith(TRAILER):
        die("the .bun section does not end with Bun's trailer")
    end = len(pay) - len(TRAILER) - 32
    byte_count, mod_off, mod_len, entry, argv_off, argv_len, _flags = struct.unpack_from("<QIIIIII", pay, end)
    if byte_count != end or mod_len % RECORD or mod_off + mod_len > end:
        die("the offsets record does not describe this payload")

    def text(off, n):
        if off + n > end:
            die("a string pointer runs past the payload")
        return pay[off:off + n]

    mods = []
    for i in range(mod_len // RECORD):
        rec = struct.unpack_from("<12I", pay, mod_off + i * RECORD)
        name = text(rec[0], rec[1]).decode()
        if not name.startswith(ROOT):
            die(f"module {name!r} is not under {ROOT}")
        mods.append((name[len(ROOT):], text(rec[2], rec[3])))
    if not (0 <= entry < len(mods)) or not mods[entry][0].endswith(".js"):
        die("the entry point is not a JavaScript module")
    argv = [a for a in text(argv_off, argv_len).decode().split() if a != "--"]

    # A module may sit above the root (the TUI's parser worker is ../../node_modules/...), so the
    # root is nested as deep as the deepest climb, and every module lands inside <out dir>.
    climb = max(os.path.normpath(rel).split("/").count("..") for rel, _ in mods)
    base = os.path.join(out, *(["root"] * max(1, climb)))
    for rel, body in mods:
        path = os.path.normpath(os.path.join(base, rel))
        if not path.startswith(out + "/"):
            die(f"module {rel!r} would land outside {out}")
    os.makedirs(base, exist_ok=True)
    for rel, body in mods:
        path = os.path.normpath(os.path.join(base, rel))
        os.makedirs(os.path.dirname(path), exist_ok=True)
        if rel.endswith(".js"):
            body = body.replace(b'"' + ROOT.encode(), b'"' + base.encode() + b"/")
        with open(path, "wb") as f:
            f.write(body)
    main_js = os.path.join(base, mods[entry][0])
    mods = [(ROOT + rel, body) for rel, body in mods]
    digest = hashlib.sha256(b).hexdigest()
    launcher = os.path.join(out, "mimo")
    with open(launcher, "w") as f:
        f.write("#!/bin/sh\n")
        f.write(f"# MiMo Code's own modules, extracted from the executable with sha256 {digest},\n")
        f.write("# run on another Bun with the runtime arguments the executable was built with.\n")
        f.write(f"exec {shlex.quote(bun)} {' '.join(shlex.quote(a) for a in argv)} {shlex.quote(main_js)} \"$@\"\n")
    os.chmod(launcher, os.stat(launcher).st_mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH)
    print(f"{len(mods)} modules, entry {mods[entry][0]}, runtime arguments {' '.join(argv)}; launcher {launcher}")


main()
