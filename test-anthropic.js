async function test() {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
            "x-api-key": "fakekey",
            "anthropic-version": "2023-06-01",
            "content-type": "application/json"
        },
        body: JSON.stringify({
            model: "claude-3-5-haiku-20241022",
            max_tokens: 100,
            messages: [{ role: "user", content: "hi" }]
        })
    });
    console.log("Status:", res.status);
    console.log(await res.text());
}
test();
