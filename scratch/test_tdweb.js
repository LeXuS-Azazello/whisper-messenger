import TdClient from 'tdweb';
console.log('TdClient:', TdClient);
try {
    const client = new TdClient({
        useTestDc: false,
        readOnly: false,
        verbosityLevel: 1,
        jsLogVerbosityLevel: 1,
        onUpdate: (update) => console.log('Update:', update)
    });
    console.log('Client created:', client);
} catch (e) {
    console.error('Error creating client:', e.message);
}
