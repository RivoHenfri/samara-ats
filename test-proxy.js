import fs from 'fs';
const env = fs.readFileSync('.env', 'utf-8').split('\n').reduce((acc, l) => {
    const [k, ...v] = l.split('=');
    if (k) acc[k] = v.join('=').trim().replace(/['"]/g, '');
    return acc;
}, {});
process.env = { ...process.env, ...env };


async function test() {
    const URL = process.env.VITE_SUPABASE_URL + '/functions/v1/claude-proxy';
    const KEY = process.env.VITE_SUPABASE_ANON_KEY;

    const body = {
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 4096,
        beta: 'pdfs-2024-09-25',
        messages: [
            {
                role: 'user',
                content: [
                    {
                        type: 'text',
                        text: `Analyze this CV thoroughly. Return ONLY a valid JSON object — no explanation, no markdown fences:
{
  "full_name": "string",
  "employment_history": [
    { "company": "Geotekindo", "role": "Site Engineer", "start": "2018-11", "end": "2024-06", "duration_months": 67, "responsibilities": ["List EVERY SINGLE bullet point listed on the CV exactly as written without summarizing. Do not omit any.", "array of strings"] }
  ]
}`
                    },
                    {
                        type: 'text',
                        text: "CV TEXT: Site Engineer at PT. Geotekindo. \n - Inspected the site \n - Talked to the boss \n - Designed stuff"
                    }
                ]
            }
        ]
    };

    try {
        const res = await fetch(URL, {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });

        const data = await res.text();
        console.log('Status:', res.status);
        console.log('Data:', data.substring(0, 1000));
    } catch (err) {
        console.error(err);
    }
}
test();
