import { Button } from "@components/Button";
import { Heading } from "@components/Heading";
import { Paragraph } from "@components/Paragraph";
import { NavigationRouter, useCallback, useEffect, useState } from "@webpack/common";

import { getOrbBalance, getQuestSnapshots, type QuestSnapshot, type QuestStatus } from "./questData";

type Filter = "all" | "attention" | QuestStatus;

const FILTERS: Array<{ value: Filter; label: string; }> = [
    { value: "all", label: "All" },
    { value: "attention", label: "Needs attention" },
    { value: "claimable", label: "Ready to claim" },
    { value: "in-progress", label: "In progress" },
    { value: "available", label: "Available" },
    { value: "claimed", label: "Claimed" },
    { value: "expired", label: "Expired" }
];

const STATUS_LABELS: Record<QuestStatus, string> = {
    available: "Available",
    "in-progress": "In progress",
    claimable: "Ready to claim",
    claimed: "Claimed",
    expired: "Expired"
};

function formatExpiry(timestamp: number | null): string {
    if (timestamp === null) return "No expiry date";
    const remaining = timestamp - Date.now();
    if (remaining <= 0) return "Expired";
    const hours = Math.floor(remaining / 3_600_000);
    const days = Math.floor(hours / 24);
    if (days > 0) return "Expires in " + days + "d " + (hours % 24) + "h";
    if (hours > 0) return "Expires in " + hours + "h";
    return "Expires in " + Math.max(1, Math.floor(remaining / 60_000)) + "m";
}

function Stat({ label, value }: { label: string; value: number | string; }) {
    return (
        <div className="orbsniper-stat">
            <span>{label}</span>
            <strong>{value}</strong>
        </div>
    );
}

function QuestCard({ quest }: { quest: QuestSnapshot; }) {
    const percent = quest.progress === null ? null : Math.round(quest.progress * 100);

    return (
        <article className="orbsniper-quest-card">
            <div className="orbsniper-quest-heading">
                <strong>{quest.name}</strong>
                <span className={"orbsniper-status orbsniper-status-" + quest.status}>
                    {STATUS_LABELS[quest.status]}
                </span>
            </div>
            <div className="orbsniper-quest-meta">
                <span>{quest.rewardLabel}</span>
                <span>{formatExpiry(quest.expiresAt)}</span>
            </div>
            <div className="orbsniper-quest-task">{quest.taskLabel}</div>
            {percent !== null && (
                <div className="orbsniper-progress-wrap">
                    <div className="orbsniper-progress-track">
                        <div className="orbsniper-progress-fill" style={{ width: percent + "%" }} />
                    </div>
                    <span>{percent}%</span>
                </div>
            )}
        </article>
    );
}

export function QuestDashboard() {
    const [quests, setQuests] = useState<QuestSnapshot[]>([]);
    const [balance, setBalance] = useState<number | null>(null);
    const [filter, setFilter] = useState<Filter>("attention");
    const [search, setSearch] = useState("");
    const [lastUpdated, setLastUpdated] = useState(0);

    const refresh = useCallback(() => {
        setQuests(getQuestSnapshots());
        setBalance(getOrbBalance());
        setLastUpdated(Date.now());
    }, []);

    useEffect(() => {
        refresh();
        const interval = setInterval(refresh, 15_000);
        return () => clearInterval(interval);
    }, [refresh]);

    const counts: Record<QuestStatus, number> = {
        available: 0,
        "in-progress": 0,
        claimable: 0,
        claimed: 0,
        expired: 0
    };
    for (const quest of quests) counts[quest.status]++;

    const potentialOrbs = quests
        .filter(quest => quest.status === "available" || quest.status === "in-progress" || quest.status === "claimable")
        .reduce((sum, quest) => sum + quest.orbReward, 0);

    const normalizedSearch = search.trim().toLowerCase();
    const visible = quests.filter(quest => {
        const filterMatches = filter === "all"
            || (filter === "attention" && (quest.status === "available" || quest.status === "in-progress" || quest.status === "claimable"))
            || quest.status === filter;
        const textMatches = !normalizedSearch
            || quest.name.toLowerCase().includes(normalizedSearch)
            || quest.taskLabel.toLowerCase().includes(normalizedSearch)
            || quest.rewardLabel.toLowerCase().includes(normalizedSearch);
        return filterMatches && textMatches;
    });

    return (
        <div className="orbsniper-dashboard">
            <div className="orbsniper-header">
                <div>
                    <Heading>OrbSniper · Quest Monitor</Heading>
                    <Paragraph>Read-only overview of the Quests already loaded by Discord.</Paragraph>
                </div>
                <div className="orbsniper-actions">
                    <Button size="small" variant="secondary" onClick={refresh}>Refresh</Button>
                    <Button size="small" variant="primary" onClick={() => NavigationRouter.transitionTo("/quest-home")}>
                        Open Quest Home
                    </Button>
                </div>
            </div>

            <div className="orbsniper-stats">
                <Stat label="Available" value={counts.available} />
                <Stat label="In progress" value={counts["in-progress"]} />
                <Stat label="Ready to claim" value={counts.claimable} />
                <Stat label="Claimed" value={counts.claimed} />
                <Stat label="Potential Orbs" value={Math.round(potentialOrbs).toLocaleString()} />
                <Stat label="Current balance" value={balance === null ? "Not loaded" : balance.toLocaleString()} />
            </div>

            <div className="orbsniper-toolbar">
                <input
                    type="search"
                    value={search}
                    placeholder="Search quests or task types…"
                    aria-label="Search quests"
                    onChange={event => setSearch(event.currentTarget.value)}
                />
                <select value={filter} aria-label="Filter quests" onChange={event => setFilter(event.currentTarget.value as Filter)}>
                    {FILTERS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
            </div>

            <div className="orbsniper-list">
                {visible.length > 0
                    ? visible.map(quest => <QuestCard key={quest.id} quest={quest} />)
                    : <div className="orbsniper-empty">
                        {quests.length === 0
                            ? "No Quest data is available yet. Open Discord's Quest Home, then refresh."
                            : "No quests match the current search and filter."}
                    </div>}
            </div>

            <div className="orbsniper-footer">
                <span>{quests.length} quests detected · refreshed {lastUpdated ? new Date(lastUpdated).toLocaleTimeString() : "—"}</span>
                <span>Progress is read from Discord; this plugin does not generate activity or claim rewards.</span>
            </div>
        </div>
    );
}
