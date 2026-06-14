"""
session_end.py — Harness 状态持久化

每个 Session 结束时自动运行。
职责：更新进度 → Git commit → 写 Session 日志。

最佳失败（不阻塞 Session 结束）。
"""

import json
import os
import subprocess
import sys
from datetime import datetime
from pathlib import Path


def git(*args: str, cwd: Path) -> subprocess.CompletedProcess | None:
    """运行 Git 命令，失败时静默返回 None"""
    try:
        return subprocess.run(
            ["git", *args],
            cwd=cwd,
            capture_output=True,
            text=True,
            timeout=15,
        )
    except (FileNotFoundError, subprocess.TimeoutExpired, Exception):
        return None


def main():
    cwd = Path.cwd()
    progress_file = cwd / ".harness" / "progress.json"

    if not progress_file.exists():
        return 0  # 非 Harness 项目，不做任何事

    try:
        progress = json.loads(progress_file.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, Exception):
        progress = {}

    project = progress.get("project", cwd.name)
    phase = progress.get("phase", "unknown")
    step_id = progress.get("current_step", "")
    completed = progress.get("completed", 0)
    total = progress.get("total_steps", 0)

    # ── 1. Git commit（最佳失败） ──
    # 检查 progress.json 是否有未提交的更改
    result = git("status", "--porcelain", ".harness/progress.json", cwd=cwd)
    if result and result.stdout.strip():
        git("add", ".harness/progress.json", cwd=cwd)
        commit_msg = f"[harness] {project}: {phase}/{step_id} ({completed}/{total})"
        git("commit", "-m", commit_msg, cwd=cwd)

    # ── 2. 写 Session 日志 ──
    session_dir = cwd / ".harness" / "sessions"
    session_dir.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")

    log_lines = [
        f"# Session {timestamp}",
        f"",
        f"- **项目**: {project}",
        f"- **阶段**: {phase}",
        f"- **当前步骤**: {step_id}",
        f"- **进度**: {completed}/{total}",
        f"- **时间**: {datetime.now().strftime('%Y-%m-%d %H:%M')}",
        f"",
    ]
    session_dir.joinpath(f"{timestamp}.md").write_text(
        "\n".join(log_lines), encoding="utf-8"
    )

    # ── 3. 输出摘要（显示在终端） ──
    print(f"\n  [HARNESS] {project} — {phase}/{step_id} ({completed}/{total})")
    print(f"  [LOG] .harness/sessions/{timestamp}.md\n")

    return 0


if __name__ == "__main__":
    sys.exit(main())
