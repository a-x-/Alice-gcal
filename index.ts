import { serve } from "bun";
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import type { AliceRequest } from "./docs/request.types";
import type { AliceResponse } from "./docs/response.types";

// Загружаем credentials
const credentials = JSON.parse(
    await Bun.file('./.oauth-google-creds.json').text()
).installed;

const WEB_APP_URL = 'https://alice-gcal.invntrm.ru';
const PATH_OAUTH_CALLBACK = '/oauth2callback';
const OAUTH_CALLBACK_URL = `${WEB_APP_URL}${PATH_OAUTH_CALLBACK}`;

// Создаем OAuth client
const oauth2Client = new OAuth2Client(
    credentials.client_id,
    credentials.client_secret,
    OAUTH_CALLBACK_URL
);

// Создаем клиент календаря
const calendar = google.calendar({ version: 'v3' });

// Хранилище токенов пользователей
const userTokens = new Map<string, any>();

const server = serve({
    port: 3001,
    async fetch(req): Promise<Response> {
        const url = new URL(req.url);

        // Обработка OAuth callback
        if (url.pathname === PATH_OAUTH_CALLBACK) {
            const code = url.searchParams.get('code');
            if (code) {
                const { tokens } = await oauth2Client.getToken(code);
                // TODO: Сохранить tokens с привязкой к пользователю
                return new Response('Авторизация успешна! Можете вернуться к Аисе.');
            }
            return new Response('Ошибка авторизации', { status: 400 });
        }

        // Обработка запросов от Алисы
        if (req.method === 'POST') {
            try {
                const body = await req.json() as AliceRequest;
                const { version, session, request } = body;

                const response: AliceResponse = {
                    version,
                    session,
                    response: {
                        text: '',
                        end_session: false,
                        buttons: []
                    }
                };

                // Если пользователь не авторизован
                if (!userTokens.has(session.user_id)) {
                    const authUrl = oauth2Client.generateAuthUrl({
                        access_type: 'offline',
                        scope: ['https://www.googleapis.com/auth/calendar.readonly']
                    });

                    response.response.text = 'Для работы с календарем необходимо авторизоваться. Перейдите по ссылке:';
                    response.response.buttons = [{
                        title: 'Авторизация',
                        url: authUrl,
                        hide: false
                    }];
                    return Response.json(response);
                }

                // Устанавливаем токены для пользователя
                oauth2Client.setCredentials(userTokens.get(session.user_id));

                const command = request.command.toLowerCase();

                if (!command) {
                    response.response.text = 'Я могу показать ваши события из Google Calendar. Скажите "покажи события" или "расписание"';
                    return Response.json(response);
                }

                if (command === 'помощь' || command === 'что ты умеешь') {
                    response.response.text = 'Я могу показать ваши события из Google Calendar. Скажите "покажи события" или "расписание"';
                }
                else if (command.includes('события') || command.includes('расписание')) {
                    const now = new Date().toISOString();
                    const events_result = await calendar.events.list({
                        auth: oauth2Client,
                        calendarId: 'primary',
                        timeMin: now,
                        maxResults: 5,
                        singleEvents: true,
                        orderBy: 'startTime'
                    });

                    const events = events_result.data.items;

                    if (!events || events.length === 0) {
                        response.response.text = 'На ближайшее время событий нет';
                    } else {
                        let text = 'Ваши ближайшие события:\n';
                        events.forEach(event => {
                            const start = event.start?.dateTime || event.start?.date;
                            const time = new Date(start as string).toLocaleString('ru-RU', {
                                hour: '2-digit',
                                minute: '2-digit',
                                day: '2-digit',
                                month: '2-digit'
                            });
                            text += `${event.summary} в ${time}\n`;
                        });
                        response.response.text = text;
                    }
                } else {
                    response.response.text = 'Я понимаю команды: "покажи события", "расписание" или "помощь"';
                }

                return Response.json(response);

            } catch (error) {
                console.error('Ошибка:', error);
                return Response.json({
                    version: '1.0',
                    session: {},
                    response: {
                        text: 'Произошла ошибка. Попробуйте позже.',
                        end_session: false
                    }
                } as AliceResponse);
            }
        }

        return new Response('Method not allowed', { status: 405 });
    },
});

console.log(`Сервер запущен на порту ${server.port}`);