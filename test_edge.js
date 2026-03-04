import fs from 'fs';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

const res = await fetch(`${SUPABASE_URL}/functions/v1/score-candidate`, {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ANON_KEY}`
    },
    body: JSON.stringify({
        record: { id: 'c4b0bc5f-5a8f-481b-b416-2d4b924d5ae0', candidate_id: 'dummy', tenant_id: 'dummy', role_id: 'dummy' }
    })
});

const text = await res.text();
process.stdout.write(`STATUS:${res.status}\nBODY:${text}\n`);
