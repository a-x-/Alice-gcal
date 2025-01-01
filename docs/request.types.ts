export interface AliceRequest {
    meta: {
        locale: string;
        timezone: string;
        client_id: string;
    };
    session: {
        message_id: number;
        session_id: string;
        skill_id: string;
        user_id: string;
        new: boolean;
    };
    request: {
        command: string;
        original_utterance: string;
        type: "SimpleUtterance";
    };
    version: string;
} 