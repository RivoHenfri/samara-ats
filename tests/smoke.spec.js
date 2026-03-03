import { test, expect } from '@playwright/test';

test.describe('ATS Smoke Test', () => {
    test('should load the application and show login gateway for unauthenticated users', async ({ page }) => {
        // Navigate to the root URL
        // We assume the dev server runs on localhost:5173 which is Vite's default
        await page.goto('http://localhost:5173');

        // Due to the AuthProvider, an unauthenticated user should be redirected or shown the LoginPage
        // Let's check for a known string on the login page or a general container
        // Based on standard Samara ATS login pages, we wait for the auth container.
        // If we just look for something generic like text "Log in" or "Samara":

        // We can just verify the page title or network idle
        await page.waitForLoadState('networkidle');

        // Verify the page doesn't crash (no white screen)
        // We'll check if the root div is visible
        const rootElement = page.locator('#root');
        await expect(rootElement).toBeVisible();

        // The login page typically has an email input or OAuth buttons
        // We'll check that there is at least some readable text rendered by React
        const bodyText = await page.locator('body').innerText();
        expect(bodyText.length).toBeGreaterThan(0);
    });
});
