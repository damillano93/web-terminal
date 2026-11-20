#!/usr/bin/env bash
#
# Build the Linux app as a .deb (Linux Mint, Ubuntu, Debian):
#
#   bash scripts/linux-deb.sh        # → linux/build/web-terminal_<version>_all.deb
#
# Install it with `sudo apt install ./web-terminal_<version>_all.deb`, which
# also pulls in GTK and WebKitGTK. Nothing is compiled: the app is one Python
# script, so the same package works on amd64 and arm64. Built with Python
# alone, so it runs on a Mac too (no dpkg needed).
set -euo pipefail
cd "$(dirname "$0")/.."

VERSION=$(sed -n 's/.*"version": *"\([^"]*\)".*/\1/p' package.json | head -1)
mkdir -p linux/build
OUT="linux/build/web-terminal_${VERSION}_all.deb"

python3 - "$VERSION" "$OUT" <<'PY'
import gzip, hashlib, io, os, sys, tarfile, time

version, out = sys.argv[1], sys.argv[2]
mtime = int(time.time())

app = open("linux/web-terminal", encoding="utf-8").read().replace("@VERSION@", version)
files = {   # path in the package → (bytes, mode)
    "usr/bin/web-terminal": (app.encode(), 0o755),
    "usr/share/applications/io.github.webterminal.App.desktop":
        (open("linux/io.github.webterminal.App.desktop", "rb").read(), 0o644),
    "usr/share/icons/hicolor/scalable/apps/io.github.webterminal.App.svg":
        (open("public/icons/icon.svg", "rb").read(), 0o644),
    "usr/share/icons/hicolor/512x512/apps/io.github.webterminal.App.png":
        (open("public/icons/icon-512.png", "rb").read(), 0o644),
    "usr/share/doc/web-terminal/copyright": (open("LICENSE", "rb").read(), 0o644),
}

# Nothing personal goes into a package that may end up on a releases page.
home = os.path.expanduser("~").encode()
for p, (d, _) in files.items():
    if home in d:
        sys.exit(f"error: {p} contains your home path")

def tar_gz(entries):
    """entries: {path: (bytes, mode)} → a gzip'd tar owned by root, with dirs."""
    raw = io.BytesIO()
    with tarfile.open(fileobj=raw, mode="w", format=tarfile.GNU_FORMAT) as t:
        dirs = sorted({"/".join(p.split("/")[:i]) for p in entries for i in range(1, p.count("/") + 1)})
        for d in ["."] + ["./" + d for d in dirs]:
            ti = tarfile.TarInfo(d)
            ti.type, ti.mode, ti.mtime = tarfile.DIRTYPE, 0o755, mtime
            ti.uname = ti.gname = "root"
            t.addfile(ti)
        for p in sorted(entries):
            data, mode = entries[p]
            ti = tarfile.TarInfo("./" + p)
            ti.size, ti.mode, ti.mtime = len(data), mode, mtime
            ti.uname = ti.gname = "root"
            t.addfile(ti, io.BytesIO(data))
    return gzip.compress(raw.getvalue(), mtime=mtime)

installed_kb = (sum(len(d) for d, _ in files.values()) + 1023) // 1024
control = f"""Package: web-terminal
Version: {version}
Section: utils
Priority: optional
Architecture: all
Depends: python3 (>= 3.8), python3-gi, gir1.2-gtk-3.0, gir1.2-webkit2-4.1 | gir1.2-webkit2-4.0
Installed-Size: {installed_kb}
Maintainer: web-terminal <web-terminal@users.noreply.github.com>
Homepage: https://github.com/damillano93/web-terminal
Description: desktop app for a web-terminal server
 A small GTK + WebKitGTK window on your web-terminal: no browser chrome,
 shortcuts that reach the terminal (Ctrl+Shift+T/W/N/C/V), native clipboard
 and image paste, desktop notifications and the last workspace on relaunch.
"""
md5 = "".join(f"{hashlib.md5(d).hexdigest()}  {p}\n" for p, (d, _) in sorted(files.items()))
ctrl = tar_gz({"control": (control.encode(), 0o644), "md5sums": (md5.encode(), 0o644)})
data = tar_gz(files)

def ar_member(name, payload):
    head = f"{name:<16}{mtime:<12}{0:<6}{0:<6}{0o100644:<8o}{len(payload):<10}`\n".encode()
    return head + payload + (b"\n" if len(payload) % 2 else b"")

with open(out, "wb") as f:
    f.write(b"!<arch>\n")
    f.write(ar_member("debian-binary", b"2.0\n"))
    f.write(ar_member("control.tar.gz", ctrl))
    f.write(ar_member("data.tar.gz", data))
PY

echo "$OUT"
