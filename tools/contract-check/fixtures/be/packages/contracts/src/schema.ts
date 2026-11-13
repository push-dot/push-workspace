export interface paths {
    "/api/v1/bots/{id}/site-grants/{host}": { delete: unknown };
}
export interface operations {
    getBotsByIdSiteGrants: {
        responses: {
            200: { content: { "application/json": { data: components["schemas"]["BotSiteGrant"][] } } };
        };
    };
}
export interface components {
    schemas: {
        BillingStatus: {
            creditsRefillAt?: string;
            plan: ("FREE" | "PRO" | "ULTRA" | "BASIC") | null;
        };
        Bot: {
            displayName: string;
            id: string;
            unread: boolean;
        };
        BotDetail: components["schemas"]["Bot"] & {
            materialCount?: number;
        };
        BotLinkPreview: {
            postingId: string;
            status: "found";
        } | {
            status: "not_a_posting";
        };
        BotList: {
            data: components["schemas"]["Bot"][];
        };
        BotSearch: {
            botTotal: number;
            bots: components["schemas"]["Bot"][];
        };
        BotSendBody: {
            ai?: {
                effort?: string;
                model?: string;
                models?: unknown;
            };
            attachments?: {
                id: string;
                kind: string;
            }[];
            text: string;
        };
        BotCardAnswer: {
            id: string;
            status: "APPROVED" | "REJECTED";
        };
        BotSiteGrant: {
            grantedAt: string;
            host: string;
            kind: "posting" | "company" | "other";
        };
        CardRetry: {
            expiresAt: string;
            id: string;
        };
        CreateBotBody: {
            displayName?: string;
            postingId: string;
        };
        MaterialDetail: {
            id: string;
            kind: "file" | "link";
            title: string;
        };
        MaterialsPage: {
            counts: {
                bookmark: number;
                doc: number;
                link: number;
            };
        };
        Notification: {
            id: string;
            target: {
                id?: string;
                kind?: "posting" | "conversation" | "bot";
            } & {
                [key: string]: unknown;
            };
        };
        StreamEvent: {
            phase?: "queued" | "thinking" | "working" | "waiting";
            seq: number;
            text: string;
            type: "status";
        } | {
            seq: number;
            text: string;
            type: "token";
        } | {
            operation: unknown;
            seq: number;
            type: "done";
        } | {
            error: {
                code: string;
            };
            seq: number;
            type: "error";
        } | {
            resumable: boolean;
            seq: number;
            type: "cancelled";
        } | {
            seq: number;
            text: string;
            type: "notice";
        } | {
            expiresAt?: string;
            id: string;
            seq: number;
            type: "approval";
        };
        Transcript: {
            data: {
                events: components["schemas"]["StreamEvent"][];
                id: string;
            }[];
        };
        TranscriptMatch: {
            at: string;
            messageId: string;
        };
        UpdateBotBody: {
            displayName?: string;
            expectedRevision: number;
        };
    };
}
