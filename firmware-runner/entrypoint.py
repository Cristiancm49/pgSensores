"""Compile one Arduino sketch and optionally run its AVR ELF under simavr."""

from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import tempfile
from pathlib import Path

ALLOWED_BOARDS = {
    "arduino:avr:uno": ("atmega328p", "16000000"),
    "arduino:avr:mega": ("atmega2560", "16000000"),
}


def run(command: list[str], timeout: int) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        command,
        check=False,
        capture_output=True,
        text=True,
        timeout=timeout,
    )


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--fqbn", choices=sorted(ALLOWED_BOARDS), required=True)
    parser.add_argument("--engine", choices=["compile", "simavr", "renode"], default="compile")
    parser.add_argument("--timeout", type=int, choices=range(1, 61), default=20)
    args = parser.parse_args()
    source = Path("/workspace/sketch.ino")
    if not source.is_file() or source.stat().st_size > 256 * 1024:
        print(json.dumps({"ok": False, "error": "Sketch ausente o mayor de 256 KiB"}))
        return 2

    with tempfile.TemporaryDirectory(dir="/tmp") as temporary:
        sketch_dir = Path(temporary) / "sketch"
        build_dir = Path(temporary) / "build"
        sketch_dir.mkdir()
        build_dir.mkdir()
        shutil.copyfile(source, sketch_dir / "sketch.ino")
        result = run(
            [
                "arduino-cli",
                "compile",
                "--fqbn",
                args.fqbn,
                "--build-path",
                str(build_dir),
                str(sketch_dir),
            ],
            args.timeout,
        )
        report = {
            "ok": result.returncode == 0,
            "engine": args.engine,
            "fqbn": args.fqbn,
            "compile_stdout": result.stdout[-12000:],
            "compile_stderr": result.stderr[-12000:],
        }
        if result.returncode != 0:
            print(json.dumps(report))
            return result.returncode
        elf = build_dir / "sketch.ino.elf"
        if elf.exists():
            shutil.copyfile(elf, "/output/sketch.ino.elf")
        if args.engine == "simavr":
            mcu, frequency = ALLOWED_BOARDS[args.fqbn]
            try:
                simulated = run(
                    ["simavr", "-m", mcu, "-f", frequency, str(elf)],
                    min(args.timeout, 10),
                )
                report.update(
                    simulation_returncode=simulated.returncode,
                    simulation_stdout=simulated.stdout[-12000:],
                    simulation_stderr=simulated.stderr[-12000:],
                )
            except subprocess.TimeoutExpired as error:
                report.update(
                    simulation_returncode=124,
                    simulation_stdout="",
                    simulation_stderr=str(error),
                )
        elif args.engine == "renode":
            script = Path("/workspace/platform.resc")
            if not script.is_file():
                report.update(ok=False, error="Falta /workspace/platform.resc para Renode")
            else:
                try:
                    simulated = run(
                        [
                            "/opt/renode/renode",
                            "--disable-xwt",
                            "--console",
                            "-e",
                            "i @/workspace/platform.resc; q",
                        ],
                        min(args.timeout, 20),
                    )
                    report.update(
                        simulation_returncode=simulated.returncode,
                        simulation_stdout=simulated.stdout[-12000:],
                        simulation_stderr=simulated.stderr[-12000:],
                        ok=simulated.returncode == 0,
                    )
                except subprocess.TimeoutExpired as error:
                    report.update(ok=False, simulation_returncode=124, error=str(error))
        Path("/output/report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
        print(json.dumps(report))
        return 0 if report["ok"] else 3


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except subprocess.TimeoutExpired as error:
        print(
            json.dumps(
                {
                    "ok": False,
                    "error": "Tiempo de compilación agotado",
                    "detail": str(error),
                }
            )
        )
        raise SystemExit(124) from None
