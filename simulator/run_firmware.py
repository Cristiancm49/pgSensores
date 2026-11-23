"""Ejecuta un .ino dentro del contenedor restringido firmware-runner."""

from __future__ import annotations

import argparse
import json
import subprocess
import tempfile
from pathlib import Path

IMAGE = "udlaiot-firmware-runner:local"
ALLOWED_FQBN = {"arduino:avr:uno", "arduino:avr:mega"}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("sketch", type=Path)
    parser.add_argument("--fqbn", choices=sorted(ALLOWED_FQBN), default="arduino:avr:uno")
    parser.add_argument("--engine", choices=["compile", "simavr", "renode"], default="simavr")
    parser.add_argument("--timeout", type=int, choices=range(1, 61), default=30)
    parser.add_argument("--renode-script", type=Path)
    parser.add_argument("--build-image", action="store_true")
    args = parser.parse_args()
    sketch = args.sketch.resolve(strict=True)
    if sketch.suffix.lower() != ".ino" or sketch.stat().st_size > 256 * 1024:
        parser.error("Solo se aceptan archivos .ino de hasta 256 KiB")
    root = Path(__file__).resolve().parents[1]
    if args.build_image:
        subprocess.run(
            ["docker", "build", "-t", IMAGE, str(root / "firmware-runner")],
            check=True,
            timeout=600,
        )
    with tempfile.TemporaryDirectory(prefix="udlaiot-firmware-") as temporary:
        workspace = Path(temporary) / "workspace"
        output = Path(temporary) / "output"
        workspace.mkdir()
        output.mkdir()
        (workspace / "sketch.ino").write_bytes(sketch.read_bytes())
        if args.engine == "renode":
            if args.renode_script is None:
                parser.error("Renode requiere --renode-script con una plataforma .resc")
            platform = args.renode_script.resolve(strict=True)
            if platform.suffix.lower() != ".resc" or platform.stat().st_size > 256 * 1024:
                parser.error("El script Renode debe ser .resc y no superar 256 KiB")
            (workspace / "platform.resc").write_bytes(platform.read_bytes())
        command = [
            "docker", "run", "--rm", "--network", "none", "--read-only",
            "--memory", "256m", "--memory-swap", "256m", "--cpus", "1",
            "--pids-limit", "64", "--cap-drop", "ALL", "--security-opt", "no-new-privileges",
            "--tmpfs", "/tmp:rw,noexec,nosuid,size=96m",
            "--mount", f"type=bind,src={workspace},dst=/workspace,readonly",
            "--mount", f"type=bind,src={output},dst=/output",
            IMAGE, "--fqbn", args.fqbn, "--engine", args.engine,
            "--timeout", str(args.timeout),
        ]
        completed = subprocess.run(
            command,
            check=False,
            text=True,
            capture_output=True,
            timeout=args.timeout + 10,
        )
        report_path = output / "report.json"
        report = json.loads(report_path.read_text(encoding="utf-8")) if report_path.exists() else {
            "ok": False,
            "returncode": completed.returncode,
            "stdout": completed.stdout[-12000:],
            "stderr": completed.stderr[-12000:],
        }
        print(json.dumps(report, ensure_ascii=False, indent=2))
        return 0 if report.get("ok") else 1


if __name__ == "__main__":
    raise SystemExit(main())
