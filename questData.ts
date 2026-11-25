import { findStore } from "@webpack";

export type QuestStatus = "available" | "in-progress" | "claimable" | "claimed" | "expired";

export interface QuestSnapshot {
    id: string;
    name: string;
    status: QuestStatus;
    expiresAt: number | null;
    orbReward: number;
    boostedOrbReward: number;
    rewardLabel: string;
    taskLabel: string;
    progress: number | null;
    progressCurrent: number;
    progressTarget: number;
}

function entries(value: any): Array<[string, any]> {
    if (value instanceof Map) return Array.from(value.entries());
    if (Array.isArray(value)) return value.map((item, index) => [String(index), item]);
    if (value && typeof value === "object") return Object.entries(value);
    return [];
}

function positiveNumber(value: unknown): number {
    const result = Number(value);
    return Number.isFinite(result) && result > 0 ? result : 0;
}

function parseDate(value: unknown): number | null {
    if (!value) return null;
    const date = new Date(value as any).getTime();
    return Number.isFinite(date) && date > 0 ? date : null;
}

function taskName(key: string, task: any): string {
    const type = String(task?.type ?? key).toUpperCase();
    if (type.includes("VIDEO")) return "Watch video";
    if (type.includes("STREAM")) return "Stream a game";
    if (type.includes("ACTIVITY")) return "Play an activity";
    if (type.includes("ACHIEVEMENT")) return "Earn an achievement";
    if (type.includes("PLAY")) return "Play a game";
    return "Other task";
}

function taskEntriesFor(quest: any): Array<[string, any]> {
    const config = quest?.config ?? {};
    const v2 = entries(config.taskConfigV2?.tasks);
    if (v2.length) return v2;
    return entries(config.taskConfig?.tasks);
}

function progressFor(quest: any, key: string, task: any): { current: number; target: number; } {
    const userStatus = quest?.userStatus ?? {};
    const allProgress = userStatus.progress;
    const progress = allProgress instanceof Map
        ? (allProgress.get(key) ?? allProgress.get(String(task?.type ?? "")))
        : (allProgress?.[key] ?? allProgress?.[String(task?.type ?? "")]);

    const target = positiveNumber(task?.target ?? task?.targetSeconds ?? task?.progressSeconds);
    if (userStatus.completedAt) return { current: target, target };

    const current = positiveNumber(progress?.value ?? progress?.progressSeconds);
    return { current: target > 0 ? Math.min(current, target) : current, target };
}

function normalizeQuest(quest: any, now: number): QuestSnapshot | null {
    if (!quest || typeof quest !== "object" || !quest.id) return null;

    const config = quest.config ?? {};
    const messages = config.messages ?? {};
    const userStatus = quest.userStatus ?? {};
    const expiresAt = parseDate(config.expiresAt);

    let status: QuestStatus;
    if (userStatus.claimedAt) status = "claimed";
    else if (userStatus.completedAt) status = "claimable";
    else if (expiresAt !== null && expiresAt <= now) status = "expired";
    else if (userStatus.enrolledAt) status = "in-progress";
    else status = "available";

    const rewardRows = Array.isArray(config.rewardsConfig?.rewards)
        ? config.rewardsConfig.rewards
        : [];
    let orbReward = 0;
    let boostedOrbReward = 0;
    const rewardNames: string[] = [];

    for (const reward of rewardRows) {
        const row = reward && typeof reward === "object" ? reward : {};
        const base = positiveNumber(row.orbQuantity);
        const boosted = positiveNumber(row.premiumOrbQuantity);
        orbReward += base;
        boostedOrbReward += boosted > 0 ? boosted : base;

        const label = row.messages?.name;
        if (typeof label === "string" && label.trim()) rewardNames.push(label.trim());
    }

    const rewardLabel = orbReward > 0
        ? Math.round(orbReward).toLocaleString() + " Orbs"
        : (rewardNames.join(" + ") || "Reward details unavailable");

    const taskRows = taskEntriesFor(quest);
    const taskLabels = taskRows
        .map(([key, task]) => taskName(key, task))
        .filter((label, index, all) => all.indexOf(label) === index);
    const primary = taskRows[0];
    const progressData = primary ? progressFor(quest, primary[0], primary[1]) : { current: 0, target: 0 };
    const progress = progressData.target > 0
        ? Math.min(1, Math.max(0, progressData.current / progressData.target))
        : null;

    return {
        id: String(quest.id),
        name: String(messages.questName ?? config.application?.name ?? "Discord Quest"),
        status,
        expiresAt,
        orbReward,
        boostedOrbReward,
        rewardLabel,
        taskLabel: taskLabels.length ? taskLabels.slice(0, 2).join(" / ") : "Task details unavailable",
        progress,
        progressCurrent: progressData.current,
        progressTarget: progressData.target
    };
}

export function getQuestStore(): any | null {
    try {
        const store = findStore("QuestStore");
        if (store) return store;
    } catch {
        // Older Discord builds may expose the store under the plural name.
    }

    try {
        return findStore("QuestsStore");
    } catch {
        return null;
    }
}

export function getQuestSnapshots(now = Date.now()): QuestSnapshot[] {
    const store = getQuestStore();
    const source = store?.quests;
    if (!source) return [];

    return entries(source)
        .map(([, quest]) => {
            try {
                const current = quest?.id && typeof store?.getQuest === "function"
                    ? (store.getQuest(quest.id) ?? quest)
                    : quest;
                return normalizeQuest(current, now);
            } catch {
                return null;
            }
        })
        .filter((quest): quest is QuestSnapshot => quest !== null)
        .sort((left, right) => {
            const leftExpiry = left.expiresAt ?? Number.MAX_SAFE_INTEGER;
            const rightExpiry = right.expiresAt ?? Number.MAX_SAFE_INTEGER;
            return leftExpiry - rightExpiry || left.name.localeCompare(right.name);
        });
}

/**
 * Reads only an already-hydrated balance. It deliberately does not invoke
 * Discord's balance-fetch action or make any network request.
 */
export function getOrbBalance(): number | null {
    try {
        const store = findStore("VirtualCurrencyStore") as any;
        const raw = store?.getCurrentBalance?.() ?? store?.balance;
        const value = raw && typeof raw === "object" ? (raw.amount ?? raw.balance ?? raw.value) : raw;
        const amount = Number(value);
        return Number.isFinite(amount) && amount >= 0 ? amount : null;
    } catch {
        return null;
    }
}
