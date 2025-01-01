export interface AliceResponse {
    response: {
        text: string;
        tts?: string;
        buttons?: Array<{
            title: string;
            url?: string;
            hide?: boolean;
        }>;
        end_session: boolean;
    };
    session: {
        message_id: number;
        session_id: string;
        skill_id: string;
        user_id: string;
    };
    version: string;
}