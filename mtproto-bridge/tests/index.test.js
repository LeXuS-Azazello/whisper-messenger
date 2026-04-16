import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

// Use vi.mock before imports if possible, or use vi.doMock
vi.mock('telegram', () => ({
    Api: {
        InitConnection: class {},
        help: { GetConfig: class {} },
        messages: { SetTyping: class {} },
        SendMessageRecordAudioAction: class {}
    },
    TelegramClient: function() {
        return {
            connected: true,
            connect: vi.fn().mockResolvedValue(true),
            disconnect: vi.fn().mockResolvedValue(true),
            sendMessage: vi.fn().mockResolvedValue(true),
            invoke: vi.fn().mockResolvedValue(true),
            addEventHandler: vi.fn(),
            getMe: vi.fn().mockResolvedValue({ id: 'me' })
        };
    }
}));

vi.mock('telegram/sessions/index.js', () => {
    const StringSession = function() {
        return {
            save: () => 'mock_session'
        };
    };
    return {
        StringSession,
        default: { StringSession }
    };
});

vi.mock('../transcribe.js', () => ({
    transcribe: () => Promise.resolve({ text: 'test' }),
    default: { transcribe: () => Promise.resolve({ text: 'test' }) }
}));

vi.mock('fs', () => {
    const fsMock = {
        existsSync: () => true,
        readFileSync: (path) => Buffer.from('fake_audio'),
        realpathSync: (p) => p
    };
    return {
        ...fsMock,
        default: fsMock
    };
});

// Mock @kubernetes/client-node
vi.mock('@kubernetes/client-node', () => {
    const mock = {
        KubeConfig: function() {
            return {
                loadFromDefault: () => {},
                makeApiClient: () => ({})
            };
        },
        CoreV1Api: function() {}
    };
    return {
        default: mock,
        ...mock
    };
});

describe('MTProto Bridge Integration', () => {
    let app;
    const SECRET = 'testsecret';

    beforeEach(async () => {
        vi.resetModules();
        process.env.BRIDGE_SECRET = SECRET;
        process.env.TG_API_ID = '12345';
        process.env.TG_API_HASH = 'hash';
        process.env.MODE = 'MANAGER';
        
        // Dynamic import to ensure mocks are used
        const mod = await import('../index.js');
        app = mod.default;
    });

    it('POST /test-tg should return success', async () => {
        const response = await request(app)
            .post('/test-tg')
            .set('x-bridge-secret', SECRET)
            .send({ session: 'any_string' });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
    });
});
