// Quick test script for alternatives API
const http = require('http');

const data = JSON.stringify({
    request_id: 1
});

const options = {
    hostname: 'localhost',
    port: 5000,
    path: '/api/distribution/suggest-alternatives',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
    }
};

console.log('Testing alternatives API...\n');

const req = http.request(options, (res) => {
    let responseData = '';

    res.on('data', (chunk) => {
        responseData += chunk;
    });

    res.on('end', () => {
        console.log('Status Code:', res.statusCode);
        console.log('Response:', responseData);

        try {
            const parsed = JSON.parse(responseData);
            console.log('\n✅ Parsed successfully:');
            console.log(JSON.stringify(parsed, null, 2));
        } catch (e) {
            console.log('\n❌ Failed to parse JSON');
        }
    });
});

req.on('error', (error) => {
    console.error('❌ Error:', error.message);
});

req.write(data);
req.end();
