"""
session_start.py — Harness 状态机

每个 Session 启动时自动运行。
职责：读进度 → 输出状态报告 → 为模型提供行动指令。
只读不写，保持轻量。
"""

import json
import os
import sys
from pathlib import Path


def get_colored(text: str, color: str) -> str:
    """终端颜色输出（hook 输出会显示在 Claude Code 启动信息中）"""
    colors = {
        "green": "32", "yellow": "33", "red": "31",
        "blue": "34", "cyan": "36", "gray": "90",
    }
    c = colors.get(color, "0")
    return f"\033[{c}m{text}\033[0m"


def find_highest_parent_with_json(start: Path) -> tuple[Path | None, dict | None]:
    """从当前目录向上递归查找 .harness/progress.json"""
    for parent in [start] + list(start.parents):
        pp = parent / ".harness" / "progress.json"
        if pp.exists():
            try:
                return parent, json.loads(pp.read_text(encoding="utf-8"))
            except (json.JSONDecodeError, Exception):
                continue
    return None, None


def print_report(phase: str, lines: list[str]):
    """统一输出报告格式"""
    title = {"init": "新项目", "design_done": "设计待实施", "implement": "增量执行", "test": "最终验收", "done": "已完成"}
    icon = {"init": "[NEW]", "design_done": "[DESIGN]", "implement": "[RUN]", "test": "[TEST]", "done": "[DONE]"}
    tag = icon.get(phase, "[?]")
    print(f"\n{'='*56}")
    print(f"  {tag} Harness Status")
    print(f"{'='*56}")
    for line in lines:
        print(f"  {line}")
    print(f"{'='*56}\n")


def main():
    cwd = Path.cwd()

    # 1. 查找进度文件
    proj_root, progress = find_highest_parent_with_json(cwd)
    harness_root = proj_root / ".harness" if proj_root else None

    if not progress:
        # ── 新项目／未初始化 ──
        design_confirmed = harness_root and (harness_root / "design.confirmed").exists()
        design_doc = harness_root and (harness_root / "design.md").exists()

        if design_confirmed:
            print_report("design_done", [
                "项目设计方案已确认！",
                f"项目: {(harness_root/ 'design.md').read_text(encoding='utf-8').split(chr(10))[0] if design_doc else '(未知)'}",
                "",
                "指令: 请将设计方案拆解为实施进度表。",
                "      调用 Subagent 生成 JSON 进度文件。",
            ])
        elif design_doc:
            print_report("design_done", [
                "设计方案已存在但尚未确认最终版本。",
                "指令: 请向用户展示设计方案，等待确认。",
            ])
        else:
            print_report("init", [
                "这是新项目 / 当前目录尚未配置 Harness。",
                "",
                "指令: 请先了解用户需求，然后：",
                "  1. 启动 Research Workflow 调研现状",
                "  2. 启动 Design Workflow 设计方案",
                "  3. 与用户讨论并确认方案",
            ])
        return 0

    # ── 已有进度文件 ──
    phase = progress.get("phase", "implementation")
    steps = progress.get("steps", [])
    completed = progress.get("completed", 0)
    total = progress.get("total_steps", len(steps))
    current_step_id = progress.get("current_step", "")

    # 找当前步骤
    current_step = None
    for s in steps:
        if s.get("id") == current_step_id:
            current_step = s
            break
    if not current_step:
        # fallback: 找第一个未完成的
        for s in steps:
            if not s.get("passes"):
                current_step = s
                break

    done_steps = [s for s in steps if s.get("passes")]
    pending_steps = [s for s in steps if not s.get("passes")]

    # ── 最终验收阶段 ──
    if completed >= total or not pending_steps:
        print_report("test", [
            "所有实施步骤已完成！",
            f"项目: {progress.get('project', '(未知)')}",
            f"步骤: {completed}/{total}",
            "",
            "指令: 请进行最终总体验收：",
            "  1. 全量测试",
            "  2. 检查与设计文档的一致性",
            "  3. 向用户报告完成状态",
        ])
        return 0

    # ── 增量执行阶段 ──
    percent = int(completed / total * 100) if total > 0 else 0

    # Tier 标签映射（向后兼容：无 tier 字段默认为 1）
    tier_labels = {1: "Walking Skeleton", 2: "功能扩展", 3: "加固"}
    tier_icons = {1: "🏗", 2: "🚀", 3: "🔧"}
    current_tier = current_step.get("tier", 1) if current_step else 1
    current_tier_label = tier_labels.get(current_tier, f"Tier {current_tier}")
    current_tier_icon = tier_icons.get(current_tier, "")

    # 构建完成列表
    lines = [
        f"项目: {progress.get('project', '(未知)')}",
        f"进度: {current_step_id} ({completed}/{total} · {percent}%)",
        "",
    ]

    if done_steps:
        lines.append("已完成:")
        for s in done_steps[-5:]:  # 最多显示最近5条
            t = s.get("tier", 1)
            ti = tier_icons.get(t, "")
            lines.append(f"  [OK] {s['id']} — {s.get('title', s['id'])} {ti}")
        if len(done_steps) > 5:
            lines.append(f"  ... 及之前 {len(done_steps)-5} 项")

    lines.append("")
    lines.append(f"  [-] 当前任务: {current_step['id']} — {current_step.get('title', '')}")
    lines.append(f"      [Tier {current_tier}] {current_tier_icon} {current_tier_label}")
    lines.append(f"   描述: {current_step.get('description', '(无描述)')}")

    # 里程碑检测
    step_milestone = current_step.get("milestone", "")
    if step_milestone:
        lines.append(f"   🏁 里程碑: {step_milestone} — 此步完成后将达成！")

    ac = current_step.get("acceptance_criteria", [])
    if ac:
        lines.append(f"   验收标准:")
        for a in ac:
            lines.append(f"     - {a}")

    vc = current_step.get("verification_commands", [])
    if vc:
        lines.append(f"   验收命令:")
        for v in vc:
            lines.append(f"     - {v}")

    # Tier 进度摘要
    milestones = progress.get("milestones", [])
    if milestones:
        lines.append("")
        lines.append("[milestones]")
        for m in milestones:
            mt = m.get("tier", "")
            ml = m.get("label", "")
            ms_id = m.get("step_id", "")
            # 检查该 milestone 是否已完成
            done_ids = {s["id"] for s in done_steps}
            done = ms_id in done_ids
            status_icon = "✅" if done else "⏳"
            lines.append(f"  {status_icon} Tier {mt}: {ml} ({ms_id})")

    # 设计决策摘要
    decisions = progress.get("design_decisions", [])
    if decisions:
        lines.append("")
        lines.append("[i] 关键设计决策:")
        for d in decisions[-3:]:
            lines.append(f"  - {d.get('decision', '')} — {d.get('reason', '')}")

    print_report("implement", lines)
    return 0


if __name__ == "__main__":
    sys.exit(main())
