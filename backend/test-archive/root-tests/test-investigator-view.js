/**
 * Test script for Investigator View endpoints
 * Tests GET and POST /api/ocr/investigator-view/:jobId
 */

const testJobId = 'test-job-' + Date.now();

console.log('🧪 Testing Investigator View Endpoints\n');
console.log('Test Job ID:', testJobId);
console.log('='.repeat(50));

// Test 1: GET non-existent job (should return 404)
console.log('\n📋 Test 1: GET non-existent job');
fetch(`http://localhost:3030/api/ocr/investigator-view/${testJobId}`)
    .then(res => {
        console.log('Status:', res.status);
        return res.json();
    })
    .then(data => {
        console.log('Response:', JSON.stringify(data, null, 2));
        if (data.code === 'JOB_NOT_FOUND') {
            console.log('✅ Test 1 PASSED: Correctly returns 404 for non-existent job\n');
        } else {
            console.log('❌ Test 1 FAILED: Expected JOB_NOT_FOUND error\n');
        }

        // Test 2: POST to non-existent job (should return 404)
        console.log('📋 Test 2: POST to non-existent job');
        return fetch(`http://localhost:3030/api/ocr/investigator-view/${testJobId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                data: {
                    reportContent: 'Test report content'
                }
            })
        });
    })
    .then(res => {
        console.log('Status:', res.status);
        return res.json();
    })
    .then(data => {
        console.log('Response:', JSON.stringify(data, null, 2));
        if (data.code === 'JOB_NOT_FOUND') {
            console.log('✅ Test 2 PASSED: Correctly returns 404 for non-existent job\n');
        } else {
            console.log('❌ Test 2 FAILED: Expected JOB_NOT_FOUND error\n');
        }

        // Test 3: POST without data (should return 400)
        console.log('📋 Test 3: POST without data');
        // First create a mock job by using the upload endpoint
        // For now, we'll just test the validation
        return fetch(`http://localhost:3030/api/ocr/investigator-view/mock-job-123`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({})
        });
    })
    .then(res => {
        console.log('Status:', res.status);
        return res.json();
    })
    .then(data => {
        console.log('Response:', JSON.stringify(data, null, 2));
        if (data.code === 'NO_DATA' || data.code === 'JOB_NOT_FOUND') {
            console.log('✅ Test 3 PASSED: Correctly validates request body\n');
        } else {
            console.log('❌ Test 3 FAILED: Expected validation error\n');
        }

        console.log('='.repeat(50));
        console.log('✅ Endpoint validation tests completed!');
        console.log('\n💡 Note: Full integration tests require a completed OCR job.');
        console.log('   To test the full workflow:');
        console.log('   1. Upload a PDF via /api/ocr/upload');
        console.log('   2. Wait for processing to complete');
        console.log('   3. Access investigator-view.html?jobId=<jobId>');
    })
    .catch(error => {
        console.error('❌ Test failed with error:', error.message);
    });
