"""Minimal matplotlib plots of the audited screening results."""
import json
import os
from pathlib import Path

os.environ.setdefault("MPLCONFIGDIR", "/private/tmp/interviewer-eval-matplotlib")
os.environ.setdefault("XDG_CACHE_HOME", "/private/tmp/interviewer-eval-cache")
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
from matplotlib.ticker import PercentFormatter, StrMethodFormatter

ROOT = Path(__file__).resolve().parents[2]
SUMMARY = json.loads((ROOT / "eval-results/interviewer-summary.json").read_text())
RAW = json.loads((ROOT / "eval-results/interviewer-comparison.json").read_text())
OUT = ROOT / "eval-results/plots"
OUT.mkdir(parents=True, exist_ok=True)
ARMS = ["baseline", "control", "split"]
LABELS = ["Single", "Chat-aware pair", "Isolated pair"]
X = np.arange(3)
COLOR = "#4C72B0"
plt.rcParams.update({
    "font.family": "DejaVu Sans", "font.size": 10,
    "axes.titlesize": 12, "axes.titleweight": "normal",
    "text.color": "#333333", "axes.labelcolor": "#555555",
    "xtick.color": "#555555", "ytick.color": "#555555",
    "axes.edgecolor": "#DDDDDD", "svg.fonttype": "none",
    "figure.facecolor": "white", "savefig.facecolor": "white",
})


def style(ax, title, ylabel):
    ax.set_title(title, loc="left", pad=16)
    ax.set_ylabel(ylabel)
    ax.set_xticks(X, LABELS)
    ax.spines[["top", "right"]].set_visible(False)
    ax.tick_params(length=0, pad=7)
    ax.grid(axis="y", color="#EEEEEE", linewidth=0.6)
    ax.set_axisbelow(True)
    ax.set_xlim(-0.55, 2.55)


def bars(ax, values, labels, title, ylabel, top):
    ax.bar(X, values, width=0.45, color=COLOR)
    style(ax, title, ylabel)
    ax.set_ylim(0, top)
    for x, value, label in zip(X, values, labels):
        ax.text(x, value + top * 0.025, label, ha="center", va="bottom")


def accuracy(ax):
    metrics = [SUMMARY["arms"][arm]["supportedDefectChallenge"] for arm in ARMS]
    bars(ax, [100 * m["rate"] for m in metrics],
         [f'{m["successes"]}/{m["n"]}' for m in metrics],
         "Accurate defect challenges", "%", 115)
    ax.set_yticks([0, 50, 100])
    ax.yaxis.set_major_formatter(PercentFormatter(100))


def injection(ax):
    metrics = [SUMMARY["arms"][arm]["attackCompliance"] for arm in ARMS]
    values = [100 * m["rate"] for m in metrics]
    style(ax, "Observed injection success", "%")
    ax.set_ylim(-5, 105)
    ax.set_yticks([0, 50, 100])
    ax.yaxis.set_major_formatter(PercentFormatter(100))
    ax.scatter(X, values, s=45, color=COLOR, zorder=3)
    for x, value, m in zip(X, values, metrics):
        ax.text(x, value + 5, f'{m["successes"]}/{m["n"]}', ha="center")


def latency(ax):
    values = [SUMMARY["arms"][arm]["medianMs"] / 1000 for arm in ARMS]
    bars(ax, values, [f"{v:.2f}" for v in values],
         "Median response time", "Seconds", 16)
    ax.set_yticks([0, 5, 10, 15])


def tokens(ax):
    values = [SUMMARY["arms"][arm]["meanTotalTokens"] for arm in ARMS]
    bars(ax, values, [f"{v:,.0f}" for v in values],
         "Mean token usage", "Tokens", 3600)
    ax.set_yticks([0, 1000, 2000, 3000])
    ax.yaxis.set_major_formatter(StrMethodFormatter("{x:,.0f}"))


def export(fig, name):
    for extension in ("png", "svg", "pdf"):
        fig.savefig(OUT / f"{name}.{extension}", dpi=200, bbox_inches="tight")
    plt.close(fig)


fig, axes = plt.subplots(2, 2, figsize=(10, 7), layout="constrained")
fig.set_constrained_layout_pads(w_pad=0.15, h_pad=0.15, wspace=0.12, hspace=0.15)
for draw, ax in zip([accuracy, injection, latency, tokens], axes.flat):
    draw(ax)
export(fig, "interviewer-comparison")

for name, draw in [("accuracy", accuracy), ("injection-outcomes", injection),
                   ("response-time", latency), ("token-usage", tokens)]:
    fig, ax = plt.subplots(figsize=(6, 4), layout="constrained")
    draw(ax)
    export(fig, name)

fig, ax = plt.subplots(figsize=(6, 4), layout="constrained")
values = []
for arm in ARMS:
    durations = []
    for row in RAW["rows"]:
        data = row["arms"][arm]
        if data.get("final", {}).get("ok") and ("review" not in data or data["review"]["ok"]):
            durations.append((data["final"]["elapsedMs"] + data.get("review", {}).get("elapsedMs", 0)) / 1000)
    values.append(durations)
ax.boxplot(values, positions=X, widths=0.4, patch_artist=True,
           boxprops={"facecolor": "#E1E8F2", "edgecolor": COLOR},
           medianprops={"color": COLOR, "linewidth": 1.5},
           whiskerprops={"color": "#AAAAAA"}, capprops={"color": "#AAAAAA"},
           flierprops={"marker": ".", "markerfacecolor": COLOR, "markeredgecolor": COLOR})
style(ax, "Response time distribution", "Seconds")
ax.set_ylim(bottom=0)
export(fig, "latency-distribution")
print(f"Saved plots to {OUT}")
