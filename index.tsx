import "./style.css";

import { definePluginSettings } from "@api/Settings";
import { showNotification } from "@api/Notifications";
import { QuestDashboard } from "./dashboard";
import { getQuestSnapshots, type QuestStatus } from "./questData";
import definePlugin, { OptionType } from "@utils/types";
import { NavigationRouter, UserStore } from "@webpack/common";

const settings = definePluginSettings({
    notifyNewQuest: {
        type: OptionType.BOOLEAN,
        displayName: "Notify about new quests",
        description: "Show one notification when a new available Quest appears after the initial scan.",
        default: true
    },
    notifyReadyToClaim: {
        type: OptionType.BOOLEAN,
        displayName: "Notify when a quest is ready to claim",
        description: "Show one notification when an observed in-progress Quest becomes ready to claim.",
        default: true
    }
});

let timer: ReturnType<typeof setInterval> | undefined;
let activeAccountId: string | null = null;
let initialScanComplete = false;
const previousStatuses = new Map<string, QuestStatus>();

function openQuestHome() {
    try {
        NavigationRouter.transitionTo("/quest-home");
    } catch {
        // The notification remains useful even if Discord's route API changes.
    }
}

function notify(title: string, body: string) {
    void showNotification({
        title,
        body,
        onClick: openQuestHome
    }).catch(() => undefined);
}

function scanForNotifications() {
    const accountId = UserStore?.getCurrentUser?.()?.id ?? null;
    if (accountId !== activeAccountId) {
        activeAccountId = accountId;
        initialScanComplete = false;
        previousStatuses.clear();
    }

    const quests = getQuestSnapshots();
    if (!initialScanComplete) {
        for (const quest of quests) previousStatuses.set(quest.id, quest.status);
        // Do not treat the first store hydration as a flood of newly discovered quests.
        if (quests.length > 0) initialScanComplete = true;
        return;
    }

    for (const quest of quests) {
        const previous = previousStatuses.get(quest.id);

        if (previous === undefined && quest.status === "available" && settings.store.notifyNewQuest) {
            notify("New Discord Quest", quest.name + " is now available.");
        } else if (previous === "in-progress" && quest.status === "claimable" && settings.store.notifyReadyToClaim) {
            notify("Quest ready to claim", quest.name + " has completed. Claim it in Discord.");
        }

        previousStatuses.set(quest.id, quest.status);
    }
}

export default definePlugin({
    name: "OrbSniper",
    description: "A read-only Discord Quest dashboard with reward summaries, progress tracking, filters and notifications.",
    tags: ["Utility", "Notifications"],
    authors: [{ name: "supertrio17", id: 57882120n }],
    settings,
    settingsAboutComponent: QuestDashboard,

    start() {
        initialScanComplete = false;
        previousStatuses.clear();
        scanForNotifications();
        timer = setInterval(scanForNotifications, 30_000);
    },

    stop() {
        if (timer) clearInterval(timer);
        timer = undefined;
        previousStatuses.clear();
        initialScanComplete = false;
        activeAccountId = null;
    }
});
